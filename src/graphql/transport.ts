// The GraphQL transport: one POST per operation to the backend's single endpoint (mgpl-diagnostics/api).
import type { SessionManager } from "./session";

export interface GraphQLClientOptions {
  /** The endpoint: "/graphql" (same origin) or "https://api.your-lab.in/graphql". */
  url?: string;
  /** Custom fetch (tests, SSR, retry wrappers). */
  fetch?: typeof fetch;
  /**
   * The session manager (tokens, refresh, device signals). The GraphQL client creates one in memory
   * when you don't pass it; pass your own for persistence, cross-tab sync or sharing with other libraries.
   */
  session?: SessionManager;
  /** Starting access token (without a session manager, or to seed the default one). */
  token?: string | null;
  /** Called whenever the access token changes (login, refresh, logout). */
  onToken?: (token: string | null) => void;
  /** Extra headers on every request. */
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  /** e.g. "include" when the API sits behind a cookie-forwarding proxy. */
  credentials?: RequestCredentials;
}

/** One GraphQL error as the server sends it. `code` is the stable part (see the API's docs/05-errors.md). */
export interface GraphQLErrorItem {
  message: string;
  path?: (string | number)[];
  extensions?: { code?: string; [key: string]: unknown };
}

/**
 * Thrown when a response carries errors (or the HTTP request fails). `code` is the first error's
 * code: UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, BAD_USER_INPUT, PERIOD_LOCKED, … .
 */
export class MgplGraphQLError extends Error {
  readonly code: string;
  constructor(
    message: string,
    readonly errors: GraphQLErrorItem[],
    readonly status: number,
    /** Whatever data came back next to the errors. */
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "MgplGraphQLError";
    this.code = errors[0]?.extensions?.code ?? (status >= 500 ? "INTERNAL_SERVER_ERROR" : "NETWORK_ERROR");
  }
}

export type Variables = Record<string, unknown>;

export function createTransport(opts: GraphQLClientOptions = {}) {
  const url = opts.url ?? "/graphql";
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const session = opts.session;
  let token: string | null = opts.token ?? null;

  async function once<T>(query: string, variables: Variables | undefined, init: { signal?: AbortSignal }): Promise<T> {
      const headers = new Headers(typeof opts.headers === "function" ? await opts.headers() : opts.headers);
      headers.set("content-type", "application/json");
      headers.set("accept", "application/graphql-response+json, application/json");
      const bearer = session ? await session.accessToken() : token;
      if (bearer) headers.set("authorization", `Bearer ${bearer}`);
      let res: Response;
      try {
        res = await doFetch(url, { method: "POST", headers, credentials: opts.credentials, body: JSON.stringify({ query, variables }), signal: init.signal });
      } catch (e) {
        throw new MgplGraphQLError((e as Error).message || "Network error", [], 0);
      }
      let body: { data?: T | null; errors?: GraphQLErrorItem[] } | undefined;
      try {
        body = (await res.json()) as typeof body;
      } catch {
        throw new MgplGraphQLError(`${res.status} ${res.statusText}`.trim(), [], res.status);
      }
      if (body?.errors?.length) throw new MgplGraphQLError(body.errors.map((e) => e.message).join("; "), body.errors, res.status, body.data);
      if (!res.ok || body?.data == null) throw new MgplGraphQLError(`${res.status} ${res.statusText}`.trim(), [], res.status);
      return body.data;
  }

  return {
    url,
    session,
    getToken: () => (session ? (session.current()?.accessToken ?? null) : token),
    /** Sets (or clears) the access token by hand. With a session manager, prefer session.signIn. */
    setToken(next: string | null) {
      if (session) {
        if (next) session.signIn({ ...session.current(), accessToken: next });
        else session.signOut("logout");
      } else {
        token = next;
        opts.onToken?.(next);
      }
    },
    /**
     * Runs any operation. Throws MgplGraphQLError on errors; returns `data` otherwise. With a session,
     * an UNAUTHENTICATED answer triggers one refresh and one retry.
     */
    async request<T = unknown>(query: string, variables?: Variables, init: { signal?: AbortSignal } = {}): Promise<T> {
      try {
        return await once<T>(query, variables, init);
      } catch (e) {
        if (session && e instanceof MgplGraphQLError && e.code === "UNAUTHENTICATED" && session.current()?.refreshToken && (await session.refresh())) {
          return once<T>(query, variables, init);
        }
        throw e;
      }
    },
  };
}

export type Transport = ReturnType<typeof createTransport>;
