# AGENTS.md — @mgpl-diagnostics/client

Instructions for AI coding agents and developers.

## What this is

The **frontend** SDK for the MGPL Diagnostics backend (`createMgplApi()` from invoice-kit, or
`createReportApi()` from report-kit). It is **headless and has zero dependencies**: a typed `fetch` client,
browser helpers, and optional **unstyled** React hooks. All rendering (reports, invoices, PDFs) happens on
the backend. Apps build their own UI/UX on top.

## Rules

1. **No runtime dependencies.** Not even React in the main entry; React is an optional peer used only by `src/react.tsx`.
2. **No UI.** No styled components, no CSS, no layout decisions. `HtmlFrame` is a bare iframe that
   accepts `className`/`style`. If you feel the need for a component with looks, it belongs in the app.
3. **The contract is mirrored, not imported.** `src/types.ts` mirrors report-kit's `src/shared/api.ts` /
   `types.ts` and invoice-kit's `api.ts`. Never import from the backend kits (that would pull the PDF
   engine into browsers). report-studio's `contract-check.ts` type-checks both sides; update them together.
4. **Routes** are in `ROUTES` in `src/index.ts` and must match report-kit `src/shared/api.ts` + invoice-kit `INVOICE_ROUTES`.
5. `src/react.tsx` gets a `"use client"` banner from tsup (see `tsup.config.ts`); the main entry must not,
   so it stays usable from Server Components, workers and Node scripts.

## Map

```
src/types.ts    contract types (Patient, ReportRequest, TemplateCatalog, InvoiceInput, InvoiceTotals, …)
src/index.ts    createMgplClient (reports.*, invoices.*, health, url), MgplApiError, ROUTES, downloadBlob/openBlob/printBlob
src/react.tsx   useAsync, useTemplates, useReportHtml, useInvoiceHtml, useInvoiceTotals, usePdfUrl, HtmlFrame
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
