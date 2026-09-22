"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FileText, ScanLine, ArrowUpRight } from "lucide-react";
import styles from "../../page.module.css";

export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = root.current?.querySelectorAll<HTMLElement>("[data-reveal]");
    // One observer for every reveal. Content stays visible without JavaScript.
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        target.classList.add(styles.revealVisible);
        observer.unobserve(target);
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    const sync = () => {
      observer.disconnect();
      elements?.forEach(element => {
        if (media.matches) {
          element.classList.remove(styles.revealPending);
        } else if (!element.classList.contains(styles.revealVisible)) {
          // Never move content which is already in the viewport on hydration.
          if (element.getBoundingClientRect().top < window.innerHeight * 0.94) return;
          element.classList.add(styles.revealPending);
          observer.observe(element);
        }
      });
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      elements?.forEach(element => element.classList.remove(styles.revealPending, styles.revealVisible));
      media.removeEventListener("change", sync);
    };
  }, []);
  return <div ref={root}>{children}</div>;
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
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, last = 0;
    let x = 0, y = 0, vx = 0, vy = 0, tx = 0, ty = 0;
    let point: { x: number; y: number } | null = null;
    const tick = (time: number) => {
      const dt = Math.min((time - (last || time - 16.67)) / 1000, 1 / 60);
      last = time;
      if (point) {
        const box = element.getBoundingClientRect();
        tx = (point.x - box.left - box.width / 2) * 0.09;
        ty = (point.y - box.top - box.height / 2) * 0.16;
        point = null;
      }
      // The original magnetic spring: stiffness 240, damping 22, mass 1.
      vx += (240 * (tx - x) - 22 * vx) * dt;
      vy += (240 * (ty - y) - 22 * vy) * dt;
      x += vx * dt;
      y += vy * dt;
      element.style.transform = `translate(${x}px, ${y}px)`;
      if (Math.abs(tx-x)+Math.abs(ty-y)+Math.abs(vx)+Math.abs(vy) > 0.01) {
        frame = requestAnimationFrame(tick);
      } else {
        element.style.transform = `translate(${tx}px, ${ty}px)`;
        frame = last = 0;
      }
    };
    const start = () => { if (!frame) frame = requestAnimationFrame(tick); };
    const move = (event: PointerEvent) => {
      if (media.matches || event.pointerType !== "mouse") return;
      point = { x: event.clientX, y: event.clientY };
      start();
    };
    const leave = () => { point = null; tx = ty = 0; if (!media.matches) start(); };
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = last = x = y = vx = vy = tx = ty = 0;
      point = null;
      element.style.transform = "none";
    };
    element.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerleave", leave, { passive: true });
    media.addEventListener("change", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      reset();
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      media.removeEventListener("change", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, []);
  return (
    <span ref={root} style={{ display: "inline-flex" }}>
      <Link href={href} className={className}>
        {children}
      </Link>
    </span>
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
              color: "#5a536a",
              minHeight: 72,
            }}
          >
            {example.summary}
          </p>
        </div>
        <div
          className={styles.previewTabs}
          role="group"
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
