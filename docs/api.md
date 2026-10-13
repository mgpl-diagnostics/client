# API reference: @mgpl-diagnostics/client

## createMgplClient(options?)

```ts
interface ClientOptions {
  baseUrl?: string;                     // default "/api/mgpl"
  fetch?: typeof fetch;                 // custom fetch (tests, SSR, retries)
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);   // e.g. auth
  credentials?: RequestCredentials;     // "include" for cookies across origins
}

const mgpl = createMgplClient(options);
mgpl.baseUrl;                    mgpl.url(path, query?)        mgpl.health()

mgpl.reports.templates(): Promise<TemplateCatalog>
mgpl.reports.samples(): Promise<SampleInfo[]>
mgpl.reports.pdf(req: ReportRequest): Promise<Blob>
mgpl.reports.html(req: ReportRequest): Promise<string>
mgpl.reports.letterheadPdf(): Promise<Blob>       .letterheadHtml(): Promise<string>       .letterheadUrl(download?)

mgpl.invoices.priceList(): Promise<PriceEntry[]>
mgpl.invoices.samples(): Promise<InvoiceSampleInfo[]>
mgpl.invoices.totals(invoice: InvoiceInput): Promise<InvoiceTotals>
mgpl.invoices.pdf(req: InvoiceRequest): Promise<Blob>
mgpl.invoices.html(req: InvoiceRequest): Promise<string>
```

Any non-2xx response throws `MgplApiError { status, message }` (the server's `error` text).

## Requests

```ts
interface ReportRequest {
  patient?: Patient; tests?: { template: string; results: Results }[];
  profile?: { id: string; results: Record<string, Results> }; sample?: string;
  variant?: "header" | "non-header"; design?: "sidebar" | "classic"; fileName?: string; download?: boolean;
}
type Results = Record<string, string | { value?: string; flag?: Flag; range?: string | string[]; unit?: string; method?: string } | string[] | undefined>

interface InvoiceRequest { invoice?: InvoiceInput; sample?: string; variant?: ReportVariant; fileName?: string; download?: boolean }
interface InvoiceInput {
  invoiceNo: string; date?: string; patient: Patient;
  items: (string | (Partial<InvoiceItem> & { code: string }) | InvoiceItem)[];
  discount?: { percent?: number; amount?: number; reason?: string };
  payments?: { mode: string; amount: number; date?: string; reference?: string }[];
  notes?: string[]; roundOff?: boolean; title?: string;
}
interface Patient {
  title?; name; age: number | string; ageUnit?; sex; patientId?; refDoctor?; sampleCollectionDate?;
  sampleId?; sampleType?; phone?; address?; collectedAt?; registeredAt?; reportedAt?;
}
```

## Responses

`TemplateCatalog { templates: { id, name, category?, specimen?, method?, fields: { key, label, unit?, range? }[] }[], profiles: { id, name, tests }[] }`

`InvoiceTotals { lines[], subtotal, lineDiscount, billDiscount, taxable, tax, taxByRate[], roundOff, total, paid, due, excess, status, hasTax, hasDiscount, amountInWords }`

`PriceEntry { code, name, category, rate, taxPercent?, hsn? }`

## Browser helpers

`downloadBlob(blob, fileName)` · `openBlob(blob)` · `printBlob(blob)`

## React (`@mgpl-diagnostics/client/react`, unstyled)

```ts
useAsync<T>(load: () => Promise<T>, key: string): { data, loading, error, reload }
useTemplates(client)
useReportHtml(client, req | null)     useInvoiceHtml(client, req | null)
useInvoiceTotals(client, invoice | null)
usePdfUrl(load | null, key): { …, url }
<HtmlFrame html autoHeight? className? style? ref={HtmlFrameHandle} />   // HtmlFrameHandle.print()
```
