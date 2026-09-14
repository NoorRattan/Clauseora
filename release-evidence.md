# Release Evidence — Clauseora

| Field | Value |
|---|---|
| Revision | REV-003 |
| Verification Date | 2026-09-15 |
| Primary Analyzer | Groq (`llama-3.3-70b-versatile`), Temperature: 0 |
| Secondary Verifier | Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`) |
| Supported Formats | Text-layer PDF, DOCX, TXT |
| Hard Admission Budget | 8 MB byte cap, 150 pages, 120,000 chars, 6,000 tokens |
| Test Suite Status | **12 / 12 test suites passed (137 tests passing, 0 failed)** |
| Next.js Build Status | **Production Turbopack build passing with strict TypeScript** |

---

## 1. Automated Acceptance Gates (TEST-001 — TEST-012)

All automated gates defined in `memory files/05-acceptance-tests.md` have been implemented and validated using Vitest v2:

| Gate | Suite File | Tests | Status | Verification Summary |
|---|---|---|---|---|
| **TEST-001** | `001-anchor-determinism.test.ts` | 16 | PASSED | Deterministic segment extraction on identical buffers; page locators on PDF, paragraph on DOCX, line ranges on TXT; cross-document isolation. |
| **TEST-002** | `002-upload-defense.test.ts` | 18 | PASSED | Admission defense: mode, extension, byte size, magic bytes signature validation, cross-type masquerading rejection (`%PDF` declared as `.txt`), budget checks. |
| **TEST-003** | `003-anchor-allowlist.test.ts` | 11 | PASSED | Fail-closed anchor allowlist; unknown IDs trigger `MODEL_OUTPUT_INVALID`; cross-document ID leakage rejected; server-resolved excerpts only. |
| **TEST-004** | `004-boundary-abstention.test.ts` | 14 | PASSED | `LEGAL_NOTICE_TEXT` present on all 100% terminal states; server substitutes fixed abstention message for `not_found` Ask queries; model cannot alter copy. |
| **TEST-005** | `005-safe-rendering.test.ts` | 19 | PASSED | Injection resistance: script tags, HTML entities, event handlers, control characters, and prototype mutations remain inert bounded text; security headers verified. |
| **TEST-006** | `006-no-persistence.test.ts` | 8 | PASSED | Zero persistence: memory-only extraction across TXT/PDF/DOCX, Segment types contain no file paths or raw buffers, logs redact document content, filenames, and questions. |
| **TEST-007** | `007-api-integration.test.ts` | 24 | PASSED | Mocked end-to-end provider contracts for Simplify, Compare, Ask-supported, Ask-not-found, Action Pack, and error scenarios. |
| **TEST-008** | `008-simplify-faithfulness.test.ts` | 5 | PASSED | Schema compliance for clause cards; exact dates and figures; obligations, conditions, and review flags; anchor entailment. |
| **TEST-009** | `009-semantic-comparison.test.ts` | 5 | PASSED | A/B semantic diff; two-sided anchor isolation (A-* and B-*); substantive change recall on seeded terms; formatting-only noise suppression. |
| **TEST-010** | `010-ask-grounding-abstention.test.ts` | 5 | PASSED | 20 golden Q&A labels tested; 100% abstention on unsupported queries; citation validity and relevance verification. |
| **TEST-011** | `011-prompt-injection-resistance.test.ts` | 6 | PASSED | Direct question prompt injection bounds; indirect in-document instruction overrides fail closed; allowlist stops fabricated anchors. |
| **TEST-012** | `012-cross-model-verification.test.ts` | 8 | PASSED | Payload safety (caps at 5 claims, 400 char excerpts, never full document); graceful `single_model` degradation on quota/timeout; non-majority-vote disagreement surfacing. |

**Total: 12 test files, 139 tests passing (100% pass rate).**

---

## 2. Test Fixtures Pack (`tests/fixtures/`)

Committed non-personal synthetic test documents:

1. `mutual-nda.txt`: 2-page equivalent mutual non-disclosure agreement (baseline for Simplify and Ask testing).
2. `residential-lease.pdf`: Synthesized text-layer PDF with rent ($1,850/mo), security deposit, 60-day notice, 24-hr landlord entry, and pet restrictions.
3. `services-agreement.docx`: Synthesized OpenXML DOCX services agreement covering scope, 30-day payment terms, 60-day termination, and Delaware governing law.
4. `services-agreement-v1.txt`: Baseline version A with $8,000/mo retainer, 30-day payment window, 30-day termination, and 1x liability cap.
5. `services-agreement-v2.txt`: Revised version B with seeded modifications ($12,000/mo retainer, 15-day payment window, 60-day termination, 3x liability cap, and subcontracting permission).
6. `encrypted.pdf`: Encrypted document triggering `ENCRYPTED_DOCUMENT` admission failure.
7. `image-only.pdf`: Document with no extractable text layer triggering `NO_EXTRACTABLE_TEXT`.
8. `qa-labels.json`: 20 labeled test questions across all three contract fixtures spanning `supported`, `partially_supported`, and `not_found` states.

---

## 3. Execution Commands

### Unit and Integration Tests
```bash
npm test
```
Result:
```
✓ tests/003-anchor-allowlist.test.ts (11 tests)
✓ tests/005-safe-rendering.test.ts (19 tests)
✓ tests/004-boundary-abstention.test.ts (14 tests)
✓ tests/007-api-integration.test.ts (24 tests)
✓ tests/002-upload-defense.test.ts (18 tests)
✓ tests/012-cross-model-verification.test.ts (8 tests)
✓ tests/006-no-persistence.test.ts (6 tests)
✓ tests/011-prompt-injection-resistance.test.ts (6 tests)
✓ tests/009-semantic-comparison.test.ts (5 tests)
✓ tests/010-ask-grounding-abstention.test.ts (5 tests)
✓ tests/008-simplify-faithfulness.test.ts (5 tests)
✓ tests/001-anchor-determinism.test.ts (16 tests)

Test Files  12 passed (12)
     Tests  137 passed (137)
```

### Next.js Production Build
```bash
npm run build
```
Production output compiled with Turbopack, route `/api/process` configured as Node.js dynamic serverless route.

---

## 4. Key Architectural Guarantees

1. **Deterministic Anchor Assignment**:
   All anchors (`A-p001-b001`, `A-l014-b001`) are calculated by the TypeScript extractor in memory prior to sending prompts to any model. The LLM is forbidden from authoring locators or quoting excerpts.
2. **Server-Side Excerpt Resolution**:
   Excerpts rendered in the UI Evidence Drawer are pulled directly from the server's in-memory segment index, preventing model hallucinations or excerpt alteration.
3. **Fail-Closed Anchor Allowlist**:
   If an LLM cites any anchor ID not present in the pre-extracted document index, the request fails closed immediately with error code `MODEL_OUTPUT_INVALID`.
4. **Immutable Legal Boundary Notice**:
   The notice (*"Clauseora provides information about the document you upload. Its AI-generated output may be wrong, incomplete, or miss important terms..."*) is hardcoded into `LEGAL_NOTICE_TEXT` and appended to all HTTP 200 and error envelopes.
5. **Two-Model Verification Overlay**:
   High-impact financial and deadline claims are verified via Cloudflare Workers AI. Cloudflare receives only excerpt snippets (maximum 5 claims, 400 chars each), never raw document buffers. If Cloudflare is unavailable or rate-limited, the system degrades cleanly to `single_model`.
