# Clauseora Architecture

Clauseora is a stateless, evidence-first document analysis workspace. The
important design rule is that the application owns source locations before any
model is called; models can describe those locations, but they cannot create
new ones.

## Request lifecycle

```text
Browser upload
  -> request validation and size/type limits
  -> PDF/DOCX/TXT extraction
  -> normalization and deterministic anchor assignment
  -> request-scoped direct-identifier protection
  -> bounded prompt and token-budget check
  -> Groq primary analysis
  -> schema, evidence, and cross-field validation
  -> selected high-impact claims sent to optional Cloudflare verifier
  -> canonical evidence resolution and safe JSON response
```

The route is `POST /api/process`. It does not persist documents, model prompts,
model results, or request history. Responses are marked non-cacheable.

## Trust boundaries

- Uploaded files and questions are treated as untrusted data and are separated
  from the provider instructions.
- Anchor IDs are assigned by application code and checked against an allowlist
  before results are returned.
- Model output must pass Zod schemas and mode-specific evidence invariants.
- Common direct identifiers are replaced with request-scoped placeholders at
  both provider boundaries. The original source text remains in the server-owned
  evidence index and is restored only into ordinary response text.
- The Cloudflare verifier receives only selected claim text and bounded cited
  excerpts, never the full admitted document.
- Provider adapters have timeouts, circuit breakers, bounded token budgets, and
  safe unavailable/invalid responses.
- Each provider request carries a per-request internal output canary. A leaked
  canary causes the response to be withheld rather than rendered.

Provider credentials are read through a non-throwing Zod schema. Missing or
invalid optional credentials disable that provider's path without breaking a
build, test run, or the rest of the application.

## Frontend delivery

- The landing page keeps its server-rendered metadata, structured FAQ data, and
  static poster image available before the interactive artwork is ready.
- The Three.js artwork is dynamically loaded after the first paint and idle
  period, and the component already honors reduced motion, visibility, low-power
  devices, and data-saver preferences.
- Post-processing effects are loaded separately from the scene. The workspace
  keeps keyboard-operable tabs, upload controls, dialogs, evidence links, live
  status announcements, and focus-visible states.

No visual styling, animation choreography, legal copy, or evidence behavior is
owned by the verification tooling described here.

## Verification

```text
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run analyze:bundle
npm audit --audit-level=high
```

`npm run analyze:bundle` reports raw, gzip-estimated, and Brotli-estimated
JavaScript chunk sizes from the current production build without modifying the
repository.
