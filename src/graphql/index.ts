// "@mgpl-diagnostics/client/graphql": the GraphQL SDK with every type flat.
// The main entry re-exports the client and helpers too, with these types under the `Gql` namespace.
export { createMgplGraphQLClient, documentBlob, csvBlob, type MgplGraphQLClient } from "./client";
export { createTransport, MgplGraphQLError, type GraphQLClientOptions, type GraphQLErrorItem, type Transport, type Variables } from "./transport";
export { OPERATIONS, FRAGMENTS, withFragments, type Operation, type OperationName } from "./operations";
export type * from "./types";
