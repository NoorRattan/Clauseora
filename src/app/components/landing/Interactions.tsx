"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  MotionConfig,
  motion,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { FileText, ScanLine, ArrowUpRight } from "lucide-react";
import styles from "../../page.module.css";

export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        const context = gsap.context(() => {
          gsap.utils
            .toArray<HTMLElement>("[data-reveal]")
            .forEach((element) => {
              gsap.from(element, {
                y: 28,
                duration: 0.85,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: element,
                  start: "top 94%",
                  once: true,
                },
              });
            });
        }, root);
        cleanup = () => context.revert();
      },
    );
    const stopMotion = () => {
      if (media.matches) cleanup?.();
    };
    media.addEventListener("change", stopMotion);
    return () => {
      cancelled = true;
      cleanup?.();
      media.removeEventListener("change", stopMotion);
    };
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <div ref={root}>{children}</div>
    </MotionConfig>
  );
}

export function MagneticLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const x = useSpring(0, { stiffness: 240, damping: 22 });
  const y = useSpring(0, { stiffness: 240, damping: 22 });
  return (
    <motion.span
      style={{ display: "inline-flex", x, y }}
      onPointerMove={(event) => {
        if (reduced || event.pointerType !== "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        x.set((event.clientX - box.left - box.width / 2) * 0.09);
        y.set((event.clientY - box.top - box.height / 2) * 0.16);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <Link href={href} className={className}>
        {children}
      </Link>
    </motion.span>
  );
}

const examples = [
  {
    label: "Agreement term",
    section: "3. TERM",
    heading: "Two years. Three more for confidentiality.",
    summary:
      "The agreement lasts two years. Confidentiality obligations continue for three additional years after termination.",
    passage:
      "This Agreement shall remain in effect for a period of two (2) years from the date first written above. The obligations of confidentiality with respect to Confidential Information disclosed during the term shall survive termination for a period of three (3) additional years.",
  },
  {
    label: "Return of information",
    section: "4. RETURN OF INFORMATION",
    heading: "Return it. Or destroy it. Then confirm.",
    summary:
      "On request or termination, both parties must promptly return or destroy confidential information and certify destruction in writing within ten business days.",
    passage:
      "Upon request or termination, each party shall promptly return or destroy all Confidential Information of the other party, including all copies, and certify such destruction in writing within ten (10) business days.",
  },
];

export function EvidencePreview() {
  const [selected, setSelected] = useState(0);
  const example = examples[selected];
  return (
    <div className={styles.preview} data-reveal>
      <div className={styles.previewHeader}>
        <FileText size={14} />
        mutual-nda.txt<span>ILLUSTRATIVE EXAMPLE</span>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewEyebrow}>
          <ScanLine size={12} /> THE PLAIN-LANGUAGE VERSION
        </div>
        <div aria-live="polite">
          <h3>{example.heading}</h3>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.8,
              color: "#536a56",
              minHeight: 72,
            }}
          >
            {example.summary}
          </p>
        </div>
        <div
          className={styles.previewTabs}
          aria-label="Explore source passages"
        >
          {examples.map((item, index) => (
            <button
              type="button"
              key={item.section}
              aria-pressed={selected === index}
              aria-controls="example-source"
              onClick={() => setSelected(index)}
            >
              <ScanLine size={10} />
              {item.label}
            </button>
          ))}
        </div>
        <div
          id="example-source"
          className={styles.sourcePassage}
          aria-live="polite"
        >
          <span>ORIGINAL PASSAGE / § {example.section}</span>
          <blockquote>“{example.passage}”</blockquote>
        </div>
      </div>
      <div className={styles.previewFooter}>
        <span>A synthetic NDA. Real source passages.</span>
        <a href="/api/sample?id=mutual-nda" download>
          View document <ArrowUpRight size={9} style={{ display: "inline" }} />
        </a>
      </div>
    </div>
  );
}
