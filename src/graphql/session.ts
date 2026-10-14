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
import { MgplGraphQLError, type GraphQLErrorItem } from "./transport";
import type { LoginResult, User } from "./types";

/** What the manager keeps. Only the access token is required (e.g. a token from elsewhere). */
export interface StoredSession {
  accessToken: string;
  accessExpiresAt?: string | null;
  refreshToken?: string | null;
  refreshExpiresAt?: string | null;
  user?: User | null;
}

/**
 * Where the tokens live. Memory (default) is the safest in a browser; localStorage survives reloads
 * and syncs tabs but is readable by any script on the page (XSS). Your choice; implement your own for
 * React Native (SecureStore / Keychain), Electron, cookies via your server, …
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
      return v && typeof v.accessToken === "string" ? v : null;
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
  getSnapshot(): SessionSnapshot;
  /** Calls `listener` with each new snapshot; returns the unsubscribe function. */
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
  /** Svelte-style readable store: calls `run` at once and on every change. */
  readonly store: { subscribe(run: (snapshot: SessionSnapshot) => void): () => void };
  /** A valid access token, refreshed first when it is about to expire; null when signed out. */
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
  /** `{ authorization: "Bearer …" }` (refreshed first when needed), or {}: for clients that take headers. */
  headers(): Promise<Record<string, string>>;
  /**
   * A fetch that adds the access token and, on UNAUTHENTICATED, refreshes once and retries. Give it
   * to Apollo (HttpLink fetch), urql (fetch), graphql-request, ky, axios adapters, or call it directly.
   */
  fetch: typeof fetch;
}

const REFRESH = OPERATIONS.refreshSession.document;
const LOCK = "mgpl-session-refresh";

const toStored = (r: LoginResult | StoredSession): StoredSession =>
  "refreshToken" in r && "accessExpiresAt" in r
    ? { accessToken: r.accessToken, accessExpiresAt: r.accessExpiresAt ?? null, refreshToken: r.refreshToken ?? null, refreshExpiresAt: r.refreshExpiresAt ?? null, user: r.user ?? null }
    : (r as StoredSession);

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
  const refreshDead = (v: StoredSession) => !v.refreshToken || (!!v.refreshExpiresAt && Date.parse(v.refreshExpiresAt) <= Date.now());

  function signOut(reason: SignOutReason = "logout") {
    const had = !!storage.get();
    save(null);
    if (had) o.onSignedOut?.(reason);
  }

  async function runRefresh(): Promise<boolean> {
    const before = storage.get();
    if (!before?.refreshToken) return false;
    const work = async (): Promise<boolean> => {
      // another tab may have refreshed while we waited for the lock: use its tokens
      const cur = storage.get();
      if (!cur) return false;
      if (cur.refreshToken !== before.refreshToken && !expiresSoon(cur)) {
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
          headers: { "content-type": "application/json", accept: "application/graphql-response+json, application/json", ...o.headers },
          body: JSON.stringify({ query: REFRESH, variables: { refreshToken: cur.refreshToken, device: device ? await device.get().catch(() => undefined) : undefined } }),
        });
      } catch (e) {
        throw new MgplGraphQLError((e as Error).message || "Network error", [], 0); // offline: keep the session
      }
      const body = (await res.json().catch(() => null)) as { data?: { refreshSession?: LoginResult } | null; errors?: GraphQLErrorItem[] } | null;
      const pair = body?.data?.refreshSession;
      if (pair) {
        save(toStored(pair));
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
      if (expiresSoon(v) && v.refreshToken) {
        await manager.refresh();
        return storage.get()?.accessToken ?? null;
      }
      return v.accessToken;
    },
    refresh() {
      return (inflight ??= runRefresh().finally(() => (inflight = undefined)));
    },
    signIn(result) {
      save(toStored(result));
    },
    signOut,
    current: () => storage.get(),
    async device() {
      return device ? device.get().catch(() => undefined) : undefined;
    },
    async headers(): Promise<Record<string, string>> {
      const t = await manager.accessToken();
      return t ? { authorization: `Bearer ${t}` } : {};
    },
    async fetch(input, init) {
      const send = async () => {
        const headers = new Headers(init?.headers);
        const t = await manager.accessToken();
        if (t) headers.set("authorization", `Bearer ${t}`);
        return doFetch(input, { ...init, headers });
      };
      const res = await send();
      if (storage.get()?.refreshToken && (await isUnauthenticated(res)) && (await manager.refresh())) return send();
      return res;
    },
  };
  return manager;
}
