// Every operation the client sends, as plain GraphQL strings (no runtime GraphQL library).
// The selections match src/graphql/types.ts. The API's contract test validates each one against
// the server's schema (mgpl-diagnostics/api, test/client-contract.ts), so a renamed field fails there.

/** Reusable selections. An operation gets the fragments it spreads (and theirs) appended. */
export const FRAGMENTS: Record<string, string> = {
  AddressFields: `fragment AddressFields on Address { line1 line2 city district state pincode }`,
  BranchRef: `fragment BranchRef on Branch { id code name }`,
  UserFields: `fragment UserFields on User { id name email phone status roles { role branchId } lastLoginAt createdAt }`,
  RoleFields: `fragment RoleFields on Role { id key name permissions system }`,
  SessionFields: `fragment SessionFields on Session { id current createdAt lastSeenAt expiresAt ip userAgent deviceId deviceInfo }`,
  LoginResultFields: `fragment LoginResultFields on LoginResult { accessToken accessExpiresAt refreshToken refreshExpiresAt user { ...UserFields } }`,
  BranchFields: `fragment BranchFields on Branch { id code name kind phone gstin stateCode active address { ...AddressFields } }`,
  OrganizationFields: `fragment OrganizationFields on Organization {
    id name code legalName gstin phone email address { ...AddressFields } branches { ...BranchFields }
  }`,
  AuditEntryFields: `fragment AuditEntryFields on AuditEntry { id action entity entityId branchId user { id name } at }`,

  CatalogTestFields: `fragment CatalogTestFields on CatalogTest {
    id name code shortCode department sampleType mrp pricePaise isProfile parameterCount
  }`,

  PatientFields: `fragment PatientFields on Patient {
    id uhid title name sex dob ageYears phone email address { ...AddressFields } createdAt branch { ...BranchRef }
  }`,
  DoctorFields: `fragment DoctorFields on Doctor { id name qualification phone clinic active }`,
  SampleFields: `fragment SampleFields on Sample { id barcode sampleType status collectedAt receivedAt rejectReason }`,
  ReportFields: `fragment ReportFields on Report {
    id testCode testName status version verifiedAt releasedAt updatedAt results { parameter value unit flag range }
  }`,
  BookingFields: `fragment BookingFields on Booking {
    id bookingNo status notes createdAt
    patient { id uhid name } doctor { id name } branch { ...BranchRef }
    tests { testCode name pricePaise sampleType }
    sampleCollection { type scheduledAt }
    samples { ...SampleFields }
    reports { id testCode testName status }
    invoice { id invoiceNo status totalPaise duePaise }
  }`,

  InvoiceFields: `fragment InvoiceFields on Invoice {
    id invoiceNo status placeOfSupply buyerGstin
    subtotalPaise discountPaise taxPaise roundOffPaise totalPaise paidPaise creditedPaise duePaise
    issuedAt cancelReason createdAt
    patient { id uhid name } branch { ...BranchRef } customer { id code name }
    items { code name category qty ratePaise discountPaise taxPercent hsnSac taxability amountPaise }
    payments { id kind amountPaise mode reference receivedAt }
  }`,

  AccountGroupFields: `fragment AccountGroupFields on AccountGroup { id name nature affectsGrossProfit parent { id name } }`,
  LedgerFields: `fragment LedgerFields on Ledger { id name systemKey gstin openingPaise active group { id name nature } }`,
  VoucherFields: `fragment VoucherFields on Voucher {
    id type voucherNo date narration status invoiceId
    entries { ledger { id name } debitPaise creditPaise invoiceId }
  }`,
  StatementRowFields: `fragment StatementRowFields on StatementRow { date voucherNo voucherType debitPaise creditPaise balancePaise invoiceId }`,
  LedgerStatementFields: `fragment LedgerStatementFields on LedgerStatement {
    ledger { id name } openingPaise closingPaise totalDebitPaise totalCreditPaise rows { ...StatementRowFields }
  }`,
  GroupLineFields: `fragment GroupLineFields on GroupLine { group { id name } amountPaise ledgers { ledger { id name } amountPaise } }`,

  TaxRuleFields: `fragment TaxRuleFields on TaxRule { id code category hsnSac taxability ratePercent effectiveFrom effectiveTo note }`,
  RateTotalsFields: `fragment RateTotalsFields on RateTotals { ratePercent taxablePaise igstPaise cgstPaise sgstPaise cessPaise }`,
  TaxTotalsFields: `fragment TaxTotalsFields on TaxTotals { taxablePaise igstPaise cgstPaise sgstPaise cessPaise }`,
  HsnRowFields: `fragment HsnRowFields on HsnRow {
    hsnSac ratePercent taxability qty totalValuePaise taxablePaise igstPaise cgstPaise sgstPaise cessPaise
  }`,
  Gstr1InvoiceFields: `fragment Gstr1InvoiceFields on Gstr1Invoice {
    invoiceId invoiceNo day valuePaise placeOfSupply reverseCharge ctin items { ...RateTotalsFields }
  }`,
  Gstr1NoteFields: `fragment Gstr1NoteFields on Gstr1Note {
    noteId noteNo day noteType invoiceNo invoiceDay valuePaise placeOfSupply ctin type items { ...RateTotalsFields }
  }`,

  CustomerFields: `fragment CustomerFields on Customer {
    id code name kind legalName gstin stateCode pan phone email address { ...AddressFields }
    creditLimitPaise creditDays active ledger { id name }
  }`,
  AgeingFields: `fragment AgeingFields on Ageing { notDue d1to30 d31to60 d61to90 d90plus }`,
  CreditNoteFields: `fragment CreditNoteFields on CreditNote {
    id noteNo date reason status taxablePaise taxPaise cgstPaise sgstPaise igstPaise roundOffPaise totalPaise
    placeOfSupply buyerGstin invoice { id invoiceNo } customer { id code name }
    lines { itemIndex name code hsnSac taxability taxPercent taxablePaise taxPaise cgstPaise sgstPaise igstPaise }
  }`,

  AgreementFields: `fragment AgreementFields on PartnerAgreement {
    id kind shareBp rates { code sharePaise } defaultSharePaise categories effectiveFrom effectiveTo notes
  }`,
  PartnerFields: `fragment PartnerFields on Partner {
    id code name kind legalName pan gstin stateCode phone email address { ...AddressFields }
    tds { section rateBp } active branch { ...BranchRef } ledger { id name } agreements { ...AgreementFields }
  }`,
  SettlementLineFields: `fragment SettlementLineFields on SettlementLine {
    invoiceId invoiceNo day code name netPaise sharePaise agreementId creditNoteId
  }`,
  SettlementFields: `fragment SettlementFields on Settlement {
    id period from to status grossPaise sharePaise deductionsPaise tdsSection tdsRateBp tdsBasePaise tdsPaise netPaise
    paidAt createdAt partner { id code name } branch { ...BranchRef }
    lines { ...SettlementLineFields } deductions { label amountPaise ledgerId }
    accrualVoucher { id voucherNo } payoutVoucher { id voucherNo }
  }`,

  CashClosingFields: `fragment CashClosingFields on CashClosing {
    id day bookPaise countedPaise differencePaise denominations { valuePaise count } notes createdAt
    branch { ...BranchRef } voucher { id voucherNo }
  }`,
  BankStatementFields: `fragment BankStatementFields on BankStatement {
    id fileName from to openingPaise closingPaise lineCount createdAt branch { ...BranchRef } ledger { id name }
  }`,
  BankLineFields: `fragment BankLineFields on BankLine {
    id statementId date description reference debitPaise creditPaise balancePaise status matchKind voucherIds matchedAt
    settlement { ledgerId day grossPaise feePaise }
  }`,
  PeriodLockFields: `fragment PeriodLockFields on PeriodLock { id scope lockedUpTo reason updatedAt branch { ...BranchRef } }`,
  CsvFileFields: `fragment CsvFileFields on CsvFile { fileName mimeType content }`,

  DocumentFields: `fragment DocumentFields on Document { format fileName mimeType byteLength base64 html }`,
  JobFields: `fragment JobFields on Job { id kind state attempts error createdAt finishedAt document { ...DocumentFields } }`,
};

