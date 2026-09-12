
/**
 * ImageManager handles the local persistence of images on the device (Mobile/Desktop).
 * It downloads external images and saves them to the local filesystem,
 * allowing for offline access and reduced bandwidth.
 */

/** Give up on a download well before the OS socket timeout does. */
const FETCH_TIMEOUT_MS = 8000;

/** How long a dead URL stays on the "do not retry" list. */
const FAILURE_TTL_MS = 30 * 60 * 1000;

const FAILURE_STORE_KEY = 'zeneva_image_failures';

/**
 * URLs whose host did not answer, and when we gave up on them.
 *
 * Without this, a product whose image host is down - a dead CDN, an expired
 * WordPress site - is re-requested on every single mount: the Tauri HTTP fetch
 * hangs, falls back to the raw URL, and the webview then spends another ~30s of
 * its own before printing ERR_CONNECTION_TIMED_OUT. Twenty products on screen
 * means forty stalled requests and a console nobody can read through. Keeping
 * the failure for half an hour shows the placeholder immediately instead, and
 * still lets a host that comes back up recover on its own.
 */
const failedUrls = new Map<string, number>();
let failuresLoaded = false;

function loadFailures() {
  if (failuresLoaded || typeof window === 'undefined') return;
  failuresLoaded = true;
  try {
    const raw = localStorage.getItem(FAILURE_STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    for (const [url, at] of Object.entries(parsed)) {
      if (now - at < FAILURE_TTL_MS) failedUrls.set(url, at);
    }
  } catch {
    // Corrupt or unavailable storage - start with an empty list.
  }
}

function persistFailures() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      FAILURE_STORE_KEY,
      JSON.stringify(Object.fromEntries(failedUrls)),
    );
  } catch {
    // Quota or private mode - the in-memory map still does its job.
  }
}

/**
 * Coming back online invalidates every recorded failure: they may well have
 * been our own connection rather than the image host. Without this, a laptop
 * that lost wifi for a minute would show placeholders for the next half hour.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    failedUrls.clear();
    persistFailures();
  });
}

export class ImageManager {
  private static MEDIA_DIR = 'media_cache';

  /**
   * True when this URL failed recently enough that trying again would only
   * stall the UI and spam the console.
   */
  static isKnownUnreachable(url: string): boolean {
    if (!url) return false;
    // The failure cache is only meaningful in Tauri where the native HTTP
    // fetcher can hang silently for many seconds. In the browser the network
    // stack handles retries on its own, so skip this entirely.
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
    if (!isTauri) return false;
    loadFailures();
    const failedAt = failedUrls.get(url);
    if (failedAt === undefined) return false;
    if (Date.now() - failedAt >= FAILURE_TTL_MS) {
      failedUrls.delete(url);
      persistFailures();
      return false;
    }
    return true;
  }

  /** Record a URL as unreachable so the next render skips it (Tauri only). */
  static markUnreachable(url: string) {
    if (!url) return;
    // Only track failures inside Tauri where native HTTP fetches can silently
    // stall the UI. In a browser the network layer already handles this.
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
    if (!isTauri) return;
    loadFailures();
    failedUrls.set(url, Date.now());
    persistFailures();
  }

  /** Clear the skip list - used by the manual "retry images" action. */
  static clearUnreachable() {
    failedUrls.clear();
    persistFailures();
  }

  /**
   * Initializes the media directory if it doesn't exist.
   */
  private static async ensureDir() {
    try {
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
      if (!isTauri) return;

      const { exists, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs');

      const mediaDirExists = await exists(this.MEDIA_DIR, { baseDir: BaseDirectory.AppData });
      if (!mediaDirExists) {
        await mkdir(this.MEDIA_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
      }
    } catch (err) {
      console.error('Failed to ensure media directory:', err);
    }
  }

  /**
   * Sanitize a URL to use as a filename
   */
  private static getFilename(url: string): string {
    try {
      // Generate a simple hash-like string from URL
      const hash = btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
      const extension = url.split('.').pop()?.split('?')[0] || 'png';
      return `${hash}.${extension}`;
    } catch (e) {
      return `img_${Date.now()}.png`;
    }
  }

  /**
   * Gets a local URI for an external image URL.
   * If the image isn't cached, it downloads it first.
   *
   * Throws when the image is unreachable, so the caller can show a placeholder
   * rather than handing a known-dead URL to the webview to time out on again.
   */
  static async getLocalUri(url: string): Promise<string> {
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
    if (!isTauri || !url || !url.startsWith('http')) return url;

    if (this.isKnownUnreachable(url)) {
      throw new Error(`Image host unreachable (cached failure): ${url}`);
    }

    try {
      const { exists, writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const { fetch } = await import('@tauri-apps/plugin-http');
      const { join, appDataDir } = await import('@tauri-apps/api/path');
      const { convertFileSrc } = await import('@tauri-apps/api/core');

      await this.ensureDir();
      const filename = this.getFilename(url);
      const filePath = await join(this.MEDIA_DIR, filename);

      const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });

      if (fileExists) {
        const appData = await appDataDir();
        const fullPath = await join(appData, filePath);
        return convertFileSrc(fullPath);
      }

      // Download the image, bounded so a silent host cannot hold the row hostage.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const unit8Array = new Uint8Array(arrayBuffer);

      await writeFile(filePath, unit8Array, { baseDir: BaseDirectory.AppData });

      const appData = await appDataDir();
      const fullPath = await join(appData, filePath);
      return convertFileSrc(fullPath);

    } catch (err) {
      this.markUnreachable(url);
      console.warn('Image unavailable, showing placeholder instead:', url);
      throw err;
    }
  }
}
