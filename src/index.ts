// @mgpl-diagnostics/client — headless browser SDK for the MGPL Diagnostics backend
// (report-kit / invoice-kit API). Zero dependencies. No UI, no CSS: build any UI/UX on top of it.
import type {
  InvoiceRequest,
  InvoiceSampleInfo,
  InvoiceTotals,
  InvoiceInput,
  PriceEntry,
  ReportRequest,
  SampleInfo,
  TemplateCatalog,
} from "./types";

export * from "./types";

// The GraphQL SDK for mgpl-diagnostics/api (one endpoint for everything). Its types are under `Gql`
// here, or flat in "@mgpl-diagnostics/client/graphql".
export {
  createMgplGraphQLClient,
  documentBlob,
  csvBlob,
  createTransport,
  MgplGraphQLError,
  OPERATIONS,
  FRAGMENTS,
  withFragments,
} from "./graphql/index";
export type { MgplGraphQLClient, GraphQLClientOptions, GraphQLErrorItem, Operation, OperationName } from "./graphql/index";
export type * as Gql from "./graphql/types";

/** Default mount point of the backend */
export const DEFAULT_BASE_URL = "/api/mgpl";

/** Backend routes, relative to the base URL */
export const ROUTES = {
  health: "/health",
  templates: "/templates",
  samples: "/samples",
  report: "/report",
  letterhead: "/letterhead",
  assets: "/assets",
  invoice: "/invoice",
  priceList: "/price-list",
  invoiceSamples: "/invoice-samples",
} as const;

export interface ClientOptions {
  /** Backend URL: "/api/mgpl" (same origin) or "https://api.example.com/api/mgpl" */
  baseUrl?: string;
  /** Custom fetch (tests, SSR, auth/retry wrappers) */
  fetch?: typeof fetch;
  /** Headers on every request, e.g. () => ({ Authorization: `Bearer ${token}` }) */
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  /** e.g. "include" for cookie auth across origins */
  credentials?: RequestCredentials;
}

/** Any non-2xx response. `message` is the server's error text, `status` the HTTP status. */
export class MgplApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "MgplApiError";
  }
}

type Query = Record<string, string | number | boolean | undefined>;

export function createMgplClient(opts: ClientOptions = {}) {
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  const url = (path: string, query?: Query) => {
    const qs = query
      ? Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== false)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join("&")
      : "";
    return `${baseUrl}${path}${qs ? `?${qs}` : ""}`;
  };

  async function call(path: string, init: RequestInit = {}, query?: Query): Promise<Response> {
    const headers = new Headers(typeof opts.headers === "function" ? await opts.headers() : opts.headers);
    new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    const res = await doFetch(url(path, query), { ...init, headers, credentials: opts.credentials });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`.trim();
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {
        /* not JSON */
      }
      throw new MgplApiError(msg, res.status);
    }
    return res;
  }
  const post = (path: string, body: unknown) =>
    call(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  return {
    baseUrl,
    /** URL of a route (for <a href>, <iframe src>, window.open) */
    url,
    health: (): Promise<{ ok: boolean }> => call(ROUTES.health).then((r) => r.json()),

    reports: {
      /** Every test template with its result fields (build entry forms from this) + profiles */
      templates: (): Promise<TemplateCatalog> => call(ROUTES.templates).then((r) => r.json()),
      /** Demo reports (only when the server enables samples) */
      samples: (): Promise<SampleInfo[]> => call(ROUTES.samples).then((r) => r.json()),
      /** A4 PDF */
      pdf: (req: ReportRequest): Promise<Blob> => post(ROUTES.report, { ...req, format: "pdf" }).then((r) => r.blob()),
      /** HTML document (its fonts/images load from the backend) — show it in <HtmlFrame> or an iframe */
      html: (req: ReportRequest): Promise<string> => post(ROUTES.report, { ...req, format: "html" }).then((r) => r.text()),
      letterheadPdf: (): Promise<Blob> => call(ROUTES.letterhead, {}, { format: "pdf" }).then((r) => r.blob()),
      letterheadHtml: (): Promise<string> => call(ROUTES.letterhead, {}, { format: "html" }).then((r) => r.text()),
      /** Direct link to the letterhead PDF */
      letterheadUrl: (download = false) => url(ROUTES.letterhead, { format: "pdf", download: download ? 1 : undefined }),
    },

    invoices: {
      /** Price list (codes usable as invoice items) */
      priceList: (): Promise<PriceEntry[]> => call(ROUTES.priceList).then((r) => r.json()),
      samples: (): Promise<InvoiceSampleInfo[]> => call(ROUTES.invoiceSamples).then((r) => r.json()),
      /** Server-side calculation: totals, GST, round-off, status, amount in words */
      totals: (invoice: InvoiceInput): Promise<InvoiceTotals> => post(ROUTES.invoice, { invoice, format: "json" }).then((r) => r.json()),
      pdf: (req: InvoiceRequest): Promise<Blob> => post(ROUTES.invoice, { ...req, format: "pdf" }).then((r) => r.blob()),
      html: (req: InvoiceRequest): Promise<string> => post(ROUTES.invoice, { ...req, format: "html" }).then((r) => r.text()),
    },
  };
}

export type MgplClient = ReturnType<typeof createMgplClient>;

/* ------------------------------------------------------------ browser utils */

/** Save a Blob as a file. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

/** Open a Blob (e.g. a PDF) in a new tab. */
export function openBlob(blob: Blob): void {
  const href = URL.createObjectURL(blob);
  window.open(href, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

/** Print a PDF Blob through a hidden iframe. */
export function printBlob(blob: Blob): void {
  const href = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.src = href;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(href);
    }, 60_000);
  };
  document.body.appendChild(frame);
}
