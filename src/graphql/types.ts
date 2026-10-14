// What the client's operations return: the API's GraphQL types (mgpl-diagnostics/api, schema.graphql)
// as selected by src/graphql/operations.ts. Money is integer paise (Rs 1 = 100). DateTime values are
// ISO strings; Day values are "YYYY-MM-DD" (IST). The API's contract test validates every operation.

export type ID = string;
export type DateTime = string;
export type Day = string;

export type Sex = "male" | "female" | "other";
export type PaymentMode = "cash" | "upi" | "card" | "netbanking" | "wallet" | "cheque" | "insurance";
export type ItemCategory = "test" | "package" | "service" | "consumable" | "medicine" | "other";
export type Taxability = "taxable" | "exempt" | "nil_rated" | "non_gst";
export type VoucherType = "sales" | "receipt" | "payment" | "journal" | "contra" | "credit_note" | "debit_note" | "purchase" | "closing";
export type BranchKind = "lab" | "collection_center";
export type BookingStatus = "booked" | "sample_collected" | "in_process" | "completed" | "cancelled";
export type CollectionType = "walk_in" | "home";
export type SampleStatus = "pending" | "collected" | "received" | "rejected";
export type ReportStatus = "draft" | "entered" | "verified" | "released" | "amended";
/** "NONE" = within range. */
export type ResultFlag = "L" | "H" | "A" | "NONE";
export type InvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "cancelled" | "refunded" | "credited";
export type DocumentFormat = "pdf" | "html";
export type ReportVariant = "header" | "non_header";
export type ReportDesign = "sidebar" | "classic";
export type CustomerKind = "hospital" | "insurer" | "tpa" | "corporate" | "other";
export type PartnerKind = "collection_centre" | "franchise";
export type AgreementKind = "revenue_share" | "fixed_rate";
export type SettlementStatus = "draft" | "accrued" | "paid" | "cancelled";
export type BankLineStatus = "unmatched" | "matched" | "ignored";

export interface Address { line1?: string | null; line2?: string | null; city?: string | null; district?: string | null; state?: string | null; pincode?: string | null }
export interface Ref { id: ID; name: string }
export interface BranchRef { id: ID; code: string; name: string }

// ------------------------------------------------------------------ auth, organisation

export interface RoleAssignment { role: string; branchId: ID | null }
export interface User { id: ID; name: string; email: string; phone: string | null; status: "active" | "disabled" | "invited"; roles: RoleAssignment[]; lastLoginAt: DateTime | null; createdAt: DateTime }
export interface Role { id: ID; key: string; name: string; permissions: string[]; system: boolean }
export interface Session { id: ID; current: boolean; createdAt: DateTime; lastSeenAt: DateTime; expiresAt: DateTime; ip: string | null; userAgent: string | null; deviceId: string | null; deviceInfo: Record<string, string | number | boolean> | null }
/** login and refreshSession. The access token goes in `Authorization: Bearer`; the refresh token buys the next pair. */
export interface LoginResult { accessToken: string; accessExpiresAt: DateTime; refreshToken: string; refreshExpiresAt: DateTime; user: User }
export interface Branch { id: ID; code: string; name: string; kind: BranchKind; phone: string | null; gstin: string | null; stateCode: string | null; address: Address | null; active: boolean }
export interface Organization { id: ID; name: string; code: string; legalName: string | null; gstin: string | null; phone: string | null; email: string | null; address: Address | null; branches: Branch[] }
export interface Viewer { user: User; organization: Organization; permissions: string[] }
export interface AuditEntry { id: ID; action: string; entity: string | null; entityId: ID | null; branchId: ID | null; user: { id: ID; name: string } | null; at: DateTime }
export interface Health { ok: boolean; service: string; version: string; database: string; time: DateTime }

// ------------------------------------------------------------------ catalog

