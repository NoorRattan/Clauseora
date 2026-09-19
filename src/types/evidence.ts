/**
 * Core evidence model types for Clauseora.
 * Anchor IDs are created by application code before any model call.
 * The model references IDs; it never invents locators or excerpts.
 */

/** A normalized, immutable text segment extracted from a document. */
export type Segment = {
  /** Immutable ID assigned by code, e.g. "A-p003-b012". Never model-generated. */
  id: string;
  /** Which document this segment came from. */
  document: "A" | "B";
  /** Human-readable locator: "Page 3", "Paragraph 18", "Lines 42–55". */
  locator: string;
  /** Nearest heading above this segment, if any. */
  heading?: string;
  /** Normalized source text. Never model-authored or paraphrased. */
  text: string;
};

/** The public shape of a resolved anchor — what the UI renders in the Evidence Drawer. */
export type AnchorRef = {
  anchorId: string;
  document: "A" | "B";
  locator: string;
  heading?: string;
  excerpt: string;
};

/** Request-scoped evidence index: a map from anchor ID to Segment. */
export type EvidenceIndex = Map<string, Segment>;

// ─── Mode types ──────────────────────────────────────────────────────────────

export type Mode = "simplify" | "compare" | "ask";

// ─── Simplify ─────────────────────────────────────────────────────────────────

export type ClauseItem = {
  kind: "obligation" | "deadline" | "money" | "condition" | "review_flag";
  party: string; // free text or "not_stated"
  statement: string;
  anchorIds: string[];
};

export type DefinedTerm = {
  term: string;
  meaningInContext: string;
  /** Optional for backwards-compatible fixtures; generated terms should cite evidence. */
  anchorIds?: string[];
};

export type ClauseCard = {
  topic: string;
  plainLanguage: string;
  definedTerms: DefinedTerm[];
  items: ClauseItem[];
  anchorIds: string[];
};

export type SimplifyResult = {
  clauses: ClauseCard[];
};

// ─── Compare ──────────────────────────────────────────────────────────────────

export type Change = {
  topic: string;
  changeType: "added" | "removed" | "modified";
  before: string | null;
  after: string | null;
  whyReview: string;
  anchorIdsA: string[];
  anchorIdsB: string[];
};

export type CompareResult = {
  changes: Change[];
  structuralDifferences?: string[];
  recommendations?: string[];
};

// ─── Ask ──────────────────────────────────────────────────────────────────────

export type AskStatus = "supported" | "partially_supported" | "not_found";

export type AskResult = {
  status: AskStatus;
  answer: string;
  notEstablished: string[];
  anchorIds: string[];
  citations?: Array<{ anchorId: string; relevance?: string }>;
  confidence?: string;
};

// ─── Action Pack ──────────────────────────────────────────────────────────────

export type ChecklistItem = {
  item: string;
  party: string;
  dueOrTrigger: string;
  anchorIds: string[];
};

export type LawyerQuestion = {
  question: string;
  reason: string;
  anchorIds: string[];
};

export type ActionPack = {
  checklist: ChecklistItem[];
  lawyerQuestions: LawyerQuestion[];
};

// ─── Verification ─────────────────────────────────────────────────────────────

export type VerificationStatus =
  | "cross_checked"
  | "needs_review"
  | "single_model"
  | "not_applicable";

export type VerificationIssue = {
  claimPath: string;
  verdict: "contradicts" | "unclear";
  message: string;
};

export type Verification = {
  status: VerificationStatus;
  provider: "cloudflare" | null;
  checkedClaims: number;
  issues: VerificationIssue[];
};

// ─── API Response Envelope ────────────────────────────────────────────────────

export const LEGAL_NOTICE_TEXT =
  "Clauseora provides information about the document you upload. Its AI-generated output may be wrong, incomplete, or miss important terms. It is not legal advice, does not create an attorney-client relationship, and is not a substitute for a qualified legal professional. Verify important points in the source document.";

export const NOT_FOUND_ABSTENTION_TEXT =
  "This information is not stated in the document you uploaded. Clauseora can only answer questions based on the content of the uploaded document.";

export type DocumentMeta = {
  key: "A" | "B";
  displayName: string;
  pageCount?: number;
};

export type SuccessResponse = {
  requestId: string;
  mode: Mode;
  analysisProvider: {
    service: "groq" | "openrouter";
    model: string;
  };
  notice: {
    kind: "legal_information_only";
    text: string;
  };
  documents: DocumentMeta[];
  result: SimplifyResult | CompareResult | AskResult;
  resolvedAnchors: AnchorRef[];
  verification: Verification;
  actionPack: ActionPack;
  error: null;
};

export type ErrorCode =
  | "INVALID_REQUEST"
  | "WRONG_FILE_COUNT"
  | "FILE_TOO_LARGE"
  | "DOCUMENT_TOO_LONG"
  | "UNSUPPORTED_FILE_TYPE"
  | "TYPE_MISMATCH"
  | "NO_EXTRACTABLE_TEXT"
  | "ENCRYPTED_DOCUMENT"
  | "CORRUPT_DOCUMENT"
  | "RATE_LIMITED"
  | "PRIMARY_QUOTA_EXHAUSTED"
  | "MODEL_OUTPUT_INVALID"
  | "MODEL_REFUSAL"
  | "PRIMARY_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "MODEL_TIMEOUT";

export type ErrorResponse = {
  requestId: string;
  mode: Mode | null;
  notice: {
    kind: "legal_information_only";
    text: string;
  };
  documents: DocumentMeta[];
  result: null;
  actionPack: ActionPack;
  error: {
    code: ErrorCode;
    message: string;
  };
};

export type ApiResponse = SuccessResponse | ErrorResponse;
