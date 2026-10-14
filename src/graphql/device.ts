// Device signals for login and refresh: a device id, a coarse fingerprint, a per-tab session id and a
// few descriptive values. Self-contained (no imports) so it can move to security-kit unchanged.
// Works in browsers, React Native, workers and Node: every source is optional and feature-detected.
//
// What is collected (and nothing else):
//   deviceId         random id created once, kept in localStorage (or your store): NOT derived from the device
//   clientSessionId  random id per tab (sessionStorage) or per app run
//   fingerprint      SHA-256 of the `info` values below (no canvas, audio or font probing)
//   info             platform, language(s), timezone, screen size, colour depth, pixel ratio, CPU cores,
//                    device memory, touch points, user agent (trimmed)

export interface DeviceSignals {
  deviceId?: string;
  fingerprint?: string;
  clientSessionId?: string;
  info?: Record<string, string | number | boolean>;
}

/** Where the device id and tab id live. Defaults: localStorage / sessionStorage when present, else memory. */
export interface DeviceStore {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): void | Promise<void>;
}

export interface DeviceOptions {
  /** Keeps the device id (default: localStorage, else memory: a new id per run). */
  store?: DeviceStore;
  /** Keeps the per-tab id (default: sessionStorage, else memory). */
  tabStore?: DeviceStore;
  /** Your own values (app version, native device model, …); merged into `info`. */
  extraInfo?: () => Record<string, string | number | boolean> | Promise<Record<string, string | number | boolean>>;
  /** Leave values out of `info` (and so out of the fingerprint), e.g. ["userAgent"]. */
  exclude?: string[];
}

export interface DeviceCollector {
  /** The signals, collected once and cached (the tab id is stable for the tab's life). */
  get(): Promise<DeviceSignals>;
}

const g = globalThis as any;

function memoryStore(): DeviceStore {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
}

function webStore(name: "localStorage" | "sessionStorage"): DeviceStore | null {
  try {
    const s: Storage | undefined = g[name];
    if (!s) return null;
    const probe = "__mgpl_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return { get: (k) => s.getItem(k), set: (k, v) => s.setItem(k, v) };
  } catch {
    return null; // private mode, sandboxed iframe, SSR
  }
}

/** A random URL-safe id (crypto.randomUUID or getRandomValues). */
export function randomId(prefix = ""): string {
  if (typeof g.crypto?.randomUUID === "function") return prefix + g.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof g.crypto?.getRandomValues === "function") g.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return prefix + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The descriptive values a browser (or runtime) exposes. Missing ones are left out. */
export function deviceInfo(): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const put = (k: string, v: unknown) => {
    if (typeof v === "string" && v) out[k] = v.slice(0, 200);
    else if ((typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean") out[k] = v;
  };
  const nav = g.navigator;
  put("platform", nav?.userAgentData?.platform || nav?.platform);
  put("mobile", nav?.userAgentData?.mobile);
  put("language", nav?.language);
  put("languages", Array.isArray(nav?.languages) ? nav.languages.slice(0, 5).join(",") : undefined);
  try {
    put("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    /* no Intl */
  }
  put("screen", g.screen ? `${g.screen.width}x${g.screen.height}` : undefined);
  put("colorDepth", g.screen?.colorDepth);
  put("pixelRatio", g.devicePixelRatio);
  put("cores", nav?.hardwareConcurrency);
  put("memoryGb", nav?.deviceMemory);
  put("touchPoints", nav?.maxTouchPoints);
  put("userAgent", nav?.userAgent);
  return out;
}

const b64url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** SHA-256 of the info values, base64url (43 characters); undefined where WebCrypto is missing. */
export async function fingerprintOf(info: Record<string, string | number | boolean>): Promise<string | undefined> {
  const subtle = g.crypto?.subtle;
  if (!subtle || typeof TextEncoder === "undefined") return undefined;
  const text = JSON.stringify(Object.keys(info).sort().map((k) => [k, info[k]]));
  return b64url(new Uint8Array(await subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

/** Collects the signals the SDK sends with login and refresh. */
export function createDeviceCollector(o: DeviceOptions = {}): DeviceCollector {
  const store = o.store ?? webStore("localStorage") ?? memoryStore();
  const tabStore = o.tabStore ?? webStore("sessionStorage") ?? memoryStore();
  let cached: Promise<DeviceSignals> | undefined;
  const idFrom = async (s: DeviceStore, key: string, prefix: string) => {
    const have = await s.get(key);
    if (have && /^[A-Za-z0-9_.:+/=-]{8,128}$/.test(have)) return have;
    const id = randomId(prefix);
    await s.set(key, id);
    return id;
  };
  return {
    get() {
      return (cached ??= (async () => {
        const info = { ...deviceInfo(), ...((await o.extraInfo?.()) ?? {}) };
        for (const k of o.exclude ?? []) delete info[k];
        return {
          deviceId: await idFrom(store, "mgpl.deviceId", "dev-"),
          clientSessionId: await idFrom(tabStore, "mgpl.tabId", "tab-"),
          fingerprint: await fingerprintOf(info),
          info,
        };
      })().catch((e) => {
        cached = undefined;
        throw e;
      }));
    },
  };
}