export interface CatalogParameter { name: string | null; unit: string | null; method: string | null; type: "numeric" | "text" | "options" | "image" | "title"; options: string[] | null; calculated: boolean; formulaText: string | null; referenceText: string | null; range: string }
export interface CatalogTest { id: number; name: string; code: string | null; shortCode: string | null; department: string; sampleType: string | null; mrp: number | null; pricePaise: number | null; isProfile: boolean; parameterCount: number }
export interface CatalogTestDetail extends CatalogTest { secondarySampleTypes: string[] | null; parameters: CatalogParameter[] }
export interface CatalogHit { test: CatalogTest; score: number }
export interface PriceQuote { total: number; totalPaise: number; tests: CatalogTest[]; unknown: string[] }

// ------------------------------------------------------------------ lab

export interface Patient { id: ID; uhid: string; title: string | null; name: string; sex: Sex; dob: DateTime | null; ageYears: number | null; phone: string | null; email: string | null; address: Address | null; createdAt: DateTime; branch: BranchRef | null }
export interface Doctor { id: ID; name: string; qualification: string | null; phone: string | null; clinic: string | null; active: boolean }
export interface Sample { id: ID; barcode: string; sampleType: string; status: SampleStatus; collectedAt: DateTime | null; receivedAt: DateTime | null; rejectReason: string | null }
export interface ResultValue { parameter: string; value: string; unit: string | null; flag: ResultFlag | null; range: string | null }
export interface Report { id: ID; testCode: string; testName: string; status: ReportStatus; version: number; verifiedAt: DateTime | null; releasedAt: DateTime | null; updatedAt: DateTime; results: ResultValue[] }
export interface BookingTest { testCode: string; name: string; pricePaise: number; sampleType: string | null }
export interface Booking {
  id: ID; bookingNo: string; status: BookingStatus; notes: string | null; createdAt: DateTime;
  patient: { id: ID; uhid: string; name: string }; doctor: Ref | null; branch: BranchRef;
  tests: BookingTest[]; sampleCollection: { type: CollectionType; scheduledAt: DateTime | null };
  samples: Sample[]; reports: { id: ID; testCode: string; testName: string; status: ReportStatus }[];
  invoice: { id: ID; invoiceNo: string; status: InvoiceStatus; totalPaise: number; duePaise: number } | null;
}

// ------------------------------------------------------------------ billing

export interface InvoiceItem { code: string | null; name: string; category: ItemCategory; qty: number; ratePaise: number; discountPaise: number; taxPercent: number; hsnSac: string | null; taxability: Taxability | null; amountPaise: number }
export interface Payment { id: ID; kind: "payment" | "refund"; amountPaise: number; mode: PaymentMode; reference: string | null; receivedAt: DateTime }
export interface Invoice {
  id: ID; invoiceNo: string; status: InvoiceStatus; placeOfSupply: string | null; buyerGstin: string | null;
  subtotalPaise: number; discountPaise: number; taxPaise: number; roundOffPaise: number; totalPaise: number; paidPaise: number; creditedPaise: number; duePaise: number;
  issuedAt: DateTime | null; cancelReason: string | null; createdAt: DateTime;
  patient: { id: ID; uhid: string; name: string }; branch: BranchRef; customer: { id: ID; code: string; name: string } | null;
  items: InvoiceItem[]; payments: Payment[];
}

// ------------------------------------------------------------------ books

