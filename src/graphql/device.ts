// Device signals for login and refresh, collected by @mgpl-diagnostics/security-kit (bundled into this
// package at build time, so the SDK keeps zero runtime dependencies). This module maps security-kit's
// signals to the API's DeviceInput; the GraphQL contract is unchanged.
// Works in browsers, React Native, workers and Node: every source is optional and feature-detected.
//
// What is collected (and nothing else):
//   deviceId         random id created once, kept in localStorage (or your store): NOT derived from the device
//   clientSessionId  random id per tab (sessionStorage) or per app run
//   fingerprint      SHA-256 (32 hex) of coarse attributes: OS, browser family, mobile, platform, language,
//                    timezone, screen size, colour depth, CPU cores, device memory, touch points
//   info             os, browser, browserVersion (major), mobile, language, timezone, screen
//                    (no canvas, audio or font probing, no full user agent)
import {
  createSignalCollector,
  deviceInfo as signalDeviceInfo,
  randomId as signalRandomId,
  toBase64Url,
  webStorage,
} from "@mgpl-diagnostics/security-kit/browser";

export interface DeviceSignals {
  deviceId?: string;
  fingerprint?: string;
  clientSessionId?: string;
  info?: Record<string, string | number | boolean>;
}

/** Where the device id and tab id live. Defaults: localStorage / sessionStorage when present, else memory. */
export interface DeviceStore {
  get(key: string): string | null | undefined | Promise<string | null | undefined>;
  set(key: string, value: string): void | Promise<void>;
  remove?(key: string): void | Promise<void>;
}

/**
 * A security-kit collector (`createSignalCollector` from "@mgpl-diagnostics/security-kit/browser"), to
 * share one collector between this SDK and the rest of the app. Only the parts used here.
 */
export interface SignalSource {
  collect(): Promise<{
    deviceId: string;
    tabId: string;
    fingerprint: string;
    device: { os: string; browser: string; browserVersion: string; mobile: boolean; language: string; timezone: string; screen: string };
    app?: string;
  }>;
}

export interface DeviceOptions {
  /** Keeps the device id (default: localStorage, else memory: a new id per run). */
  store?: DeviceStore;
  /** Keeps the per-tab id (default: sessionStorage, else memory). */
  tabStore?: DeviceStore;
  /** Your own values (app version, native device model, …); merged into `info`. */
  extraInfo?: () => Record<string, string | number | boolean> | Promise<Record<string, string | number | boolean>>;
  /** Leave values out of `info`, e.g. ["screen"]. */
  exclude?: string[];
  /** Use this security-kit collector instead of creating one (`store` / `tabStore` are then ignored). */
  signals?: SignalSource;
}

export interface DeviceCollector {
  /** The signals, collected once and cached (the tab id is stable for the tab's life). */
  get(): Promise<DeviceSignals>;
}

/** A random URL-safe id (128 bits, base64url). */
export function randomId(prefix = ""): string {
  return prefix + signalRandomId();
}

/** The descriptive values sent as `info` (security-kit's coarse device info). */
export function deviceInfo(): Record<string, string | number | boolean> {
  return { ...signalDeviceInfo() };
}

/** SHA-256 of the info values, base64url (43 characters); undefined where WebCrypto is missing. */
export async function fingerprintOf(info: Record<string, string | number | boolean>): Promise<string | undefined> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle || typeof TextEncoder === "undefined") return undefined;
  const text = JSON.stringify(Object.keys(info).sort().map((k) => [k, info[k]]));
  return toBase64Url(new Uint8Array(await subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

/** Collects the signals the SDK sends with login and refresh. */
export function createDeviceCollector(o: DeviceOptions = {}): DeviceCollector {
  // same storage keys as before (mgpl.deviceId, mgpl.tabId), so existing devices keep their ids
  const signals = o.signals ?? createSignalCollector({ storage: o.store ?? webStorage("local"), tabStorage: o.tabStore ?? webStorage("session") });
  let cached: Promise<DeviceSignals> | undefined;
  return {
    get() {
      return (cached ??= (async () => {
        const s = await signals.collect();
        const info: Record<string, string | number | boolean> = { ...s.device, ...(s.app ? { app: s.app } : {}), ...((await o.extraInfo?.()) ?? {}) };
        for (const k of o.exclude ?? []) delete info[k];
        return { deviceId: s.deviceId, clientSessionId: s.tabId, fingerprint: s.fingerprint, info };
      })().catch((e) => {
        cached = undefined;
        throw e;
      }));
    },
  };
}
