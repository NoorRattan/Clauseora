# Clauseora

## Evidence-First Legal Document Navigator

Clauseora connects every AI-generated explanation, comparison, and answer to the **exact passage** in the document that supports it. If the document doesn't support a claim, the app says "Not stated in this document" rather than guessing.

---

## The Differentiator

**Evidence Mode** — clicking any AI output opens an Evidence Drawer showing the exact page/paragraph from the original document. Anchors are assigned by application code *before* any model call. The model references IDs; it never invents locators or excerpts.

---

## Demo Path (90 seconds)

1. Open Clauseora and choose **Simplify**
2. Upload the `tests/fixtures/mutual-nda.txt` file
3. Browse clause cards → click any evidence chip → see the exact source passage
4. Open Action Pack to see obligations and lawyer questions
5. Switch to **Compare** → upload two document versions → see before/after with source links
6. Switch to **Ask** → ask a supported question, then an unanswerable one → observe `Not stated in this document`

---

## GenAI Integration

| Provider | Model | Purpose |
|---|---|---|
| **Groq** (primary) | `llama-3.3-70b-versatile` | Full document Simplify, Compare, Ask, Action Pack generation |
| **Cloudflare Workers AI** (verifier) | `@cf/meta/llama-3.1-8b-instruct-fast` | Checks only selected high-impact claims (money, deadlines) against cited excerpts |

One endpoint: `POST /api/process`. Maximum two AI calls per request.

**Verification states shown to the user:**
- `cross_checked` — selected claims supported by the verifier (source agreement only; not legally correct)
- `needs_review` — verifier contradicted or could not confirm at least one claim
- `single_model` — verification was unavailable, disabled, or out of quota

No majority voting. Disagreement is surfaced, not hidden.

---

## Architecture

```
Browser (upload + results)
    │
    ▼
POST /api/process (stateless Next.js route)
    validate → extract → normalize → assign anchors → budget check
    │                                      │
    │ deterministic code                   ▼
    │                           Groq primary analyzer
    ▼                                      │
request-scoped evidence index    validate claims + anchors
    │                                      │
    │                          high-impact claims + excerpts
    │                                      ▼
    │                       Cloudflare evidence verifier
    │                                      │
    └────── reconcile status ──────────────┘
                                           │
                                           ▼
                                 safe JSON → UI
```

No database, no object storage, no persistent model history.

---

## Limitations

- No OCR or image-only PDF support. Text-layer PDFs, DOCX, and TXT only.
- Free-tier quotas limit document length (approximately 5,000–6,000 tokens input).
- Groq's free tier: 8K tokens/minute, 1,000 requests/day.
- Cloudflare Workers AI free tier: 10,000 neurons/day.
- AI output may be wrong or incomplete. Clauseora is not a substitute for a qualified legal professional.
- Absence from Clauseora output never means absence from the document.

---

## Privacy

Your document is sent to our server for processing. **Groq receives the full admitted document text**. **Cloudflare receives only selected high-impact claims and their cited excerpts** — not the full document.

Clauseora does not save your document to any database or storage. The app has no accounts and no stored history. Request buffers are eligible for collection when the request ends.

See `memory files/04-security-privacy.md` for the full control specification.

---

## Setup

```bash
# 1. Clone and install
git clone <repo>
cd Clauseora
npm install

# 2. Set environment variables
cp .env.local.example .env.local
# Edit .env.local with your Groq and Cloudflare credentials

# 3. Run development server
npm run dev
```

Visit `http://localhost:3000`.

### Required environment variables

| Variable | Where to get it |
|---|---|
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → Workers & Pages |
| `CLOUDFLARE_AI_TOKEN` | Cloudflare → My Profile → API Tokens (Workers AI permission) |

---

## Test Fixtures

Synthetic, non-personal documents are in `tests/fixtures/`:
- `mutual-nda.txt` — short mutual NDA for Simplify and Ask testing

Run tests (once test suite is added):
```bash
npm test
```

---

## Hackathon Brief

AI for Legal Assistance & Access — information/assistance, not professional legal advice.

Deadline: 2026-09-27. Solo developer.

---

## Legal Boundary Notice

> Clauseora provides information about the document you upload. Its AI-generated output may be wrong, incomplete, or miss important terms. It is not legal advice, does not create an attorney-client relationship, and is not a substitute for a qualified legal professional. Verify important points in the source document.

This notice is application-owned, version-controlled, and never generated or altered by AI.