export type AccountNature = "assets" | "liabilities" | "income" | "expenses";
export interface AccountGroup { id: ID; name: string; nature: AccountNature; affectsGrossProfit: boolean; parent: { id: ID; name: string } | null }
export interface Ledger { id: ID; name: string; systemKey: string | null; gstin: string | null; openingPaise: number; active: boolean; group: { id: ID; name: string; nature: AccountNature } }
export interface VoucherEntry { ledger: { id: ID; name: string }; debitPaise: number; creditPaise: number; invoiceId: ID | null }
export interface Voucher { id: ID; type: VoucherType; voucherNo: string; date: DateTime; narration: string | null; status: "posted" | "cancelled"; invoiceId: ID | null; entries: VoucherEntry[] }
export interface StatementRow { date: DateTime; voucherNo: string; voucherType: VoucherType; debitPaise: number; creditPaise: number; balancePaise: number; invoiceId: ID | null }
export interface LedgerStatement { ledger: { id: ID; name: string }; openingPaise: number; closingPaise: number; totalDebitPaise: number; totalCreditPaise: number; rows: StatementRow[] }
export interface TrialBalance { rows: { ledger: { id: ID; name: string }; group: { id: ID; name: string }; primaryGroup: { id: ID; name: string }; debitPaise: number; creditPaise: number }[]; totalDebitPaise: number; totalCreditPaise: number; differencePaise: number }
export interface GroupLine { group: { id: ID; name: string }; amountPaise: number; ledgers: { ledger: { id: ID; name: string }; amountPaise: number }[] }
export interface ProfitAndLoss { income: GroupLine[]; expenses: GroupLine[]; grossProfitPaise: number; netProfitPaise: number }
export interface BalanceSheet { assets: GroupLine[]; liabilities: GroupLine[]; profitPaise: number; totalAssetsPaise: number; totalLiabilitiesPaise: number; differencePaise: number }
export interface Outstanding { rows: { invoice: { id: ID; invoiceNo: string; duePaise: number; patient: { name: string } }; ageDays: number; bucket: "D0_30" | "D31_60" | "D61_90" | "D90_PLUS" }[]; buckets: { d0to30: number; d31to60: number; d61to90: number; d90plus: number }; totalDuePaise: number }
export interface GstSummary { taxableValuePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalTaxPaise: number }

// ------------------------------------------------------------------ finance

export interface TaxRule { id: ID; code: string | null; category: ItemCategory | null; hsnSac: string; taxability: Taxability; ratePercent: number; effectiveFrom: DateTime; effectiveTo: DateTime | null; note: string | null }
export interface FinanceConfig { b2clThresholdPaise: number; tds: { section: string; rateBp: number; noPanRateBp: number; thresholdPaise: number | null }; bankToleranceDays: number; bankMaxFeeBp: number; clearingLedgerKeys: string[] }
export interface TaxTotals { taxablePaise: number; igstPaise: number; cgstPaise: number; sgstPaise: number; cessPaise: number }
export interface RateTotals extends TaxTotals { ratePercent: number }
export interface Gstr1Invoice { invoiceId: ID; invoiceNo: string; day: Day; valuePaise: number; placeOfSupply: string; reverseCharge: string; ctin: string | null; items: RateTotals[] }
export interface Gstr1Note { noteId: ID; noteNo: string; day: Day; noteType: string; invoiceNo: string; invoiceDay: Day; valuePaise: number; placeOfSupply: string; ctin: string | null; type: string | null; items: RateTotals[] }
export interface HsnRow extends TaxTotals { hsnSac: string; ratePercent: number; taxability: Taxability; qty: number; totalValuePaise: number }
export interface Gstr1 {
  gstin: string; period: { from: DateTime; to: DateTime };
  b2b: Gstr1Invoice[]; b2cl: Gstr1Invoice[];
  b2cs: (TaxTotals & { supplyType: string; placeOfSupply: string; ratePercent: number })[];
  cdnr: Gstr1Note[]; cdnur: Gstr1Note[];
  nil: { description: string; nilRatedPaise: number; exemptedPaise: number; nonGstPaise: number }[];
  hsn: { b2b: HsnRow[]; b2c: HsnRow[] };
  docs: { nature: string; series: string; from: string; to: string; total: number; cancelled: number; net: number }[];
  totals: TaxTotals; verifyWithCA: string[];
}
export interface Gstr3b { gstin: string; period: { from: DateTime; to: DateTime }; outwardTaxable: TaxTotals; outwardNilExemptPaise: number; outwardNonGstPaise: number; interStateUnregistered: { placeOfSupply: string; taxablePaise: number; igstPaise: number }[]; verifyWithCA: string[] }