/** Appends every fragment the document spreads, transitively, once each. */
export function withFragments(doc: string): string {
  const seen = new Set<string>();
  const queue = [doc];
  while (queue.length) {
    for (const m of queue.pop()!.matchAll(/\.\.\.\s*([A-Z]\w*)/g)) {
      const name = m[1]!;
      if (seen.has(name) || !FRAGMENTS[name]) continue;
      seen.add(name);
      queue.push(FRAGMENTS[name]);
    }
  }
  return [doc, ...[...seen].map((n) => FRAGMENTS[n])].join("\n");
}

export interface Operation {
  /** The root field whose value the client returns. */
  field: string;
  document: string;
}

/**
 * One root field per operation. `vars` declares the variables ("$id: ID!, $limit: Int"); each one is
 * passed to the field under the same name. Omitted variables fall back to the schema's defaults.
 */
function op(kind: "query" | "mutation", field: string, vars: string, selection: string): Operation {
  const names = [...vars.matchAll(/\$(\w+)\s*:/g)].map((m) => m[1]!);
  const decl = vars ? `(${vars})` : "";
  const args = names.length ? `(${names.map((n) => `${n}: $${n}`).join(", ")})` : "";
  const name = field[0]!.toUpperCase() + field.slice(1);
  const body = selection ? ` { ${selection} }` : "";
  return { field, document: withFragments(`${kind} ${name}${decl} { ${field}${args}${body} }`) };
}
const q = (field: string, vars: string, selection = "") => op("query", field, vars, selection);
const m = (field: string, vars: string, selection = "") => op("mutation", field, vars, selection);

