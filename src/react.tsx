// @mgpl-diagnostics/client/react — optional, UNSTYLED React hooks + a bare iframe.
// No layout, no CSS: pass className/style and design the UI however you like.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type IframeHTMLAttributes } from "react";
import type { MgplClient } from "./index";
import type { InvoiceInput, InvoiceRequest, InvoiceTotals, ReportRequest, TemplateCatalog } from "./types";

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  /** run again */
  reload: () => void;
}

/** Runs `load` whenever `key` changes; ignores stale responses. */
export function useAsync<T>(load: () => Promise<T>, key: string): AsyncState<T> {
  const [state, setState] = useState<{ data?: T; loading: boolean; error?: Error }>({ loading: true });
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    loadRef
      .current()
      .then((data) => alive && setState({ data, loading: false }))
      .catch((error: Error) => alive && setState({ loading: false, error }));
    return () => {
      alive = false;
    };
  }, [key, nonce]);
  return { data: state.data, loading: state.loading, error: state.error, reload: () => setNonce((n) => n + 1) };
}

/** Test catalog for building result-entry forms. */
export const useTemplates = (client: MgplClient): AsyncState<TemplateCatalog> => useAsync(() => client.reports.templates(), client.baseUrl);

/** Backend-rendered report HTML (pass null to skip). */
export const useReportHtml = (client: MgplClient, req: ReportRequest | null): AsyncState<string> =>
  useAsync(() => (req ? client.reports.html(req) : Promise.resolve("")), JSON.stringify(req));

/** Backend-rendered invoice HTML (pass null to skip). */
export const useInvoiceHtml = (client: MgplClient, req: InvoiceRequest | null): AsyncState<string> =>
  useAsync(() => (req ? client.invoices.html(req) : Promise.resolve("")), JSON.stringify(req));

/** Live totals for an invoice being edited (pass null to skip). */
export const useInvoiceTotals = (client: MgplClient, invoice: InvoiceInput | null): AsyncState<InvoiceTotals | undefined> =>
  useAsync(() => (invoice ? client.invoices.totals(invoice) : Promise.resolve(undefined)), JSON.stringify(invoice));

/** Object URL for a PDF Blob loader (revoked automatically) — for <iframe src> or <a href download>. */
export function usePdfUrl(load: (() => Promise<Blob>) | null, key: string): AsyncState<Blob | undefined> & { url: string | undefined } {
  const state = useAsync(() => (load ? load() : Promise.resolve(undefined)), key);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!state.data) return;
    const u = URL.createObjectURL(state.data);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [state.data]);
  return { ...state, url };
}

export interface HtmlFrameHandle {
  /** browser print dialog for the frame's document */
  print(): void;
  readonly iframe: HTMLIFrameElement | null;
}

export interface HtmlFrameProps extends Omit<IframeHTMLAttributes<HTMLIFrameElement>, "srcDoc"> {
  html: string;
  /** grow to the content height (default true) */
  autoHeight?: boolean;
  style?: CSSProperties;
}

/**
 * Bare iframe for backend HTML. The document is isolated (its CSS can't touch your app's and
 * vice versa) and scripts are disabled by the sandbox. No styling of its own.
 */
export const HtmlFrame = forwardRef<HtmlFrameHandle, HtmlFrameProps>(function HtmlFrame(
  { html, autoHeight = true, style, title, onLoad, ...rest },
  ref,
) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>();
  useImperativeHandle(ref, () => ({ print: () => frame.current?.contentWindow?.print(), get iframe() { return frame.current; } }), []);
  const measure = () => {
    const doc = frame.current?.contentDocument;
    if (autoHeight && doc?.documentElement) setHeight(doc.documentElement.scrollHeight);
  };
  return (
    <iframe
      {...rest}
      ref={frame}
      title={title ?? "Document preview"}
      srcDoc={html}
      sandbox="allow-same-origin allow-modals"
      onLoad={(e) => {
        measure();
        setTimeout(measure, 300); // fonts and images settle after load
        onLoad?.(e);
      }}
      style={{ border: 0, width: "100%", ...(autoHeight && height ? { height } : null), ...style }}
    />
  );
});