export interface Customer { id: ID; code: string; name: string; kind: CustomerKind; legalName: string | null; gstin: string | null; stateCode: string | null; pan: string | null; phone: string | null; email: string | null; address: Address | null; creditLimitPaise: number | null; creditDays: number; active: boolean; ledger: { id: ID; name: string } }
export interface Ageing { notDue: number; d1to30: number; d31to60: number; d61to90: number; d90plus: number }
export interface OpenItem { invoiceId: ID; invoiceNo: string; day: Day; dueDay: Day; totalPaise: number; paidPaise: number; creditedPaise: number; duePaise: number; overdueDays: number; bucket: "not_due" | "D1_30" | "D31_60" | "D61_90" | "D90_PLUS" }
export interface CustomerStatement { customer: Customer; openingPaise: number; rows: StatementRow[]; totalDebitPaise: number; totalCreditPaise: number; closingPaise: number; open: OpenItem[]; ageing: Ageing; openTotalPaise: number; availableCreditPaise: number | null }
export interface ReceivablesSummary { rows: { customer: { id: ID; code: string; name: string }; balancePaise: number; overduePaise: number; ageing: Ageing }[]; totalPaise: number }
export interface CreditNoteLine { itemIndex: number; name: string; code: string | null; hsnSac: string | null; taxability: Taxability | null; taxPercent: number; taxablePaise: number; taxPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }
export interface CreditNote { id: ID; noteNo: string; date: DateTime; reason: string; status: string; taxablePaise: number; taxPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; roundOffPaise: number; totalPaise: number; placeOfSupply: string | null; buyerGstin: string | null; invoice: { id: ID; invoiceNo: string }; customer: { id: ID; code: string; name: string } | null; lines: CreditNoteLine[] }

export interface PartnerAgreement { id: ID; kind: AgreementKind; shareBp: number | null; rates: { code: string; sharePaise: number }[] | null; defaultSharePaise: number | null; categories: ItemCategory[] | null; effectiveFrom: DateTime; effectiveTo: DateTime | null; notes: string | null }
export interface Partner { id: ID; code: string; name: string; kind: PartnerKind; legalName: string | null; pan: string | null; gstin: string | null; stateCode: string | null; phone: string | null; email: string | null; address: Address | null; tds: { section: string; rateBp: number } | null; active: boolean; branch: BranchRef; ledger: { id: ID; name: string }; agreements: PartnerAgreement[] }
export interface SettlementLine { invoiceId: ID; invoiceNo: string; day: Day; code: string | null; name: string; netPaise: number; sharePaise: number; agreementId: ID; creditNoteId: ID | null }
export interface SettlementDeduction { label: string; amountPaise: number; ledgerId?: ID | null }
export interface SettlementPreview { period: string; from: DateTime; to: DateTime; lines: SettlementLine[]; grossPaise: number; sharePaise: number; deductions: SettlementDeduction[]; deductionsPaise: number; tds: { section: string | null; rateBp: number; basePaise: number; tdsPaise: number }; netPaise: number; uncoveredInvoices: string[]; partner: { id: ID; code: string; name: string } }
export interface Settlement { id: ID; period: string; from: DateTime; to: DateTime; status: SettlementStatus; grossPaise: number; sharePaise: number; deductionsPaise: number; tdsSection: string | null; tdsRateBp: number; tdsBasePaise: number; tdsPaise: number; netPaise: number; paidAt: DateTime | null; createdAt: DateTime; partner: { id: ID; code: string; name: string }; branch: BranchRef; lines: SettlementLine[]; deductions: SettlementDeduction[]; accrualVoucher: { id: ID; voucherNo: string } | null; payoutVoucher: { id: ID; voucherNo: string } | null }

