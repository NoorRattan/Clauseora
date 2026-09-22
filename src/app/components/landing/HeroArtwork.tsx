"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Asterisk, ScanLine, ArrowUpRight } from "lucide-react";
import styles from "../../page.module.css";

const Scene = dynamic(() => import("./DocumentScene"), { ssr: false });
class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() { this.props.onFailure(); }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function HeroArtwork() {
  const [canRender, setCanRender] = useState(false);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    let visible = false;
    let painted = false;
    let timer = 0;
    let idle = 0;
    let secondFrame = 0;
    const sync = () => {
      const animate = visible && !document.hidden && !motion.matches;
      setActive(animate);
      // CSS pauses at the current phase instead of jumping back to frame zero.
      element.dataset.active = String(animate);
      clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
      if (!animate || !painted || !finePointer.matches || device.connection?.saveData ||
          (device.deviceMemory !== undefined && device.deviceMemory < 4) || navigator.hardwareConcurrency < 4) return;
      // Wait for the .9s headline entrance, then give input/paint priority.
      timer = window.setTimeout(() => {
        const load = () => setCanRender(true);
        if ("requestIdleCallback" in window) idle = window.requestIdleCallback(load);
        else load();
      }, 1100);
    };
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => { painted = true; sync(); });
    });
    const observer = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; sync(); },
      { threshold: 0.05 },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    finePointer.addEventListener("change", sync);
    return () => {
      clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      finePointer.removeEventListener("change", sync);
    };
  }, []);
  return (
    <div ref={container} className={styles.artwork}>
      <div aria-hidden="true" className={styles.scene}>
        <div className={styles.scenePoster} data-ready={ready}>
          <picture>
            <source media="(max-width: 899px)" srcSet="/hero-scene-mobile.webp" />
            <Image
              src="/hero-scene.webp"
              alt="Evidence-linked legal document illustration"
              width={749}
              height={568}
              sizes="(max-width: 899px) 420px, 749px"
              loading="eager"
              fetchPriority="high"
              style={{ width: "auto", left: "50%", right: "auto", top: "auto", bottom: "auto" }}
              className={styles.sceneImage}
            />
          </picture>
        </div>
        {canRender && (
          <SceneBoundary onFailure={() => setReady(false)}>
            <Scene active={active} onReady={() => setReady(true)} />
          </SceneBoundary>
        )}
      </div>
      <span className={styles.artLabel}>
        A NEW PERSPECTIVE ON THE FINE PRINT
      </span>
      <div className={styles.documentStack}>
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
      </div>
      <div className={styles.sourceFloat}>
        <span>
          <ScanLine size={12} /> FROM CLAUSE TO CLARITY
        </span>
        <p>The agreement lasts two years.</p>
        <a href="#evidence">
          See the original passage <ArrowUpRight size={12} />
        </a>
      </div>
      <span className={styles.artFootnote}>
        Complexity, with a little perspective.
      </span>
    </div>
  );
}
