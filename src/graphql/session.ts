// The session manager: keeps the access and refresh tokens, refreshes them before they expire (once,
// even with many tabs and parallel requests), and tells any UI library when the session changes.
// Framework-agnostic and dependency-free:
//   - React:            useSyncExternalStore(session.subscribe, session.getSnapshot)  (or useMgplSession)
//   - Svelte:           session.store is a readable store ($session.store)
//   - Vue / Solid / …:  session.subscribe(snapshot => …)
//   - TanStack Query, SWR: see "./query"
//   - Apollo, urql, graphql-request, plain fetch: pass `session.fetch` as their fetch
import type { DeviceCollector, DeviceSignals } from "./device";
import { createDeviceCollector } from "./device";
import { OPERATIONS } from "./operations";
import { AUTH_MODE_HEADER, MgplGraphQLError, type GraphQLErrorItem } from "./transport";
import type { LoginResult, User } from "./types";

/**
 * What the manager keeps. Bearer mode needs the access token (e.g. a token from elsewhere). Cookie mode
 * (`cookies: true`) keeps no token at all: the api holds them in httpOnly cookies, and this only
 * remembers that a session exists, when it expires and who it is.
 */
export interface StoredSession {
  accessToken?: string | null;
  /** A cookie session: the tokens are httpOnly cookies the page cannot read. */
  cookie?: boolean;
  accessExpiresAt?: string | null;
  refreshToken?: string | null;
  refreshExpiresAt?: string | null;
  user?: User | null;
}

/**
 * Where the session lives. In a browser, use cookie mode (`cookies: true`): the tokens stay in httpOnly
 * cookies and the storage holds only expiry times and the user, so localStorage is fine there. In bearer
 * mode, memory (default) is the safest; localStorage would hold the tokens where any script on the page
 * can read them (XSS). Implement your own for React Native (SecureStore / Keychain), Electron, …
 */
export interface SessionStorage {
  get(): StoredSession | null;
  set(value: StoredSession | null): void;
  /** Changes made elsewhere (another tab). Optional. */
  subscribe?(listener: (value: StoredSession | null) => void): () => void;
}

export function memorySessionStorage(initial: StoredSession | null = null): SessionStorage {
  let value = initial;
  return { get: () => value, set: (v) => void (value = v) };
}

/** localStorage (default) or sessionStorage, synced across tabs with the `storage` event. */
export function webSessionStorage(o: { key?: string; storage?: Storage } = {}): SessionStorage {
  const key = o.key ?? "mgpl.session";
  const storage = o.storage ?? (globalThis as { localStorage?: Storage }).localStorage;
  if (!storage) return memorySessionStorage();
  const read = (raw: string | null): StoredSession | null => {
    try {
      const v = raw ? (JSON.parse(raw) as StoredSession) : null;
      return v && (typeof v.accessToken === "string" || v.cookie === true) ? v : null;
    } catch {
      return null;
    }
  };
  return {
    get: () => read(storage.getItem(key)),
    set: (v) => (v ? storage.setItem(key, JSON.stringify(v)) : storage.removeItem(key)),
    subscribe(listener) {
      const w = globalThis as { addEventListener?: Window["addEventListener"]; removeEventListener?: Window["removeEventListener"] };
      if (!w.addEventListener) return () => {};
      const on = (e: StorageEvent) => e.key === key && listener(read(e.newValue));
      w.addEventListener("storage", on);
      return () => w.removeEventListener?.("storage", on);
    },
  };
}

export type SessionStatus = "signed_in" | "signed_out";
/** Why the session ended: the user logged out, the refresh token was refused, or it expired. */
export type SignOutReason = "logout" | "refresh_failed" | "expired";

/** An immutable snapshot (same object until something changes), safe for useSyncExternalStore. */
export interface SessionSnapshot {
  status: SessionStatus;
  user: User | null;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
}

export interface SessionManagerOptions {
  /** The API's GraphQL endpoint (used for refreshSession). Default "/graphql". */
  url?: string;
  /**
   * Cookie mode, for browsers (api 0.2+): every request carries `x-mgpl-auth: cookie` and credentials, the
   * api sets the tokens as httpOnly cookies, and no token ever reaches JavaScript or the storage.
   * Default false (bearer tokens, for Node.js, workers and native apps).
   */
  cookies?: boolean;
  fetch?: typeof fetch;
  /** Default: memory. */
  storage?: SessionStorage;
  /** Device signals sent with login and refresh. Default: createDeviceCollector(). false: send none. */
  device?: DeviceCollector | false;
  /** Refresh this long before the access token expires. Default 30 s. */
  refreshMarginMs?: number;
  /** Extra headers on the refresh request. */
  headers?: Record<string, string>;
  onSignedOut?: (reason: SignOutReason) => void;
}