export interface CashClosing { id: ID; day: Day; bookPaise: number; countedPaise: number; differencePaise: number; denominations: { valuePaise: number; count: number }[] | null; notes: string | null; createdAt: DateTime; branch: BranchRef; voucher: { id: ID; voucherNo: string } | null }
export interface BankStatement { id: ID; fileName: string | null; from: DateTime | null; to: DateTime | null; openingPaise: number | null; closingPaise: number | null; lineCount: number; createdAt: DateTime; branch: BranchRef; ledger: { id: ID; name: string } }
export interface BankLine { id: ID; statementId: ID; date: DateTime; description: string; reference: string | null; debitPaise: number; creditPaise: number; balancePaise: number | null; status: BankLineStatus; matchKind: string | null; voucherIds: ID[]; matchedAt: DateTime | null; settlement: { ledgerId: ID; day: Day; grossPaise: number; feePaise: number } | null }
export interface BankReconciliation { bookPaise: number; bankPaise: number | null; paymentsNotPresentedPaise: number; depositsNotCreditedPaise: number; bankCreditsNotInBooksPaise: number; bankDebitsNotInBooksPaise: number; expectedBankPaise: number; differencePaise: number | null; reconciled: { lines: number; amountPaise: number }; unmatchedLines: BankLine[]; unreconciledEntries: { id: ID; voucherId: ID; voucherType: VoucherType; voucherNo: string; date: DateTime; debitPaise: number; creditPaise: number; invoiceId: ID | null }[] }
export interface PeriodLock { id: ID; scope: string; lockedUpTo: DateTime | null; reason: string | null; updatedAt: DateTime; branch: BranchRef | null }
export interface CsvFile { fileName: string; mimeType: string; content: string }

// ------------------------------------------------------------------ documents

/** A rendered PDF (base64) or self-contained HTML. Turn a PDF into a Blob with documentBlob(). */
export interface RenderedDocument { format: DocumentFormat; fileName: string; mimeType: string; byteLength: number; base64: string | null; html: string | null }
export interface ReportTemplateInfo { id: string; name: string; category: string | null; specimen: string | null; method: string | null; fields: { key: string; label: string; unit: string | null; range: string[] | null }[] }
export interface ReportTemplateCatalog { templates: ReportTemplateInfo[]; profiles: { id: string; name: string; tests: string[] }[] }
export interface PriceListEntry { code: string; name: string; category: string; rate: number; taxPercent: number | null; hsn: string | null }

// ------------------------------------------------------------------ inputs

