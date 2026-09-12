/**
 * Minimal Chrome DevTools Protocol client.
 *
 * Deliberately dependency-free: Node 22 ships a global `WebSocket` and `fetch`,
 * so the recorder needs nothing added to package.json. That matters because the
 * whole point of this tool is to observe the app without touching it — a
 * Playwright install would drag in a second browser build and a lockfile change
 * for something Chrome already does natively.
 *
 * We connect straight to the *page* target's socket rather than the browser
 * endpoint, which means no session routing: every message here is already
 * scoped to the one tab we are recording.
 */

export async function listTargets(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!res.ok) throw new Error(`CDP /json/list returned ${res.status}`);
  return res.json();
}

/** Poll until Chrome's debugging endpoint is up (it binds a moment after spawn). */
export async function waitForEndpoint(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const targets = await listTargets(port);
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Chrome debugging port ${port} never came up: ${lastErr?.message ?? 'no page target'}`);
}

export class Cdp {
  #ws;
  #next = 1;
  #pending = new Map();
  #listeners = new Map();
  #closed = false;
  #reason = null;

  static async attach(wsUrl) {
    const cdp = new Cdp();
    await cdp.#open(wsUrl);
    return cdp;
  }

  /** True once the socket is gone. Polling loops check this so they can stop. */
  get closed() {
    return this.#closed;
  }

  /**
   * Why the socket went away, in words, or null while it is healthy.
   *
   * Worth keeping rather than reconstructing later: when the browser dies
   * mid-flow, every subsequent `send` rejects identically, so the only place the
   * *cause* is still available is the close event itself. Without this the
   * failure surfaced as "never navigated to /sales/pos/review" — a selector-shaped
   * error message for a dead browser, which sends you looking at the flow script
   * instead of at Chrome.
   */
  get closeReason() {
    return this.#reason;
  }

  #die(reason) {
    if (this.#closed && this.#reason) return;
    this.#closed = true;
    this.#reason = reason;
    for (const { reject: rj, method } of this.#pending.values()) {
      rj(new Error(`CDP closed before ${method}: ${reason}`));
    }
    this.#pending.clear();
  }

  #open(wsUrl) {
    return new Promise((resolve, reject) => {
      // Chrome caps frames at 1MB by default; screencast JPEGs stay well under
      // that, but base64 of a 1080p frame is ~250KB so the default is fine.
      this.#ws = new WebSocket(wsUrl);
      this.#ws.addEventListener('open', () => resolve());
      this.#ws.addEventListener('error', (e) => reject(new Error(`CDP socket error: ${e.message ?? 'unknown'}`)));
      this.#ws.addEventListener('close', (ev) => {
        // 1006 is an abnormal close with no close frame — what you get when the
        // process on the other end is gone rather than shutting down politely, so
        // it is worth naming as such instead of printing a bare code.
        const code = ev?.code ?? 0;
        this.#die(
          code === 1006
            ? 'the browser exited or was killed (abnormal socket close)'
            : `socket closed (code ${code}${ev?.reason ? `: ${ev.reason}` : ''})`,
        );
      });
      this.#ws.addEventListener('message', (ev) => this.#dispatch(ev.data));
    });
  }

  #dispatch(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.id !== undefined) {
      const slot = this.#pending.get(msg.id);
      if (!slot) return;
      this.#pending.delete(msg.id);
      if (msg.error) slot.reject(new Error(`${slot.method}: ${msg.error.message}`));
      else slot.resolve(msg.result);
      return;
    }
    const fns = this.#listeners.get(msg.method);
    if (fns) for (const fn of [...fns]) fn(msg.params ?? {});
  }

  send(method, params = {}) {
    if (this.#closed) {
      return Promise.reject(new Error(`CDP closed before ${method}: ${this.#reason ?? 'unknown reason'}`));
    }
    const id = this.#next++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method });
      this.#ws.send(payload);
    });
  }

  on(event, fn) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(fn);
    return () => this.#listeners.get(event)?.delete(fn);
  }

  once(event) {
    return new Promise((resolve) => {
      const off = this.on(event, (p) => {
        off();
        resolve(p);
      });
    });
  }

  close() {
    this.#die('closed by the recorder');
    try {
      this.#ws.close();
    } catch {
      /* already gone */
    }
  }
}
