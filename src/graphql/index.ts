// "@mgpl-diagnostics/client/graphql": the GraphQL SDK with every type flat.
// The main entry re-exports the client and helpers too, with these types under the `Gql` namespace.
export { createMgplGraphQLClient, documentBlob, csvBlob, type MgplGraphQLClient, type MgplGraphQLClientOptions } from "./client";
export {
  createSessionManager, memorySessionStorage, webSessionStorage,
  type SessionManager, type SessionManagerOptions, type SessionSnapshot, type SessionStatus, type SessionStorage, type SignOutReason, type StoredSession,
} from "./session";
export { createDeviceCollector, deviceInfo, fingerprintOf, randomId, type DeviceCollector, type DeviceOptions, type DeviceSignals, type DeviceStore } from "./device";
export { clearOnSignOut, mgplFetcher, mgplKey, mgplMutation, mgplQuery, runOperation, type RequestClient } from "./query";
export { createTransport, MgplGraphQLError, type GraphQLClientOptions, type GraphQLErrorItem, type Transport, type Variables } from "./transport";
export { OPERATIONS, FRAGMENTS, withFragments, type Operation, type OperationName } from "./operations";
export type * from "./types";
