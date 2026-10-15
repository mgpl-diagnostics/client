# AGENTS.md — @mgpl-diagnostics/client

Instructions for AI coding agents and developers.

## What this is

The **frontend** SDK for the MGPL Diagnostics backend: the GraphQL API of **mgpl-diagnostics/api** (one
endpoint, `POST /graphql`, for everything) and the HTTP API of `createMgplApi()` (invoice-kit) /
`createReportApi()` (report-kit). It is **headless and has zero dependencies**: a typed `fetch` client,
browser helpers, and optional **unstyled** React hooks. All rendering (reports, invoices, PDFs) happens on
the backend. Apps build their own UI/UX on top.

## Rules

1. **No runtime dependencies.** Not even React in the main entry; React is an optional peer used only by `src/react.tsx`.
   `@mgpl-diagnostics/security-kit` is a dev dependency **bundled into dist** (`noExternal` in `tsup.config.ts`);
   public types must not import from it (`SignalSource` is structural).
2. **No UI.** No styled components, no CSS, no layout decisions. `HtmlFrame` is a bare iframe that
   accepts `className`/`style`. If you feel the need for a component with looks, it belongs in the app.
3. **The contract is mirrored, not imported.** `src/types.ts` mirrors report-kit's `src/shared/api.ts` /
   `types.ts` and invoice-kit's `api.ts`. Never import from the backend kits (that would pull the PDF
   engine into browsers). report-studio's `contract-check.ts` type-checks both sides; update them together.
4. **GraphQL operations are plain strings** in `src/graphql/operations.ts` (no GraphQL library). Their
   selections match `src/graphql/types.ts`. mgpl-diagnostics/api validates every operation against its
   schema and checks that every root field has one; when the API adds or renames a field, update
   `operations.ts`, `types.ts` and `client.ts` here, release, then bump the client ref in api's `kits.json`.
5. **Routes** are in `ROUTES` in `src/index.ts` and must match report-kit `src/shared/api.ts` + invoice-kit `INVOICE_ROUTES`.
6. **Sessions stay library-agnostic.** No data or state library is imported: adapters return plain objects
   and functions (`{ queryKey, queryFn }`, a `fetch`, `subscribe`/`getSnapshot`). Device signals are listed in
   docs/session.md; collect nothing new without adding it there (no canvas, audio or font probing).
7. `src/react.tsx` gets a `"use client"` banner from tsup (see `tsup.config.ts`); the main entry must not,
   so it stays usable from Server Components, workers and Node scripts.

## Map

```
src/types.ts    contract types (Patient, ReportRequest, TemplateCatalog, InvoiceInput, InvoiceTotals, …)
src/index.ts    createMgplClient (reports.*, invoices.*, health, url), MgplApiError, ROUTES, downloadBlob/openBlob/printBlob
src/graphql/
  transport.ts  createTransport (POST, Bearer from the session, one refresh + retry on UNAUTHENTICATED), MgplGraphQLError
  session.ts    createSessionManager (tokens, single-flight refresh, Web Locks, subscribe/getSnapshot/store, fetch), storages
  device.ts     createDeviceCollector: maps @mgpl-diagnostics/security-kit's signals to DeviceInput (deviceId, clientSessionId, fingerprint, info)
  query.ts      mgplQuery / mgplMutation / mgplKey / mgplFetcher / clearOnSignOut (TanStack Query, SWR; no dependency)
  operations.ts FRAGMENTS + OPERATIONS (one per Query/Mutation field), withFragments
  client.ts     createMgplGraphQLClient (auth, users, organization, catalog, patients, … documents), documentBlob, csvBlob
  types.ts      the API's GraphQL types as selected by operations.ts, plus inputs
  index.ts      the "/graphql" entry (types flat); the main entry re-exports the client, types under `Gql`
src/react.tsx   useMgplSession, useAsync, useTemplates, useReportHtml, useInvoiceHtml, useInvoiceTotals, usePdfUrl, HtmlFrame
```

## Commands

```bash
npm run typecheck
npm run build        # dist/index.js, dist/react.js (+ .d.ts)
```

End-to-end tests run in invoice-kit: `npm run test:api` drives this SDK against the real backend, over
an in-process handler and over a real `node:http` server.

## Licence

All rights reserved (see LICENSE).
