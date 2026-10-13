// The MGPL API contract as seen from the client. Self-contained on purpose: the client package has
// no dependency on the backend kits. (report-studio type-checks these against the kits.)

export type ReportVariant = "header" | "non-header";
export type ReportDesign = "sidebar" | "classic";
export type OutputFormat = "pdf" | "html";

/* ------------------------------------------------------------------ patient */
export interface Patient {
  /** "Mr", "Mrs", "Master", "Ku" … */
  title?: string;
  name: string;
  age: number | string;
  /** default "Year(s)" */
  ageUnit?: string;
  sex: string;
  patientId?: string;
  /** "Self", "A. K. Sharma" — "Dr." is added automatically */
  refDoctor?: string;
  sampleCollectionDate?: string;
  sampleId?: string;
  sampleType?: string;
  phone?: string;
  address?: string;
  /** ISO date-time or "12-10-2026 08:45 AM" */
  collectedAt?: string;
  registeredAt?: string;
  reportedAt?: string;
}

/* ------------------------------------------------------------------ reports */
export type Flag = "auto" | "normal" | "high" | "low" | "abnormal";

/** A result: "10.8", or an object to override flag / range / unit / method */
export type ResultValue = string | { value?: string; flag?: Flag; range?: string | string[]; unit?: string; method?: string };
/** Results for one test, keyed by the field keys from GET /templates */
export type Results = Record<string, ResultValue | string[] | undefined>;

/** Template / profile ids come from GET /templates (e.g. "cbc", "lft", "full-body-checkup") */
export type TemplateId = string;
export type ProfileId = string;

export interface TestInput {
  template: TemplateId;
  results: Results;
}

/** POST /report — send `patient` + `tests`, or `patient` + `profile`, or a demo `sample` id. */
export interface ReportRequest {
  patient?: Patient;
  tests?: TestInput[];
  profile?: { id: ProfileId; results: Record<TemplateId, Results> };
  sample?: string;
  /** default "header" */
  variant?: ReportVariant;
  /** default "sidebar" */
  design?: ReportDesign;
  fileName?: string;
  download?: boolean;
}

export interface TemplateField {
  key: string;
  label: string;
  unit?: string;
  range?: string | string[];
}
export interface TemplateInfo {
  id: TemplateId;
  name: string;
  category?: string;
  specimen?: string;
  method?: string;
  fields: TemplateField[];
}
/** GET /templates */
export interface TemplateCatalog {
  templates: TemplateInfo[];
  profiles: { id: ProfileId; name: string; tests: TemplateId[] }[];
}
/** GET /samples (demo servers only) */
export interface SampleInfo {
  id: string;
  label: string;
  group: "design" | "template" | "profile";
  source: string;
}

/* ----------------------------------------------------------------- invoices */
export type ItemCategory = "test" | "profile" | "medicine" | "consumable" | "service" | "other";

export interface InvoiceItem {
  code?: string;
  name: string;
  category: ItemCategory;
  qty?: number;
  rate: number;
  discountPercent?: number;
  discountAmount?: number;
  taxPercent?: number;
  hsn?: string;
  note?: string;
}
/** A line by price-list code ("cbc"), code + overrides, or a full item */
export type InvoiceItemInput = string | (Partial<InvoiceItem> & { code: string }) | InvoiceItem;

export interface Payment {
  mode: string;
  amount: number;
  date?: string;
  reference?: string;
}

export interface InvoiceInput {
  invoiceNo: string;
  date?: string;
  patient: Patient;
  items: InvoiceItemInput[];
  discount?: { percent?: number; amount?: number; reason?: string };
  payments?: Payment[];
  notes?: string[];
  /** default true */
  roundOff?: boolean;
  title?: string;
}

/** POST /invoice — `invoice` or a demo `sample` id */
export interface InvoiceRequest {
  invoice?: InvoiceInput;
  sample?: string;
  variant?: ReportVariant;
  fileName?: string;
  download?: boolean;
}

export type PaymentStatus = "PAID" | "PARTIALLY PAID" | "DUE";

/** POST /invoice with format "json" — the server's calculation (rupees) */
export interface InvoiceTotals {
  lines: { index: number; name: string; qty: number; gross: number; lineDiscount: number; billDiscount: number; taxable: number; tax: number; amount: number }[];
  subtotal: number;
  lineDiscount: number;
  billDiscount: number;
  taxable: number;
  tax: number;
  taxByRate: { rate: number; taxable: number; tax: number }[];
  roundOff: number;
  total: number;
  paid: number;
  due: number;
  excess: number;
  status: PaymentStatus;
  hasTax: boolean;
  hasDiscount: boolean;
  /** "Rupees … Only" */
  amountInWords: string;
}

export interface PriceEntry {
  code: string;
  name: string;
  category: ItemCategory;
  rate: number;
  taxPercent?: number;
  hsn?: string;
}

export interface InvoiceSampleInfo {
  id: string;
  label: string;
  invoiceNo: string;
}

/** Error body of any non-2xx response */
export interface ApiErrorBody {
  error: string;
}