const PAGE = "$limit: Int, $offset: Int";
const RANGE = "$from: DateTime!, $to: DateTime!";
const CSV = "$bom: Boolean";

export const OPERATIONS = {
  // ---------------------------------------------------------------- system
  health: q("health", "", "ok service version database time"),
  ping: m("ping", ""),

  // ---------------------------------------------------------------- auth
  viewer: q("viewer", "", "user { ...UserFields } organization { ...OrganizationFields } permissions"),
  can: {
    field: "viewer",
    document: `query Can($permission: String!, $branchId: ID) { viewer { can(permission: $permission, branchId: $branchId) } }`,
  } as Operation,
  login: m("login", "$input: LoginInput!", "...LoginResultFields"),
  refreshSession: m("refreshSession", "$refreshToken: String!, $device: DeviceInput", "...LoginResultFields"),
  logout: m("logout", "$refreshToken: String"),
  logoutOtherSessions: m("logoutOtherSessions", ""),
  revokeSession: m("revokeSession", "$id: ID!"),
  changePassword: m("changePassword", "$currentPassword: String!, $newPassword: String!"),
  requestPasswordReset: m("requestPasswordReset", "$email: String!, $orgCode: String"),
  resetPassword: m("resetPassword", "$token: String!, $newPassword: String!"),
  mySessions: q("mySessions", "", "...SessionFields"),

  users: q("users", "", "...UserFields"),
  user: q("user", "$id: ID!", "...UserFields"),
  roles: q("roles", "", "...RoleFields"),
  permissions: q("permissions", ""),
  createUser: m("createUser", "$input: CreateUserInput!", "...UserFields"),
  setUserRoles: m("setUserRoles", "$userId: ID!, $roles: [RoleAssignmentInput!]!", "...UserFields"),
  disableUser: m("disableUser", "$userId: ID!", "...UserFields"),
  enableUser: m("enableUser", "$userId: ID!", "...UserFields"),
  setUserPassword: m("setUserPassword", "$userId: ID!, $newPassword: String!"),
  upsertRole: m("upsertRole", "$input: RoleInput!", "...RoleFields"),

  // ---------------------------------------------------------------- organisation
  organization: q("organization", "", "...OrganizationFields"),
  branches: q("branches", "", "...BranchFields"),
  branch: q("branch", "$id: ID!", "...BranchFields"),
  auditLog: q("auditLog", `$entity: String, $entityId: ID, ${PAGE}`, "...AuditEntryFields"),
  updateOrganization: m("updateOrganization", "$input: OrganizationInput!", "...OrganizationFields"),
  createBranch: m("createBranch", "$input: BranchInput!", "...BranchFields"),
  updateBranch: m("updateBranch", "$id: ID!, $input: BranchPatch!", "...BranchFields"),

  // ---------------------------------------------------------------- catalog (no sign-in needed)
  catalogSearch: q(
    "catalogSearch",
    "$query: String!, $department: String, $sampleType: String, $limit: Int, $fuzzy: Boolean",
    "score test { ...CatalogTestFields }",
  ),
  catalogTest: {
    field: "catalogTest",
    document: withFragments(`query CatalogTest($id: Int, $code: String, $sex: Sex) {
  catalogTest(id: $id, code: $code) {
    ...CatalogTestFields secondarySampleTypes
    parameters { name unit method type options calculated formulaText referenceText range(sex: $sex) }
  }
}`),
  } as Operation,
  catalogTests: q("catalogTests", `$department: String, $sampleType: String, ${PAGE}`, "...CatalogTestFields"),
  catalogDepartments: q("catalogDepartments", ""),
  catalogSampleTypes: q("catalogSampleTypes", ""),
  priceQuote: q("priceQuote", "$tests: [String!]!", "total totalPaise unknown tests { ...CatalogTestFields }"),

  // ---------------------------------------------------------------- lab
  patients: q("patients", "$search: String!, $limit: Int", "...PatientFields"),
  patient: q("patient", "$id: ID!", "...PatientFields"),
  registerPatient: m("registerPatient", "$input: RegisterPatientInput!", "...PatientFields"),
  updatePatient: m("updatePatient", "$id: ID!, $input: UpdatePatientInput!", "...PatientFields"),

  doctors: q("doctors", "$activeOnly: Boolean", "...DoctorFields"),
  createDoctor: m("createDoctor", "$input: DoctorInput!", "...DoctorFields"),
  updateDoctor: m("updateDoctor", "$id: ID!, $input: DoctorPatch!", "...DoctorFields"),

  bookings: q("bookings", `$branchId: ID, $patientId: ID, $status: BookingStatus, ${PAGE}`, "...BookingFields"),
  booking: q("booking", "$id: ID!", "...BookingFields"),
  createBooking: m("createBooking", "$input: CreateBookingInput!", "booking { ...BookingFields } samples { ...SampleFields }"),
  cancelBooking: m("cancelBooking", "$id: ID!", "...BookingFields"),

  sample: q("sample", "$id: ID!", "...SampleFields"),
  sampleByBarcode: q("sampleByBarcode", "$barcode: String!", "...SampleFields"),
  collectSample: m("collectSample", "$id: ID!", "...SampleFields"),
  receiveSample: m("receiveSample", "$id: ID!", "...SampleFields"),
  rejectSample: m("rejectSample", "$id: ID!, $reason: String!", "...SampleFields"),

  report: q("report", "$id: ID!", "...ReportFields"),
  createReport: m("createReport", "$bookingId: ID!, $testCode: String!, $testName: String", "...ReportFields"),
  saveResults: m("saveResults", "$reportId: ID!, $results: [ResultInput!]!", "...ReportFields"),
  verifyReport: m("verifyReport", "$id: ID!", "...ReportFields"),
  releaseReport: m("releaseReport", "$id: ID!", "...ReportFields"),
  amendReport: m("amendReport", "$id: ID!", "...ReportFields"),

  // ---------------------------------------------------------------- billing
  invoices: q(
    "invoices",
    `$branchId: ID, $patientId: ID, $customerId: ID, $status: InvoiceStatus, ${PAGE}`,
    "...InvoiceFields",
  ),
  invoice: q("invoice", "$id: ID!", "...InvoiceFields"),
  issueInvoice: m("issueInvoice", "$input: IssueInvoiceInput!", "...InvoiceFields"),
  recordPayment: m("recordPayment", "$invoiceId: ID!, $payment: PaymentInput!", "...InvoiceFields"),
  refundPayment: m("refundPayment", "$invoiceId: ID!, $payment: PaymentInput!", "...InvoiceFields"),
  cancelInvoice: m("cancelInvoice", "$id: ID!, $reason: String!", "...InvoiceFields"),

  // ---------------------------------------------------------------- books
  accountGroups: q("accountGroups", "", "...AccountGroupFields"),
  ledgers: q("ledgers", "", "...LedgerFields"),
  ledger: q("ledger", "$id: ID!", "...LedgerFields"),
  voucher: q("voucher", "$id: ID!", "...VoucherFields"),
  ledgerStatement: q("ledgerStatement", `$ledgerId: ID!, ${RANGE}, $branchId: ID`, "...LedgerStatementFields"),
  cashBook: q("cashBook", `${RANGE}, $branchId: ID`, "...LedgerStatementFields"),
  trialBalance: q(
    "trialBalance",
    "$asOf: DateTime, $branchId: ID",
    "rows { ledger { id name } group { id name } primaryGroup { id name } debitPaise creditPaise } totalDebitPaise totalCreditPaise differencePaise",
  ),
  profitAndLoss: q(
    "profitAndLoss",
    `${RANGE}, $branchId: ID`,
    "income { ...GroupLineFields } expenses { ...GroupLineFields } grossProfitPaise netProfitPaise",
  ),
  balanceSheet: q(
    "balanceSheet",
    "$asOf: DateTime!, $branchId: ID",
    "assets { ...GroupLineFields } liabilities { ...GroupLineFields } profitPaise totalAssetsPaise totalLiabilitiesPaise differencePaise",
  ),
  dayBook: q("dayBook", `${RANGE}, $branchId: ID, $type: VoucherType`, "...VoucherFields"),
  outstandingReceivables: q(
    "outstandingReceivables",
    "$asOf: DateTime, $branchId: ID",
    "rows { invoice { id invoiceNo duePaise patient { name } } ageDays bucket } buckets { d0to30 d31to60 d61to90 d90plus } totalDuePaise",
  ),
  gstSummary: q("gstSummary", `${RANGE}, $branchId: ID`, "taxableValuePaise cgstPaise sgstPaise igstPaise totalTaxPaise"),
  setupChartOfAccounts: m("setupChartOfAccounts", "", "...LedgerFields"),
  createLedger: m("createLedger", "$input: LedgerInput!", "...LedgerFields"),
  postVoucher: m("postVoucher", "$input: PostVoucherInput!", "...VoucherFields"),
  cancelVoucher: m("cancelVoucher", "$id: ID!", "...VoucherFields"),

  // ---------------------------------------------------------------- GST
  taxRules: q("taxRules", "", "...TaxRuleFields"),
  addTaxRule: m("addTaxRule", "$input: TaxRuleInput!", "...TaxRuleFields"),
  seedTaxRules: m("seedTaxRules", "", "...TaxRuleFields"),
  financeConfig: q(
    "financeConfig",
    "",
    "b2clThresholdPaise tds { section rateBp noPanRateBp thresholdPaise } bankToleranceDays bankMaxFeeBp clearingLedgerKeys",
  ),
  verifyWithCA: q("verifyWithCA", ""),
  gstr1: q(
    "gstr1",
    `${RANGE}, $gstin: String`,
    `gstin period { from to }
    b2b { ...Gstr1InvoiceFields } b2cl { ...Gstr1InvoiceFields }
    b2cs { supplyType placeOfSupply ratePercent taxablePaise igstPaise cgstPaise sgstPaise cessPaise }
    cdnr { ...Gstr1NoteFields } cdnur { ...Gstr1NoteFields }
    nil { description nilRatedPaise exemptedPaise nonGstPaise }
    hsn { b2b { ...HsnRowFields } b2c { ...HsnRowFields } }
    docs { nature series from to total cancelled net }
    totals { ...TaxTotalsFields } verifyWithCA`,
  ),
  gstr3b: q(
    "gstr3b",
    `${RANGE}, $gstin: String`,
    `gstin period { from to } outwardTaxable { ...TaxTotalsFields } outwardNilExemptPaise outwardNonGstPaise
    interStateUnregistered { placeOfSupply taxablePaise igstPaise } verifyWithCA`,
  ),

  // ---------------------------------------------------------------- receivables (B2B)
  customers: q("customers", "$activeOnly: Boolean", "...CustomerFields"),
  customer: q("customer", "$id: ID!", "...CustomerFields"),
  createCustomer: m("createCustomer", "$input: CustomerInput!", "...CustomerFields"),
  updateCustomer: m("updateCustomer", "$id: ID!, $input: CustomerPatch!", "...CustomerFields"),
  issueCustomerInvoice: m("issueCustomerInvoice", "$input: CustomerInvoiceInput!", "...InvoiceFields"),
  customerStatement: q(
    "customerStatement",
    `$customerId: ID!, ${RANGE}`,
    `customer { ...CustomerFields } openingPaise rows { ...StatementRowFields } totalDebitPaise totalCreditPaise closingPaise
    open { invoiceId invoiceNo day dueDay totalPaise paidPaise creditedPaise duePaise overdueDays bucket }
    ageing { ...AgeingFields } openTotalPaise availableCreditPaise`,
  ),
  receivablesSummary: q(
    "receivablesSummary",
    "$asOf: DateTime!",
    "rows { customer { id code name } balancePaise overduePaise ageing { ...AgeingFields } } totalPaise",
  ),
  creditNotes: q("creditNotes", `$customerId: ID, $invoiceId: ID, ${PAGE}`, "...CreditNoteFields"),
  creditNote: q("creditNote", "$id: ID!", "...CreditNoteFields"),
  issueCreditNote: m(
    "issueCreditNote",
    "$input: CreditNoteInput!",
    "creditNote { ...CreditNoteFields } invoice { ...InvoiceFields } refundablePaise",
  ),

  // ---------------------------------------------------------------- partners and settlements
  partners: q("partners", "$branchId: ID", "...PartnerFields"),
  partner: q("partner", "$id: ID!", "...PartnerFields"),
  createPartner: m("createPartner", "$input: PartnerInput!", "...PartnerFields"),
  updatePartner: m("updatePartner", "$id: ID!, $input: PartnerPatch!", "...PartnerFields"),
  addAgreement: m("addAgreement", "$input: AgreementInput!", "...AgreementFields"),
  settlementPreview: q(
    "settlementPreview",
    "$partnerId: ID!, $period: String!, $deductions: [SettlementDeductionInput!]",
    `period from to lines { ...SettlementLineFields } grossPaise sharePaise deductions { label amountPaise ledgerId }
    deductionsPaise tds { section rateBp basePaise tdsPaise } netPaise uncoveredInvoices partner { id code name }`,
  ),
  settlements: q(
    "settlements",
    `$branchId: ID, $partnerId: ID, $status: SettlementStatus, ${PAGE}`,
    "...SettlementFields",
  ),
  settlement: q("settlement", "$id: ID!", "...SettlementFields"),
  createSettlement: m(
    "createSettlement",
    "$partnerId: ID!, $period: String!, $deductions: [SettlementDeductionInput!]",
    "...SettlementFields",
  ),
  accrueSettlement: m("accrueSettlement", "$id: ID!", "...SettlementFields"),
  paySettlement: m("paySettlement", "$input: PaySettlementInput!", "...SettlementFields"),
  cancelSettlement: m("cancelSettlement", "$id: ID!", "...SettlementFields"),

  // ---------------------------------------------------------------- cash and bank
  cashClosings: q("cashClosings", `$branchId: ID!, ${PAGE}`, "...CashClosingFields"),
  closeCashDay: m("closeCashDay", "$input: CloseCashDayInput!", "...CashClosingFields"),
  bankStatements: q("bankStatements", `$ledgerId: ID, ${PAGE}`, "...BankStatementFields"),
  bankLines: q(
    "bankLines",
    `$ledgerId: ID, $statementId: ID, $status: BankLineStatus, ${PAGE}`,
    "...BankLineFields",
  ),
  importBankStatement: m(
    "importBankStatement",
    "$input: BankImportInput!",
    "added skipped statement { ...BankStatementFields }",
  ),
  reconcileBank: m("reconcileBank", "$ledgerId: ID!, $statementId: ID", "matched unmatched settlements"),
  matchBankLine: m("matchBankLine", "$lineId: ID!, $voucherIds: [ID!]!", "...BankLineFields"),
  setBankLineStatus: m("setBankLineStatus", "$lineId: ID!, $status: BankLineManualStatus!", "...BankLineFields"),
  bankReconciliation: q(
    "bankReconciliation",
    "$ledgerId: ID!, $asOf: DateTime!",
    `bookPaise bankPaise paymentsNotPresentedPaise depositsNotCreditedPaise bankCreditsNotInBooksPaise
    bankDebitsNotInBooksPaise expectedBankPaise differencePaise reconciled { lines amountPaise }
    unmatchedLines { ...BankLineFields }
    unreconciledEntries { id voucherId voucherType voucherNo date debitPaise creditPaise invoiceId }`,
  ),

  // ---------------------------------------------------------------- periods
  lockDates: q("lockDates", "", "...PeriodLockFields"),
  setLockDate: m("setLockDate", "$input: LockDateInput!", "...PeriodLockFields"),
  closeFinancialYear: m("closeFinancialYear", "$fy: String!", "netProfitPaise vouchers { ...VoucherFields }"),

  // ---------------------------------------------------------------- CSV exports
  exportTrialBalance: q("exportTrialBalance", `$asOf: DateTime, $branchId: ID, ${CSV}`, "...CsvFileFields"),
  exportProfitAndLoss: q("exportProfitAndLoss", `${RANGE}, $branchId: ID, ${CSV}`, "...CsvFileFields"),
  exportBalanceSheet: q("exportBalanceSheet", `$asOf: DateTime!, $branchId: ID, ${CSV}`, "...CsvFileFields"),
  exportDayBook: q("exportDayBook", `${RANGE}, $branchId: ID, ${CSV}`, "...CsvFileFields"),
  exportLedger: q("exportLedger", `$ledgerId: ID!, ${RANGE}, $branchId: ID, ${CSV}`, "...CsvFileFields"),
  exportGstr1: q("exportGstr1", `${RANGE}, $gstin: String, ${CSV}`, "...CsvFileFields"),
  exportGstr3b: q("exportGstr3b", `${RANGE}, $gstin: String, ${CSV}`, "...CsvFileFields"),
  exportSettlement: q("exportSettlement", `$settlementId: ID!, ${CSV}`, "...CsvFileFields"),

  // ---------------------------------------------------------------- documents (PDF as base64, or HTML)
  reportTemplates: q(
    "reportTemplates",
    "",
    "templates { id name category specimen method fields { key label unit range } } profiles { id name tests }",
  ),
  priceList: q("priceList", "", "code name category rate taxPercent hsn"),
  documentSamples: q("documentSamples", "", "id label group"),
  invoiceSamples: q("invoiceSamples", "", "id label group"),
  renderReport: q(
    "renderReport",
    "$request: JSON!, $format: DocumentFormat, $variant: ReportVariant, $design: ReportDesign, $fileName: String",
    "...DocumentFields",
  ),
  renderInvoice: q(
    "renderInvoice",
    "$request: JSON!, $format: DocumentFormat, $variant: ReportVariant, $fileName: String",
    "...DocumentFields",
  ),
  invoiceTotals: q("invoiceTotals", "$request: JSON!"),
  letterhead: q("letterhead", "$format: DocumentFormat", "...DocumentFields"),
  invoiceDocument: q(
    "invoiceDocument",
    "$invoiceId: ID!, $format: DocumentFormat, $variant: ReportVariant",
    "...DocumentFields",
  ),
  bookingReportDocument: q(
    "bookingReportDocument",
    "$bookingId: ID!, $reportIds: [ID!], $format: DocumentFormat, $variant: ReportVariant, $design: ReportDesign",
    "...DocumentFields",
  ),
  job: q("job", "$id: ID!", "...JobFields"),
  startDocumentJob: m("startDocumentJob", "$input: DocumentJobInput!", "...JobFields"),
} satisfies Record<string, Operation>;

export type OperationName = keyof typeof OPERATIONS;
