'use client';

import { isMobileApp } from '@/lib/platform';

/**
 * Microphone capture, shared by the two support pages.
 *
 * Both pages had a byte-identical `startRecording` with a single catch block
 * that blamed "your browser" — wrong copy inside a packaged app, and a dead end
 * for the user. Keeping the acquisition and the error classification here means
 * the two call sites cannot drift apart again.
 */

export type MicErrorKind = 'denied' | 'notFound' | 'busy' | 'unsupported' | 'unknown';

export interface MicFailure {
  kind: MicErrorKind;
  /** i18n key for the toast title. */
  titleKey: string;
  /** i18n key for the toast body. */
  bodyKey: string;
  /** True when the user can fix this from system settings and retry. */
  recoverable: boolean;
}

/**
 * Ask for the microphone, then hand back a live stream.
 *
 * The throwaway warm-up request is deliberate and copies the barcode scanner:
 * inside an Android WebView the OS dialog is raised by the *first*
 * `getUserMedia` call, and doing it separately means a denial surfaces here
 * rather than halfway through MediaRecorder setup. Stopping the warm-up tracks
 * releases the device before the real capture claims it.
 */
export async function acquireMicStream(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    const err = new Error('getUserMedia is unavailable in this context');
    err.name = 'UnsupportedError';
    throw err;
  }

  try {
    const warmUp = await navigator.mediaDevices.getUserMedia({ audio: true });
    warmUp.getTracks().forEach(track => track.stop());
  } catch (err) {
    // Surface the real DOMException; describeMicError turns it into copy.
    throw err;
  }

  return navigator.mediaDevices.getUserMedia({ audio: true });
}

/** Map a getUserMedia rejection onto the `errors.*` catalog keys. */
export function describeMicError(err: unknown): MicFailure {
  const name = (err as { name?: string } | null)?.name ?? '';

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        kind: 'denied',
        titleKey: 'errors.micDeniedTitle',
        // A packaged app has no site permission UI, so point at the OS instead.
        bodyKey: isMobileApp() ? 'errors.micDeniedApp' : 'errors.micDeniedBrowser',
        recoverable: true,
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        kind: 'notFound',
        titleKey: 'errors.micNotFoundTitle',
        bodyKey: 'errors.micNotFoundBody',
        recoverable: true,
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        kind: 'busy',
        titleKey: 'errors.micBusyTitle',
        bodyKey: 'errors.micBusyBody',
        recoverable: true,
      };
    case 'SecurityError':
    case 'TypeError':
    case 'UnsupportedError':
      return {
        kind: 'unsupported',
        titleKey: 'errors.micUnsupportedTitle',
        bodyKey: 'errors.micUnsupportedBody',
        recoverable: false,
      };
    default:
      return {
        kind: 'unknown',
        titleKey: 'errors.micDeniedTitle',
        bodyKey: isMobileApp() ? 'errors.micDeniedApp' : 'errors.micDeniedBrowser',
        recoverable: true,
      };
  }
}

/**
 * Best available container for MediaRecorder on this device.
 *
 * Android WebView and iOS WKWebView disagree here, so probe rather than assume;
 * an unsupported mimeType makes the MediaRecorder constructor throw.
 */
export function pickAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) ?? 'audio/webm';
}
