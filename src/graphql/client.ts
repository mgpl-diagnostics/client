// createMgplGraphQLClient: one typed method per operation of the backend's single GraphQL endpoint
// (mgpl-diagnostics/api, POST /graphql). Zero dependencies: operations are plain strings.
import type { InvoiceRequest, InvoiceTotals, ReportRequest } from "../types";
import { OPERATIONS, type Operation } from "./operations";
import { createTransport, type GraphQLClientOptions, type Variables } from "./transport";
import type * as T from "./types";

type Page = { limit?: number; offset?: number };
type Range = { from: T.DateTime; to: T.DateTime };
type Csv = { bom?: boolean };

export function createMgplGraphQLClient(opts: GraphQLClientOptions = {}) {
  const transport = createTransport(opts);

  /** Runs one operation and returns its root field. */
  async function run<R>(operation: Operation, variables?: Variables, signal?: AbortSignal): Promise<R> {
    const data = await transport.request<Record<string, unknown>>(operation.document, variables, { signal });
    return data[operation.field] as R;
  }
  const O = OPERATIONS;

  return {
    url: transport.url,
    /** Any query or mutation, for what the typed methods don't cover (e.g. a custom selection). */
    request: transport.request,
    getToken: transport.getToken,
    setToken: transport.setToken,

    health: () => run<T.Health>(O.health),
    ping: () => run<string>(O.ping),

    auth: {
      /** Signs in and keeps the session token for every later call (see `onToken` to persist it). */
      async login(input: T.LoginInput): Promise<T.LoginResult> {
        const result = await run<T.LoginResult>(O.login, { input });
        transport.setToken(result.token);
        return result;
      },
      /** Ends this session on the server and forgets the token. */
      async logout(): Promise<void> {
        try {
          if (transport.getToken()) await run<boolean>(O.logout);
        } finally {
          transport.setToken(null);
        }
      },
      /** The signed-in user, organisation and permissions; null when the token is missing or expired. */
      viewer: () => run<T.Viewer | null>(O.viewer),
      /** Whether the signed-in user may do `permission` (at `branchId`, when given). */
      can: async (permission: string, branchId?: T.ID) =>
        (await run<{ can: boolean } | null>(O.can, { permission, branchId }))?.can ?? false,
      sessions: () => run<T.Session[]>(O.mySessions),
      logoutOtherSessions: () => run<number>(O.logoutOtherSessions),
      revokeSession: (id: T.ID) => run<boolean>(O.revokeSession, { id }),
      changePassword: (currentPassword: string, newPassword: string) =>
        run<boolean>(O.changePassword, { currentPassword, newPassword }),
      /** Always resolves true; the server emails the link if the account exists. */
      requestPasswordReset: (email: string, orgCode?: string) => run<boolean>(O.requestPasswordReset, { email, orgCode }),
      resetPassword: (token: string, newPassword: string) => run<boolean>(O.resetPassword, { token, newPassword }),
    },

    users: {
      list: () => run<T.User[]>(O.users),
      get: (id: T.ID) => run<T.User | null>(O.user, { id }),
      create: (input: T.CreateUserInput) => run<T.User>(O.createUser, { input }),
      setRoles: (userId: T.ID, roles: T.RoleAssignmentInput[]) => run<T.User>(O.setUserRoles, { userId, roles }),
      disable: (userId: T.ID) => run<T.User>(O.disableUser, { userId }),
      enable: (userId: T.ID) => run<T.User>(O.enableUser, { userId }),
      setPassword: (userId: T.ID, newPassword: string) => run<boolean>(O.setUserPassword, { userId, newPassword }),
      roles: () => run<T.Role[]>(O.roles),
      upsertRole: (input: T.RoleInput) => run<T.Role>(O.upsertRole, { input }),
      /** Every permission name the API checks. */
      permissions: () => run<string[]>(O.permissions),
    },

    organization: {
      get: () => run<T.Organization>(O.organization),
      update: (input: T.OrganizationInput) => run<T.Organization>(O.updateOrganization, { input }),
      branches: () => run<T.Branch[]>(O.branches),
      branch: (id: T.ID) => run<T.Branch | null>(O.branch, { id }),
      createBranch: (input: T.BranchInput) => run<T.Branch>(O.createBranch, { input }),
      updateBranch: (id: T.ID, input: T.BranchPatch) => run<T.Branch>(O.updateBranch, { id, input }),
      auditLog: (filter: { entity?: string; entityId?: T.ID } & Page = {}) => run<T.AuditEntry[]>(O.auditLog, filter),
    },

    /** The test catalog. No sign-in needed. */
    catalog: {
      search: (query: string, o: { department?: string; sampleType?: string; limit?: number; fuzzy?: boolean } = {}) =>
        run<T.CatalogHit[]>(O.catalogSearch, { query, ...o }),
      /** By numeric id or code ("CBC", "LFT"); `sex` picks the reference range. */
      test: (idOrCode: number | string, sex?: T.Sex) =>
        run<T.CatalogTestDetail | null>(O.catalogTest, typeof idOrCode === "number" ? { id: idOrCode, sex } : { code: idOrCode, sex }),
      tests: (filter: { department?: string; sampleType?: string } & Page = {}) => run<T.CatalogTest[]>(O.catalogTests, filter),
      departments: () => run<string[]>(O.catalogDepartments),
      sampleTypes: () => run<string[]>(O.catalogSampleTypes),
      priceQuote: (tests: string[]) => run<T.PriceQuote>(O.priceQuote, { tests }),
    },

    patients: {
      /** Name, phone or UHID. */
      search: (search: string, limit?: number) => run<T.Patient[]>(O.patients, { search, limit }),
      get: (id: T.ID) => run<T.Patient | null>(O.patient, { id }),
      register: (input: T.RegisterPatientInput) => run<T.Patient>(O.registerPatient, { input }),
      update: (id: T.ID, input: T.UpdatePatientInput) => run<T.Patient>(O.updatePatient, { id, input }),
    },

    doctors: {
      list: (activeOnly?: boolean) => run<T.Doctor[]>(O.doctors, { activeOnly }),
      create: (input: T.DoctorInput) => run<T.Doctor>(O.createDoctor, { input }),
      update: (id: T.ID, input: T.DoctorPatch) => run<T.Doctor>(O.updateDoctor, { id, input }),
    },

    bookings: {
      list: (filter: { branchId?: T.ID; patientId?: T.ID; status?: T.BookingStatus } & Page = {}) =>
        run<T.Booking[]>(O.bookings, filter),
      get: (id: T.ID) => run<T.Booking | null>(O.booking, { id }),
      /** Creates the booking and one sample per sample type. */
      create: (input: T.CreateBookingInput) => run<T.CreateBookingResult>(O.createBooking, { input }),
      cancel: (id: T.ID) => run<T.Booking>(O.cancelBooking, { id }),
    },

    samples: {
      get: (id: T.ID) => run<T.Sample | null>(O.sample, { id }),
      byBarcode: (barcode: string) => run<T.Sample | null>(O.sampleByBarcode, { barcode }),
      collect: (id: T.ID) => run<T.Sample>(O.collectSample, { id }),
      receive: (id: T.ID) => run<T.Sample>(O.receiveSample, { id }),
      reject: (id: T.ID, reason: string) => run<T.Sample>(O.rejectSample, { id, reason }),
    },

    reports: {
      get: (id: T.ID) => run<T.Report | null>(O.report, { id }),
      create: (bookingId: T.ID, testCode: string, testName?: string) =>
        run<T.Report>(O.createReport, { bookingId, testCode, testName }),
      /** Unit, range and flag are filled from the catalog when omitted. */
      saveResults: (reportId: T.ID, results: T.ResultInput[]) => run<T.Report>(O.saveResults, { reportId, results }),
      verify: (id: T.ID) => run<T.Report>(O.verifyReport, { id }),
      release: (id: T.ID) => run<T.Report>(O.releaseReport, { id }),
      amend: (id: T.ID) => run<T.Report>(O.amendReport, { id }),
    },

    invoices: {
      list: (filter: { branchId?: T.ID; patientId?: T.ID; customerId?: T.ID; status?: T.InvoiceStatus } & Page = {}) =>
        run<T.Invoice[]>(O.invoices, filter),
      get: (id: T.ID) => run<T.Invoice | null>(O.invoice, { id }),
      /** Items can be catalog codes alone; name and MRP come from the catalog. Posts to the books. */
      issue: (input: T.IssueInvoiceInput) => run<T.Invoice>(O.issueInvoice, { input }),
      recordPayment: (invoiceId: T.ID, payment: T.PaymentInput) => run<T.Invoice>(O.recordPayment, { invoiceId, payment }),
      refund: (invoiceId: T.ID, payment: T.PaymentInput) => run<T.Invoice>(O.refundPayment, { invoiceId, payment }),
      cancel: (id: T.ID, reason: string) => run<T.Invoice>(O.cancelInvoice, { id, reason }),
    },

    books: {
      groups: () => run<T.AccountGroup[]>(O.accountGroups),
      ledgers: () => run<T.Ledger[]>(O.ledgers),
      ledger: (id: T.ID) => run<T.Ledger | null>(O.ledger, { id }),
      voucher: (id: T.ID) => run<T.Voucher | null>(O.voucher, { id }),
      ledgerStatement: (ledgerId: T.ID, range: Range, branchId?: T.ID) =>
        run<T.LedgerStatement>(O.ledgerStatement, { ledgerId, ...range, branchId }),
      cashBook: (range: Range, branchId?: T.ID) => run<T.LedgerStatement>(O.cashBook, { ...range, branchId }),
      trialBalance: (o: { asOf?: T.DateTime; branchId?: T.ID } = {}) => run<T.TrialBalance>(O.trialBalance, o),
      profitAndLoss: (range: Range, branchId?: T.ID) => run<T.ProfitAndLoss>(O.profitAndLoss, { ...range, branchId }),
      balanceSheet: (asOf: T.DateTime, branchId?: T.ID) => run<T.BalanceSheet>(O.balanceSheet, { asOf, branchId }),
      dayBook: (range: Range, o: { branchId?: T.ID; type?: T.VoucherType } = {}) => run<T.Voucher[]>(O.dayBook, { ...range, ...o }),
      outstandingReceivables: (o: { asOf?: T.DateTime; branchId?: T.ID } = {}) => run<T.Outstanding>(O.outstandingReceivables, o),
      gstSummary: (range: Range, branchId?: T.ID) => run<T.GstSummary>(O.gstSummary, { ...range, branchId }),
      /** Seeds the standard chart and finance ledgers. Safe to repeat. */
      setupChartOfAccounts: () => run<T.Ledger[]>(O.setupChartOfAccounts),
      createLedger: (input: T.LedgerInput) => run<T.Ledger>(O.createLedger, { input }),
      postVoucher: (input: T.PostVoucherInput) => run<T.Voucher>(O.postVoucher, { input }),
      cancelVoucher: (id: T.ID) => run<T.Voucher>(O.cancelVoucher, { id }),
    },

    gst: {
      taxRules: () => run<T.TaxRule[]>(O.taxRules),
      addTaxRule: (input: T.TaxRuleInput) => run<T.TaxRule>(O.addTaxRule, { input }),
      /** finance-kit's starting rules. Every rate must be verified with the lab's CA. */
      seedTaxRules: () => run<T.TaxRule[]>(O.seedTaxRules),
      config: () => run<T.FinanceConfig>(O.financeConfig),
      verifyWithCA: () => run<string[]>(O.verifyWithCA),
      gstr1: (range: Range, gstin?: string) => run<T.Gstr1>(O.gstr1, { ...range, gstin }),
      gstr3b: (range: Range, gstin?: string) => run<T.Gstr3b>(O.gstr3b, { ...range, gstin }),
    },

    receivables: {
      customers: (activeOnly?: boolean) => run<T.Customer[]>(O.customers, { activeOnly }),
      customer: (id: T.ID) => run<T.Customer | null>(O.customer, { id }),
      createCustomer: (input: T.CustomerInput) => run<T.Customer>(O.createCustomer, { input }),
      updateCustomer: (id: T.ID, input: T.CustomerPatch) => run<T.Customer>(O.updateCustomer, { id, input }),
      /** A credit invoice to a hospital, insurer, TPA or corporate (checks the credit limit). */
      issueInvoice: (input: T.CustomerInvoiceInput) => run<T.Invoice>(O.issueCustomerInvoice, { input }),
      statement: (customerId: T.ID, range: Range) => run<T.CustomerStatement>(O.customerStatement, { customerId, ...range }),
      summary: (asOf: T.DateTime) => run<T.ReceivablesSummary>(O.receivablesSummary, { asOf }),
      creditNotes: (filter: { customerId?: T.ID; invoiceId?: T.ID } & Page = {}) => run<T.CreditNote[]>(O.creditNotes, filter),
      creditNote: (id: T.ID) => run<T.CreditNote | null>(O.creditNote, { id }),
      issueCreditNote: (input: T.CreditNoteInput) => run<T.CreditNoteResult>(O.issueCreditNote, { input }),
    },

    settlements: {
      partners: (branchId?: T.ID) => run<T.Partner[]>(O.partners, { branchId }),
      partner: (id: T.ID) => run<T.Partner | null>(O.partner, { id }),
      createPartner: (input: T.PartnerInput) => run<T.Partner>(O.createPartner, { input }),
      updatePartner: (id: T.ID, input: T.PartnerPatch) => run<T.Partner>(O.updatePartner, { id, input }),
      addAgreement: (input: T.AgreementInput) => run<T.PartnerAgreement>(O.addAgreement, { input }),
      /** period: "YYYY-MM". Computes without saving. */
      preview: (partnerId: T.ID, period: string, deductions?: T.SettlementDeductionInput[]) =>
        run<T.SettlementPreview>(O.settlementPreview, { partnerId, period, deductions }),
      list: (filter: { branchId?: T.ID; partnerId?: T.ID; status?: T.SettlementStatus } & Page = {}) =>
        run<T.Settlement[]>(O.settlements, filter),
      get: (id: T.ID) => run<T.Settlement | null>(O.settlement, { id }),
      create: (partnerId: T.ID, period: string, deductions?: T.SettlementDeductionInput[]) =>
        run<T.Settlement>(O.createSettlement, { partnerId, period, deductions }),
      accrue: (id: T.ID) => run<T.Settlement>(O.accrueSettlement, { id }),
      pay: (input: T.PaySettlementInput) => run<T.Settlement>(O.paySettlement, { input }),
      cancel: (id: T.ID) => run<T.Settlement>(O.cancelSettlement, { id }),
    },

    cash: {
      closings: (branchId: T.ID, page: Page = {}) => run<T.CashClosing[]>(O.cashClosings, { branchId, ...page }),
      closeDay: (input: T.CloseCashDayInput) => run<T.CashClosing>(O.closeCashDay, { input }),
    },

    bank: {
      statements: (filter: { ledgerId?: T.ID } & Page = {}) => run<T.BankStatement[]>(O.bankStatements, filter),
      lines: (filter: { ledgerId?: T.ID; statementId?: T.ID; status?: T.BankLineStatus } & Page = {}) =>
        run<T.BankLine[]>(O.bankLines, filter),
      import: (input: T.BankImportInput) => run<T.BankImportResult>(O.importBankStatement, { input }),
      reconcile: (ledgerId: T.ID, statementId?: T.ID) => run<T.ReconcileResult>(O.reconcileBank, { ledgerId, statementId }),
      match: (lineId: T.ID, voucherIds: T.ID[]) => run<T.BankLine>(O.matchBankLine, { lineId, voucherIds }),
      setStatus: (lineId: T.ID, status: "ignored" | "unmatched") => run<T.BankLine>(O.setBankLineStatus, { lineId, status }),
      reconciliation: (ledgerId: T.ID, asOf: T.DateTime) => run<T.BankReconciliation>(O.bankReconciliation, { ledgerId, asOf }),
    },

    periods: {
      lockDates: () => run<T.PeriodLock[]>(O.lockDates),
      /** upTo: "YYYY-MM-DD", or null to unlock. Without branchId it locks the whole organisation. */
      setLockDate: (input: T.LockDateInput) => run<T.PeriodLock>(O.setLockDate, { input }),
      /** fy: "2026-27". Posts closing vouchers on 31 March and locks the year. */
      closeFinancialYear: (fy: string) => run<T.YearEndResult>(O.closeFinancialYear, { fy }),
    },

    /** CSV files ending with TOTAL rows. Save one with `csvBlob(file)` + downloadBlob. */
    exports: {
      trialBalance: (o: { asOf?: T.DateTime; branchId?: T.ID } & Csv = {}) => run<T.CsvFile>(O.exportTrialBalance, o),
      profitAndLoss: (range: Range, o: { branchId?: T.ID } & Csv = {}) => run<T.CsvFile>(O.exportProfitAndLoss, { ...range, ...o }),
      balanceSheet: (asOf: T.DateTime, o: { branchId?: T.ID } & Csv = {}) => run<T.CsvFile>(O.exportBalanceSheet, { asOf, ...o }),
      dayBook: (range: Range, o: { branchId?: T.ID } & Csv = {}) => run<T.CsvFile>(O.exportDayBook, { ...range, ...o }),
      ledger: (ledgerId: T.ID, range: Range, o: { branchId?: T.ID } & Csv = {}) =>
        run<T.CsvFile>(O.exportLedger, { ledgerId, ...range, ...o }),
      /** One file per section: b2b, b2cl, b2cs, cdnr, cdnur, nil, hsn, docs. */
      gstr1: (range: Range, o: { gstin?: string } & Csv = {}) => run<T.CsvFile[]>(O.exportGstr1, { ...range, ...o }),
      gstr3b: (range: Range, o: { gstin?: string } & Csv = {}) => run<T.CsvFile>(O.exportGstr3b, { ...range, ...o }),
      settlement: (settlementId: T.ID, o: Csv = {}) => run<T.CsvFile>(O.exportSettlement, { settlementId, ...o }),
    },

    /** Reports and invoices rendered by the server (report-kit / invoice-kit). PDFs come as base64. */
    documents: {
      templates: () => run<T.ReportTemplateCatalog>(O.reportTemplates),
      priceList: () => run<T.PriceListEntry[]>(O.priceList),
      reportSamples: () => run<T.DocumentSample[]>(O.documentSamples),
      invoiceSamples: () => run<T.DocumentSample[]>(O.invoiceSamples),
      /** Any report request (patient + tests | profile | report | sample), as with the REST client. */
      renderReport: (request: ReportRequest, o: T.RenderOptions = {}) => run<T.RenderedDocument>(O.renderReport, { request, ...o }),
      /** Any invoice request ({ invoice } or { sample }). */
      renderInvoice: (request: InvoiceRequest, o: Omit<T.RenderOptions, "design"> = {}) =>
        run<T.RenderedDocument>(O.renderInvoice, { request, ...o }),
      /** invoice-kit's calculation, without rendering (amounts in rupees). */
      invoiceTotals: (request: InvoiceRequest) => run<InvoiceTotals>(O.invoiceTotals, { request }),
      letterhead: (format?: T.DocumentFormat) => run<T.RenderedDocument>(O.letterhead, { format }),
      /** A stored invoice, printed. */
      invoice: (invoiceId: T.ID, o: Omit<T.RenderOptions, "design" | "fileName"> = {}) =>
        run<T.RenderedDocument>(O.invoiceDocument, { invoiceId, ...o }),
      /** A booking's verified or released reports printed together (or only `reportIds`). */
      bookingReports: (bookingId: T.ID, o: Omit<T.RenderOptions, "fileName"> & { reportIds?: T.ID[] } = {}) =>
        run<T.RenderedDocument>(O.bookingReportDocument, { bookingId, ...o }),
    },
  };
}

export type MgplGraphQLClient = ReturnType<typeof createMgplGraphQLClient>;

/** A rendered document as a Blob: PDF from base64, HTML from its markup. Use with downloadBlob/openBlob/printBlob. */
export function documentBlob(doc: Pick<T.RenderedDocument, "mimeType" | "base64" | "html">): Blob {
  if (doc.base64 != null) {
    const bin = atob(doc.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: doc.mimeType });
  }
  return new Blob([doc.html ?? ""], { type: doc.mimeType });
}

/** A CSV export as a Blob (UTF-8). */
export function csvBlob(file: T.CsvFile): Blob {
  return new Blob([file.content], { type: file.mimeType });
}
