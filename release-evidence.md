# Release Evidence — Clauseora

| Field | Value |
|---|---|
| Revision | REV-004 |
| Verification date | 2026-09-20 |
| Primary analyzer | Groq (`openai/gpt-oss-120b` by default), temperature 0 |
| Secondary verifier | Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`) |
| Supported formats | Text-layer PDF, DOCX, TXT |
| Admission limits | 8 MB, 150 PDF pages, 120,000 extracted characters, 6,000 estimated input tokens |
| Test status | 15 test files, 151 tests passed |
| Production status | Vercel deployment returned HTTP 200 for the landing page and synthetic sample endpoint |

## Automated verification

The repository currently passes:

```text
npm test
npm run lint
npx tsc --noEmit
npm run build
npm audit --audit-level=high
```

The test suite covers deterministic anchors, upload and extraction boundaries, safe rendering, no-persistence behavior, provider contracts, Simplify/Compare/Ask grounding, prompt-injection resistance, cross-model verification, model-output invariants, and request-rate defenses.

## Security and evidence guarantees

1. **Deterministic anchors** — application code assigns every source anchor before any model call.
2. **Server-resolved excerpts** — the Evidence Drawer renders excerpts from the request-scoped source index, not from model-authored text.
3. **Fail-closed output validation** — unknown anchors, malformed schemas, unsupported Ask answers, and invalid Compare before/after relationships are rejected.
4. **Compare-side integrity** — A-side citations must resolve to Document A and B-side citations must resolve to Document B.
5. **Bounded processing** — uploads, extracted text, segments, ZIP expansion, model tokens, provider timeouts, and output arrays have explicit limits.
6. **Provider minimization** — Cloudflare receives only selected high-impact claims and short source excerpts; it does not receive the full document.
7. **No application persistence** — the app does not store uploaded documents, document history, or model results in a database or object storage.
8. **Fixed legal boundary** — every terminal API response includes the application-owned legal information notice.

## Deployment

Production: [clauseora.vercel.app](https://clauseora.vercel.app/)

The Vercel project is connected to the public [`NoorRattan/Clauseora`](https://github.com/NoorRattan/Clauseora) repository. Provider credentials are configured as Vercel environment variables and are not committed to the repository.

## Fixtures and scope

The committed fixtures are synthetic and non-personal. They include mutual NDA, residential lease, services-agreement comparison, DOCX extraction, encrypted PDF, image-only PDF, and labeled Ask questions.

This evidence confirms build, boundary, contract, and deterministic behavior. It is not a benchmark of live model accuracy or legal correctness. AI output may still be incomplete or wrong; users must verify important points in the source document and consult a qualified legal professional for legal advice.
