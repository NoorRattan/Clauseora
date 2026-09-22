# Release Evidence — Clauseora

| Field | Value |
|---|---|
| Revision | REV-007 |
| Verification date | 2026-09-22 |
| Primary analyzer | Groq (`openai/gpt-oss-120b` by default), temperature 0 |
| Secondary verifier | Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`) |
| Supported formats | Text-layer PDF, DOCX, TXT |
| Admission limits | 8 MB, 150 PDF pages, 120,000 extracted characters, 6,000 estimated input tokens |
| Test status | 20 test files, 191 tests passed |
| Production status | Prior Vercel deployment returned HTTP 200 for the landing page and synthetic sample endpoint; REV-007 is locally verified and has not been submitted or deployed |

## Automated verification

The repository currently passes:

```text
npm test
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run analyze:bundle
npm audit --audit-level=high
```

The test suite covers deterministic anchors, upload and extraction boundaries, safe rendering, no-persistence behavior, provider contracts, Simplify/Compare/Ask grounding, prompt-injection resistance, cross-model verification, model-output invariants, frontend accessibility contracts, sliding-window request defenses, provider circuit breakers, and bounded public-sample caching.

## Security and evidence guarantees

1. **Deterministic anchors** — application code assigns every source anchor before any model call.
2. **Server-resolved excerpts** — the Evidence Drawer renders excerpts from the request-scoped source index, not from model-authored text.
3. **Fail-closed output validation** — unknown anchors, malformed schemas, unsupported Ask answers, and invalid Compare before/after relationships are rejected.
4. **Compare-side integrity** — A-side citations must resolve to Document A and B-side citations must resolve to Document B.
5. **Bounded processing** — uploads, extracted text, segments, ZIP expansion, model tokens, provider timeouts, and output arrays have explicit limits.
6. **Provider minimization** — common direct identifiers are replaced with request-scoped placeholders before provider calls; Cloudflare additionally receives only selected high-impact claims and short source excerpts.
7. **No application persistence** — the app does not store uploaded documents, document history, or model results in a database or object storage.
8. **Fixed legal boundary** — every terminal API response includes the application-owned legal information notice.
9. **Discoverable landing metadata** — the landing page exposes a canonical URL, descriptive hero alternative text, and FAQ structured data without changing the visible presentation.
10. **Provider prompt boundary** — each provider request carries a per-request internal canary; a leaked canary is treated as invalid output and never rendered.
11. **Safe provider configuration** — optional credentials are trimmed and schema-checked without making builds fail when providers are intentionally disabled.

## Efficiency and resilience guarantees

1. **Concurrent Compare preprocessing** — independent A/B reads and extraction run concurrently only after the existing request and signature validation gates.
2. **Bounded sliding-window throttling** — each client retains at most ten accepted timestamps, the key map is capped at 10,000 entries, and global stale-entry scans are periodic rather than per-request.
3. **Provider circuit breakers** — repeated transient Groq or Cloudflare failures open a short-lived circuit; one half-open probe determines recovery. No document, prompt, or output content is stored in breaker state.
4. **No fabricated fallback** — an open primary circuit returns the existing safe unavailable response; an open verifier circuit produces the existing visible `single_model` state.
5. **Request-scoped reuse** — model anchor IDs are collected once and reused for validation and evidence resolution.
6. **Privacy-safe timing** — successful responses include phase durations through `Server-Timing`, with no document or filename data.
7. **Public-data-only cache** — the four synthetic sample fixtures use a four-entry, one-hour TTL/LRU cache plus ETag and CDN revalidation headers. `/api/process` remains strictly `no-store` and never uses this cache.
8. **Bounded model budgets** — primary-model output is capped against the input estimate, while compact anchor references avoid repeating full locator text in the user prompt.
9. **Bundle evidence** — the production build exposes a repeatable raw/gzip/Brotli chunk report through npm run analyze:bundle.

## Deployment

Production: [clauseora.vercel.app](https://clauseora.vercel.app/)

The Vercel project is connected to the public [`NoorRattan/Clauseora`](https://github.com/NoorRattan/Clauseora) repository. Provider credentials are configured as Vercel environment variables and are not committed to the repository.

## Fixtures and scope

The committed fixtures are synthetic and non-personal. They include mutual NDA, residential lease, services-agreement comparison, DOCX extraction, encrypted PDF, image-only PDF, and labeled Ask questions.

This evidence confirms build, boundary, contract, and deterministic behavior. It is not a benchmark of live model accuracy or legal correctness. AI output may still be incomplete or wrong; users must verify important points in the source document and consult a qualified legal professional for legal advice.
