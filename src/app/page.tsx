import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  ScanLine,
  Fingerprint,
  FileText,
  GitCompareArrows,
  MessageCircle,
  Check,
  Asterisk,
} from "lucide-react";
import {
  LandingMotion,
  MagneticLink,
  EvidencePreview,
} from "./components/landing/Interactions";
import { HeroArtwork } from "./components/landing/HeroArtwork";
import styles from "./page.module.css";

const capabilities = [
  {
    number: "01",
    mode: "simplify",
    icon: FileText,
    title: "Less legalese. More clarity.",
    description:
      "Break complex clauses into plain language. Understand the obligations, deadlines, and details that deserve a closer look.",
    label: "Simplify a document",
  },
  {
    number: "02",
    mode: "compare",
    icon: GitCompareArrows,
    title: "Small edits. Big implications.",
    description:
      "Compare two versions side by side. See what changed, what it could mean, and the original language behind each difference.",
    label: "Compare versions",
  },
  {
    number: "03",
    mode: "ask",
    icon: MessageCircle,
    title: "Your questions. Your sources.",
    description:
      "Ask about your document in your own words. Get answers grounded in its text—and a clear response when it doesn’t say.",
    label: "Ask a question",
  },
];

export default function Home() {
  return (
    <LandingMotion>
      <div className={styles.site}>
        <a href="#main" className={styles.skipLink}>
          Skip to content
        </a>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="Clauseora home">
            <span className={styles.brandMark}>
              <Asterisk size={29} strokeWidth={1.6} />
            </span>
            clauseora
          </Link>
          <nav aria-label="Main navigation" className={styles.nav}>
            <a href="#approach">The approach</a>
            <a href="#evidence">Evidence, first</a>
            <a href="#privacy">Your privacy</a>
          </nav>
          <Link href="/workspace" className={styles.navCta}>
            Open workspace <ArrowUpRight size={15} />
          </Link>
        </header>
        <main id="main" tabIndex={-1}>
          <section className={styles.hero} aria-labelledby="hero-title">
            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}>
                <span className={styles.statusDot} /> A LITTLE CLARITY GOES A
                LONG WAY
              </div>
              <h1 id="hero-title">
                The fine print.
                <br />
                <em>Finally, clear.</em>
              </h1>
              <p className={styles.heroDescription}>
                Make sense of your contracts. Understand what matters.
                <br className={styles.desktopBreak} /> And trace every
                explanation back to the source.
              </p>
              <div className={styles.heroActions}>
                <MagneticLink
                  href="/workspace"
                  className={styles.primaryButton}
                >
                  Understand your document <ArrowUpRight size={19} />
                </MagneticLink>
                <a href="#evidence" className={styles.textButton}>
                  <span className={styles.playIcon}>
                    <ArrowRight size={15} />
                  </span>
                  See how it works
                </a>
              </div>
              <div className={styles.heroNote}>
                <span>
                  <Check size={13} /> No account needed
                </span>
                <span>
                  <Check size={13} /> Source-linked answers
                </span>
              </div>
            </div>
            <HeroArtwork />
            <div className={styles.heroBottom}>
              <span>LEGAL DOCUMENTS, HUMAN UNDERSTANDING.</span>
              <a href="#approach">
                SCROLL TO EXPLORE <span>↓</span>
              </a>
            </div>
          </section>
          <section className={styles.principles} aria-label="Our principles">
            <p>
              Clarity without
              <br />
              <span>the leap of faith.</span>
            </p>
            <div>
              <ScanLine size={21} strokeWidth={1.3} />
              <span>
                Every explanation.
                <br />
                <strong>A source you can check.</strong>
              </span>
            </div>
            <div>
              <Fingerprint size={23} strokeWidth={1.3} />
              <span>
                Your document.
                <br />
                <strong>Never saved by Clauseora.</strong>
              </span>
            </div>
            <div>
              <MessageCircle size={21} strokeWidth={1.3} />
              <span>
                Plain language.
                <br />
                <strong>For real understanding.</strong>
              </span>
            </div>
          </section>
          <section id="approach" className={styles.approach}>
            <div className={styles.sectionIntro} data-reveal>
              <span className={styles.eyebrow}>01 / THE APPROACH</span>
              <h2>
                From “what does this mean?”
                <br />
                to <em>“now I understand.”</em>
              </h2>
              <p>
                A more thoughtful way to read between the lines.
                <br />
                Three tools. One clear connection to your document.
              </p>
            </div>
            <div className={styles.capabilities}>
              {capabilities.map(
                ({ number, mode, icon: Icon, title, description, label }) => (
                  <article
                    key={number}
                    data-reveal
                    className={styles.capability}
                  >
                    <div className={styles.capabilityTop}>
                      <span>{number}</span>
                      <Icon size={25} strokeWidth={1.2} />
                    </div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                    <Link href={`/workspace?mode=${mode}`}>
                      {label}
                      <ArrowUpRight size={17} />
                    </Link>
                  </article>
                ),
              )}
            </div>
          </section>
          <section id="evidence" className={styles.evidence}>
            <div className={styles.evidenceCopy} data-reveal>
              <span className={styles.eyebrow}>02 / EVIDENCE, FIRST</span>
              <h2>
                Don’t just take
                <br />
                <em>our word for it.</em>
              </h2>
              <p>
                An explanation is only useful if you can check it. Every source
                link takes you to the exact passage behind the answer.
              </p>
              <div className={styles.evidencePrinciple}>
                <ScanLine size={21} />
                <div>
                  <h3>From insight to original, in one click.</h3>
                  <p>
                    No hunting through pages. No guessing where an answer came
                    from.
                  </p>
                </div>
              </div>
              <Link href="/workspace" className={styles.inlineLink}>
                Explore your own document <ArrowUpRight size={17} />
              </Link>
            </div>
            <EvidencePreview />
          </section>
          <section id="privacy" className={styles.privacy} data-reveal>
            <div className={styles.privacyHeading}>
              <Fingerprint size={40} strokeWidth={1} />
              <span className={styles.eyebrow}>03 / PRIVATE BY DESIGN</span>
              <h2>
                Some things should
                <br />
                <em>stay yours.</em>
              </h2>
            </div>
            <div className={styles.privacyDetails}>
              <p>
                Your documents deserve a little discretion.
                <br />
                Here’s exactly how we handle them.
              </p>
              <div>
                <span>01</span>
                <section>
                  <h3>No saved documents. No stored history.</h3>
                  <p>
                    Clauseora processes your file for the current request. We
                    don’t save it to a database or document storage.
                  </p>
                </section>
              </div>
              <div>
                <span>02</span>
                <section>
                  <h3>A clear view of where your text goes.</h3>
                  <p>
                    Groq receives your admitted document text for analysis. When
                    enabled, Cloudflare receives selected claims and source
                    excerpts for an additional check. Provider data policies
                    apply.
                  </p>
                </section>
              </div>
              <div>
                <span>03</span>
                <section>
                  <h3>Information, with honest boundaries.</h3>
                  <p>
                    AI can make mistakes. Check important details in the source,
                    and speak to a qualified professional for legal advice.
                  </p>
                </section>
              </div>
            </div>
          </section>
          <section className={styles.faq} aria-labelledby="faq-title">
            <h2 id="faq-title">Before you bring your document.</h2>
            <details><summary>What can I upload?</summary><p>Use a text-based PDF, DOCX, or TXT file. Scanned images and password-protected PDFs are not supported. Long documents may exceed the analysis limit; the workspace will explain when a file cannot be processed.</p></details>
            <details><summary>What do I get after analysis?</summary><p>Plain-language explanations, links to the original passages, and an Action Pack with document-based checklist items and questions to discuss with a legal professional. Compare mode shows changes between two versions; Ask mode answers questions about your document.</p></details>
            <details><summary>Does a source link mean the answer is correct?</summary><p>No. A source link lets you check the passage yourself. AI can misinterpret text or miss an important clause, even when the citation is valid. An optional second-model check is not a guarantee of legal accuracy.</p></details>
            <details><summary>Can I try it without my own document?</summary><p>Yes. Open the workspace and choose a sample document in the upload area. Samples go through the same analysis flow as an uploaded file.</p></details>
          </section>
          <section className={styles.closing} data-reveal>
            <span className={styles.eyebrow}>
              YOUR NEXT CHAPTER STARTS WITH CLARITY
            </span>
            <h2>
              Read with <em>understanding.</em>
              <br />
              Move forward with context.
            </h2>
            <MagneticLink href="/workspace" className={styles.primaryButton}>
              Let’s make it clear <ArrowUpRight size={19} />
            </MagneticLink>
            <p>PDF, DOCX, or TXT. Bring your document.</p>
            <Asterisk
              className={styles.closingStar}
              strokeWidth={0.4}
              aria-hidden="true"
            />
          </section>
        </main>
        <footer className={styles.footer}>
          <div className={styles.footerTop}>
            <Link href="/" className={styles.brand}>
              <Asterisk size={27} strokeWidth={1.5} />
              clauseora
            </Link>
            <span>A clearer understanding starts here.</span>
            <a href="#main">BACK TO TOP ↑</a>
          </div>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} Clauseora</span>
            <p>
              Legal information, not legal advice. AI output may be wrong or
              incomplete. Verify important details in your document.
            </p>
            <a href="#privacy">Privacy & transparency</a>
          </div>
        </footer>
      </div>
    </LandingMotion>
  );
}
