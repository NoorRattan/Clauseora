"use client";
import { useEffect } from "react";
import type Lenis from "lenis";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | undefined;
    let generation = 0;
    let frame = 0;
    const tick = (time: number) => {
      lenis?.raf(time);
      frame = lenis?.isScrolling === "smooth" ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (!frame && lenis && !document.hidden) {
        // Reset Lenis's clock after idle so the first frame cannot jump.
        lenis.time = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    const sync = async () => {
      const current = ++generation;
      lenis?.destroy();
      lenis = undefined;
      cancelAnimationFrame(frame);
      frame = 0;
      if (!media.matches && !document.hidden) {
        const { default: Lenis } = await import("lenis");
        if (current !== generation) return;
        lenis = new Lenis({
          duration: 0.9,
          smoothWheel: true,
          autoRaf: false,
          anchors: true,
          prevent: (node) => node.closest('[role="dialog"]') !== null,
        });
        lenis.on("virtual-scroll", wake);
      }
    };
    const update = () => { void sync().catch(() => { /* Native smooth scrolling remains available. */ }); };
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    // Bubble after Lenis handles an anchor click; key activation emits click too.
    window.addEventListener("click", wake, { passive: true });
    return () => {
      generation++;
      cancelAnimationFrame(frame);
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("click", wake);
      lenis?.destroy();
    };
  }, []);
  return children;
}
