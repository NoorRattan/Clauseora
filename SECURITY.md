# Security and privacy model

Clauseora processes legal documents without user accounts or application-level persistence. This document defines the security properties that must remain true as the project evolves.

## Data flow

1. The browser uploads one or two files to the same-origin `/api/process` endpoint.
2. The server validates file count, size, extension, MIME type, magic bytes, UTF-8 content, and parser limits before analysis.
3. Text is split into deterministic, application-owned evidence anchors.
4. Groq receives the admitted text segments and the selected task instructions.
5. Cloudflare receives only selected high-impact claims and bounded cited excerpts, never the full document or filename.
6. The response is returned with `no-store`; Clauseora does not write documents, extracted text, questions, prompts, or model output to a database, filesystem, analytics service, or application log.

The configured AI providers remain independent data processors. Deployment owners must configure their provider retention and regional controls appropriately and disclose those providers to users.

## Required controls

- Provider credentials are server-only environment variables.
- Browser API requests are same-origin and rate limited. Client identifiers are SHA-256 hashed before entering the short-lived, bounded in-memory limiter.
- Model output is schema validated and every citation is checked against the deterministic anchor allowlist.
- Compare citations are validated against their document-specific namespace.
- Model-authored excerpts are never trusted; canonical excerpts are resolved by the server.
- Unsupported answers use a fixed abstention and cannot carry stale citations.
- Provider errors degrade to safe, fixed client messages without upstream bodies, stack traces, filenames, or document content.
- Security headers deny framing, external object embedding, unnecessary browser capabilities, and cross-origin resource use.

## Threats explicitly considered

- Malicious or mislabeled uploads, parser abuse, oversized documents, and binary files disguised as text.
- Prompt injection embedded in uploaded documents or user questions.
- Hallucinated, unknown, or cross-document evidence references.
- Provider outage, timeout, quota exhaustion, malformed JSON, and verifier disagreement.
- Cross-site request abuse, unbounded in-memory keys, accidental browser caching, and leakage through logs or error messages.

OCR, encrypted documents, remote URLs, and macros are intentionally unsupported. Clauseora provides legal information and document navigation, not legal advice.

## Reporting

Do not include private legal documents, credentials, or production provider responses in a report. Report vulnerabilities privately to the repository owner with reproduction steps using synthetic data.