export interface RoleAssignmentInput { role: string; branchId?: ID | null }
export interface CreateUserInput { name: string; email: string; phone?: string; password: string; roles: RoleAssignmentInput[] }
export interface BranchInput { code: string; name: string; kind: BranchKind; phone?: string; gstin?: string; stateCode?: string; address?: Address; active?: boolean }
export interface RegisterPatientInput { branchId: ID; title?: string; name: string; sex: Sex; dob?: DateTime; ageYears?: number; phone?: string; email?: string; address?: Address }
export type UpdatePatientInput = Partial<Omit<RegisterPatientInput, "branchId">>;
export interface DoctorInput { name: string; qualification?: string; phone?: string; clinic?: string; active?: boolean }
/** A catalog code alone is enough: name, price and sample type come from the test catalog. */
export interface BookingTestInput { testCode: string; name?: string; pricePaise?: number; sampleType?: string }
export interface CreateBookingInput { branchId: ID; patientId: ID; doctorId?: ID; tests: BookingTestInput[]; collectionType?: CollectionType; scheduledAt?: DateTime; notes?: string }
/** Unit, range and flag are filled from the catalog when omitted. */
export interface ResultInput { parameter: string; value: string; unit?: string; flag?: ResultFlag; range?: string }
/** A catalog code alone is enough: name and MRP come from the test catalog. */
export interface InvoiceItemInput { code?: string; name?: string; category?: ItemCategory; qty?: number; ratePaise?: number; discountPaise?: number; taxPercent?: number; hsnSac?: string; taxability?: Taxability }
export interface PaymentInput { amountPaise: number; mode: PaymentMode; reference?: string }
export interface IssueInvoiceInput { branchId: ID; patientId: ID; bookingId?: ID; items: InvoiceItemInput[]; billDiscountPaise?: number; payments?: PaymentInput[]; applyTaxRules?: boolean }
export interface PostVoucherInput { branchId: ID; type: VoucherType; date?: DateTime; narration?: string; entries: { ledgerId: ID; debitPaise?: number; creditPaise?: number; invoiceId?: ID }[] }
export interface LedgerInput { name: string; groupId: ID; openingPaise?: number; gstin?: string }
export interface TaxRuleInput { code?: string; category?: ItemCategory; hsnSac: string; taxability: Taxability; ratePercent: number; effectiveFrom: Day; note?: string }
export interface CustomerInput { code: string; name: string; kind: CustomerKind; legalName?: string; gstin?: string; stateCode?: string; pan?: string; phone?: string; email?: string; address?: Address; creditLimitPaise?: number | null; creditDays?: number }
export type CustomerPatch = Partial<Omit<CustomerInput, "code">> & { active?: boolean };
export interface CustomerInvoiceInput extends Omit<IssueInvoiceInput, "applyTaxRules"> { customerId: ID; placeOfSupply?: string; applyTaxRules?: boolean }
export interface CreditNoteInput { invoiceId: ID; reason: string; lines?: { itemIndex: number; taxablePaise?: number }[]; date?: DateTime }
export interface PartnerInput { code: string; name: string; kind: PartnerKind; branchId: ID; legalName?: string; pan?: string; gstin?: string; stateCode?: string; phone?: string; email?: string; address?: Address; tds?: { section: string; rateBp: number } }
export type PartnerPatch = Partial<Omit<PartnerInput, "code" | "branchId" | "tds">> & { tds?: { section: string; rateBp: number } | null; active?: boolean };
export interface AgreementInput { partnerId: ID; kind: AgreementKind; shareBp?: number; rates?: { code: string; sharePaise: number }[]; defaultSharePaise?: number; categories?: ItemCategory[]; effectiveFrom: Day; effectiveTo?: Day; notes?: string }
export interface CloseCashDayInput { branchId: ID; day: Day; countedPaise: number; denominations?: { valuePaise: number; count: number }[]; notes?: string }
export interface BankImportInput { branchId: ID; ledgerId: ID; csv: string; fileName?: string }
export interface LockDateInput { branchId?: ID; upTo: Day | null; reason?: string }
export type JobState = "waiting" | "active" | "completed" | "failed" | "delayed";
export type DocumentJobKind = "invoice" | "booking_reports";
/** Background work (the API's worker). Poll with documents.job(id) or documents.waitForJob(id). */
export interface Job { id: ID; kind: DocumentJobKind; state: JobState; attempts: number; error: string | null; createdAt: DateTime; finishedAt: DateTime | null; document: RenderedDocument | null }
export interface DocumentJobInput { kind: DocumentJobKind; invoiceId?: ID; bookingId?: ID; reportIds?: ID[]; format?: DocumentFormat; variant?: ReportVariant; design?: ReportDesign }
export interface RenderOptions { format?: DocumentFormat; variant?: ReportVariant; design?: ReportDesign; fileName?: string }

// ------------------------------------------------------------------ mutation results

export interface CreateBookingResult { booking: Booking; samples: Sample[] }
export interface CreditNoteResult { creditNote: CreditNote; invoice: Invoice; refundablePaise: number }
export interface BankImportResult { added: number; skipped: number; statement: BankStatement }
export interface ReconcileResult { matched: number; unmatched: number; settlements: number }
export interface YearEndResult { netProfitPaise: number; vouchers: Voucher[] }
export interface DocumentSample { id: string; label: string; group: string | null }
/** Security signals sent with login and refresh (see "./device"). All optional. */
export interface DeviceInput { deviceId?: string; fingerprint?: string; clientSessionId?: string; info?: Record<string, string | number | boolean> }
export interface LoginInput { email: string; password: string; orgCode?: string; device?: DeviceInput }
export interface RoleInput { key: string; name: string; permissions: string[] }
export type OrganizationInput = Partial<Pick<Organization, "name" | "legalName" | "gstin" | "phone" | "email">> & { address?: Address };
export type BranchPatch = Partial<Omit<BranchInput, "code">>;
export type DoctorPatch = Partial<DoctorInput>;
export interface SettlementDeductionInput { label: string; amountPaise: number; ledgerId?: ID }
export interface PaySettlementInput { settlementId: ID; mode: PaymentMode; reference?: string; date?: DateTime }