export interface SessionManager {
  /** Cookie mode (`cookies: true`): no tokens on this side, the api keeps them in httpOnly cookies. */
  readonly cookies?: boolean;
  getSnapshot(): SessionSnapshot;
  /** Calls `listener` with each new snapshot; returns the unsubscribe function. */
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
  /** Svelte-style readable store: calls `run` at once and on every change. */
  readonly store: { subscribe(run: (snapshot: SessionSnapshot) => void): () => void };
  /** A valid access token, refreshed first when it is about to expire; null when signed out, and always null in cookie mode (it refreshes all the same). */
  accessToken(): Promise<string | null>;
  /** Trades the refresh token for a new pair (one request at a time across calls and tabs). True when it worked. */
  refresh(): Promise<boolean>;
  /** Keeps the tokens from login / refreshSession. */
  signIn(result: LoginResult | StoredSession): void;
  /** Forgets the tokens locally (call the API's logout first to end the session on the server). */
  signOut(reason?: SignOutReason): void;
  /** The current tokens (e.g. the refresh token for logout). */
  current(): StoredSession | null;
  /** Device signals for login (undefined when disabled). */
  device(): Promise<DeviceSignals | undefined>;
  /**
   * `{ authorization: "Bearer …" }` (refreshed first when needed), or {}: for clients that take headers.
   * Cookie mode: `{ "x-mgpl-auth": "cookie" }`; send the request with `credentials: "include"` too.
   */
  headers(): Promise<Record<string, string>>;
  /**
   * A fetch that adds the access token (cookie mode: the x-mgpl-auth header and credentials) and, on
   * UNAUTHENTICATED, refreshes once and retries. Give it
   * to Apollo (HttpLink fetch), urql (fetch), graphql-request, ky, axios adapters, or call it directly.
   */
  fetch: typeof fetch;
}

const REFRESH = OPERATIONS.refreshSession.document;
const LOCK = "mgpl-session-refresh";

const toStored = (r: LoginResult | StoredSession, cookies: boolean): StoredSession => {
  const v: StoredSession =
    "refreshToken" in r && "accessExpiresAt" in r
      ? { accessToken: r.accessToken, accessExpiresAt: r.accessExpiresAt ?? null, refreshToken: r.refreshToken ?? null, refreshExpiresAt: r.refreshExpiresAt ?? null, user: r.user ?? null }
      : (r as StoredSession);
  // cookie mode never keeps a token, even if a server without cookie support sent one
  return cookies ? { cookie: true, accessExpiresAt: v.accessExpiresAt ?? null, refreshExpiresAt: v.refreshExpiresAt ?? null, user: v.user ?? null } : v;
};

async function isUnauthenticated(res: Response): Promise<boolean> {
  if (res.status === 401) return true;
  if (!(res.headers.get("content-type") ?? "").includes("json")) return false;
  try {
    const body = (await res.clone().json()) as { errors?: GraphQLErrorItem[] };
    return !!body?.errors?.some((e) => e.extensions?.code === "UNAUTHENTICATED");
  } catch {
    return false;
  }
}

