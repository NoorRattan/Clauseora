"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Asterisk, ScanLine, ArrowUpRight } from "lucide-react";
import styles from "../../page.module.css";

const Scene = dynamic(() => import("./DocumentScene"), { ssr: false });
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function HeroArtwork() {
  const reduced = useReducedMotion();
  const [canRender, setCanRender] = useState(false);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) return;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    const timer = window.setTimeout(() => setCanRender(true), 500);
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting && !document.hidden),
      { threshold: 0.05 },
    );
    if (container.current) observer.observe(container.current);
    const visibility = () =>
      setActive(
        !document.hidden &&
          !!container.current &&
          container.current.getBoundingClientRect().bottom > 0,
      );
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <div ref={container} className={styles.artwork}>
      <div aria-hidden="true" className={styles.scene}>
        {!ready && <div className={styles.orbitFallback} />}
        {canRender && (
          <SceneBoundary>
            <Scene active={active && !reduced} onReady={() => setReady(true)} />
          </SceneBoundary>
        )}
      </div>
      <span className={styles.artLabel}>
        A NEW PERSPECTIVE ON THE FINE PRINT
      </span>
      <motion.div
        className={styles.documentStack}
        transformTemplate={(_, generated) =>
          `translate(-50%, -50%) ${generated}`
        }
        animate={
          reduced || !active
            ? { y: 0, rotate: -12 }
            : { y: [0, -9, 0], rotate: [-12, -10, -12] }
        }
        transition={{
          duration: 9,
          repeat: active && !reduced ? Infinity : 0,
          ease: "easeInOut",
        }}
      >
        <div className={styles.document} aria-hidden="true">
          <div className={styles.documentTop}>
            <Asterisk size={14} />
            <span>THE START OF SOMETHING.</span>
          </div>
          <h2>
            Mutual
            <br />
            non-disclosure
            <br />
            agreement.
          </h2>
          <p>
            Between Alpha Corp and Beta LLC.
            <br />A shared understanding, in writing.
          </p>
          <div className={styles.documentLines}>
            <i />
            <i />
            <i />
          </div>
          <div className={styles.documentHighlight}>
            3. TERM
            <br />
            This Agreement shall remain in effect
            <br />
            for a period of two (2) years…
          </div>
          <div className={styles.documentSignature}>Alpha & Beta</div>
        </div>
      </motion.div>
      <motion.div
        className={styles.sourceFloat}
        animate={reduced || !active ? { y: 0 } : { y: [0, 7, 0] }}
        transition={{
          duration: 7,
          repeat: active && !reduced ? Infinity : 0,
          ease: "easeInOut",
        }}
      >
        <span>
          <ScanLine size={12} /> FROM CLAUSE TO CLARITY
        </span>
        <p>The agreement lasts two years.</p>
        <a href="#evidence">
          See the original passage <ArrowUpRight size={12} />
        </a>
      </motion.div>
      <span className={styles.artFootnote}>
        Complexity, with a little perspective.
      </span>
    </div>
  );
}
