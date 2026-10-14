// Helpers for data-fetching libraries, with no dependency on any of them. They return plain objects
// and functions that fit TanStack Query (React, Vue, Svelte, Solid, Angular), SWR, RTK Query, or your own.
//
//   TanStack Query:  useQuery(mgplQuery(client, "invoices", { limit: 20 }))
//                    useMutation(mgplMutation(client, "issueInvoice"))
//                    clearOnSignOut(client.session, queryClient)
//   SWR:             useSWR(mgplKey("invoices", { limit: 20 }), mgplFetcher(client))
import { OPERATIONS, type OperationName } from "./operations";
import type { SessionManager } from "./session";
import type { Variables } from "./transport";

/** What these helpers need from the GraphQL client. */
export interface RequestClient {
  request<T = unknown>(query: string, variables?: Variables, init?: { signal?: AbortSignal }): Promise<T>;
}

/** The cache key of an operation: ["mgpl", name, variables]. Invalidate ["mgpl"] to refetch everything. */
export const mgplKey = (name: OperationName, variables: Variables = {}) => ["mgpl", name, variables] as const;

/** Runs an operation by name and returns its root field. */
export async function runOperation<R = unknown>(client: RequestClient, name: OperationName, variables?: Variables, signal?: AbortSignal): Promise<R> {
  const op = OPERATIONS[name];
  const data = await client.request<Record<string, unknown>>(op.document, variables, { signal });
  return data[op.field] as R;
}

/** `{ queryKey, queryFn }` for any query-style library (TanStack Query's useQuery / queryOptions). */
export function mgplQuery<R = unknown>(client: RequestClient, name: OperationName, variables: Variables = {}) {
  return {
    queryKey: mgplKey(name, variables),
    queryFn: ({ signal }: { signal?: AbortSignal } = {}) => runOperation<R>(client, name, variables, signal),
  };
}

/** `{ mutationKey, mutationFn }` (TanStack Query's useMutation). */
export function mgplMutation<R = unknown, V extends Variables = Variables>(client: RequestClient, name: OperationName) {
  return { mutationKey: ["mgpl", name] as const, mutationFn: (variables: V) => runOperation<R>(client, name, variables) };
}

/** A fetcher for key-based libraries (SWR): key = mgplKey(name, variables). */
export const mgplFetcher =
  (client: RequestClient) =>
  <R = unknown>(key: readonly [string, OperationName, Variables?]) =>
    runOperation<R>(client, key[1], key[2]);

/** Clears a query cache (anything with `clear()`, e.g. TanStack's QueryClient) when the session ends. */
export function clearOnSignOut(session: SessionManager, cache: { clear(): void }): () => void {
  let was = session.getSnapshot().status;
  return session.subscribe((s) => {
    if (was === "signed_in" && s.status === "signed_out") cache.clear();
    was = s.status;
  });
}