export function createSessionManager(o: SessionManagerOptions = {}): SessionManager {
  const url = o.url ?? "/graphql";
  const doFetch = o.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const cookies = o.cookies === true;
  const storage = o.storage ?? memorySessionStorage();
  const device = o.device === false ? null : (o.device ?? createDeviceCollector());
  const margin = o.refreshMarginMs ?? 30_000;
  const listeners = new Set<(s: SessionSnapshot) => void>();
  let snapshot: SessionSnapshot = snap(storage.get());
  let inflight: Promise<boolean> | undefined;

  function snap(v: StoredSession | null): SessionSnapshot {
    return { status: v ? "signed_in" : "signed_out", user: v?.user ?? null, accessExpiresAt: v?.accessExpiresAt ?? null, refreshExpiresAt: v?.refreshExpiresAt ?? null };
  }
  function emit(v: StoredSession | null) {
    const next = snap(v);
    if (next.status === snapshot.status && next.user === snapshot.user && next.accessExpiresAt === snapshot.accessExpiresAt && next.refreshExpiresAt === snapshot.refreshExpiresAt) return;
    snapshot = next;
    for (const l of [...listeners]) l(snapshot);
  }
  function save(v: StoredSession | null) {
    storage.set(v);
    emit(v);
  }
  // another tab signed in, refreshed or signed out
  storage.subscribe?.((v) => emit(v));

  const expiresSoon = (v: StoredSession) => !!v.accessExpiresAt && Date.parse(v.accessExpiresAt) - margin <= Date.now();
  const refreshDead = (v: StoredSession) => (!v.refreshToken && !v.cookie) || (!!v.refreshExpiresAt && Date.parse(v.refreshExpiresAt) <= Date.now());
  const canRefresh = (v: StoredSession | null) => !!v && (cookies ? !!v.cookie : !!v.refreshToken);
  // what changes on every refresh: the refresh token, or (cookie mode) the expiry the server sent
  const version = (v: StoredSession) => (v.cookie ? `${v.accessExpiresAt}|${v.refreshExpiresAt}` : v.refreshToken);

  function signOut(reason: SignOutReason = "logout") {
    const had = !!storage.get();
    save(null);
    if (had) o.onSignedOut?.(reason);
  }

  async function runRefresh(): Promise<boolean> {
    const before = storage.get();
    if (!canRefresh(before)) return false;
    const work = async (): Promise<boolean> => {
      // another tab may have refreshed while we waited for the lock: use its tokens
      const cur = storage.get();
      if (!cur) return false;
      if (version(cur) !== version(before!) && !expiresSoon(cur)) {
        emit(cur);
        return true;
      }
      if (refreshDead(cur)) {
        signOut("expired");
        return false;
      }
      let res: Response;
      try {
        res = await doFetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/graphql-response+json, application/json", ...o.headers, ...(cookies ? { [AUTH_MODE_HEADER]: "cookie" } : {}) },
          // cookie mode: no argument, the api reads the refresh cookie and sets new cookies
          ...(cookies ? { credentials: "include" as const } : {}),
          body: JSON.stringify({ query: REFRESH, variables: { refreshToken: cookies ? undefined : cur.refreshToken, device: device ? await device.get().catch(() => undefined) : undefined } }),
        });
      } catch (e) {
        throw new MgplGraphQLError((e as Error).message || "Network error", [], 0); // offline: keep the session
      }
      const body = (await res.json().catch(() => null)) as { data?: { refreshSession?: LoginResult } | null; errors?: GraphQLErrorItem[] } | null;
      const pair = body?.data?.refreshSession;
      if (pair) {
        save(toStored(pair, cookies));
        return true;
      }
      const code = body?.errors?.[0]?.extensions?.code;
      if (code === "INVALID_TOKEN" || code === "UNAUTHENTICATED") {
        signOut("refresh_failed");
        return false;
      }
      throw new MgplGraphQLError(body?.errors?.map((e) => e.message).join("; ") || `${res.status} ${res.statusText}`.trim(), body?.errors ?? [], res.status);
    };
    // one refresh across tabs (Web Locks), where the platform has them
    const locks = (globalThis as { navigator?: { locks?: { request(name: string, cb: () => Promise<boolean>): Promise<boolean> } } }).navigator?.locks;
    return locks ? locks.request(LOCK, work) : work();
  }

  const manager: SessionManager = {
    cookies,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    store: {
      subscribe(run) {
        run(snapshot);
        return manager.subscribe(run);
      },
    },
    async accessToken() {
      const v = storage.get();
      if (!v) return null;
      if (expiresSoon(v) && canRefresh(v)) {
        await manager.refresh();
        return storage.get()?.accessToken ?? null;
      }
      return v.accessToken ?? null;
    },
    refresh() {
      return (inflight ??= runRefresh().finally(() => (inflight = undefined)));
    },
    signIn(result) {
      save(toStored(result, cookies));
    },
    signOut,
    current: () => storage.get(),
    async device() {
      return device ? device.get().catch(() => undefined) : undefined;
    },
    async headers(): Promise<Record<string, string>> {
      const t = await manager.accessToken();
      if (cookies) return { [AUTH_MODE_HEADER]: "cookie" };
      return t ? { authorization: `Bearer ${t}` } : {};
    },
    async fetch(input, init) {
      const send = async () => {
        const headers = new Headers(init?.headers);
        const t = await manager.accessToken();
        if (cookies) {
          headers.set(AUTH_MODE_HEADER, "cookie");
          return doFetch(input, { credentials: "include", ...init, headers });
        }
        if (t) headers.set("authorization", `Bearer ${t}`);
        return doFetch(input, { ...init, headers });
      };
      const res = await send();
      if (canRefresh(storage.get()) && (await isUnauthenticated(res)) && (await manager.refresh())) return send();
      return res;
    },
  };
  return manager;
}
