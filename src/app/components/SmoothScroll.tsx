"use client";
import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import Lenis from "lenis";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lenis: Lenis | undefined;
    const sync = () => {
      lenis?.destroy();
      lenis = undefined;
      if (!media.matches)
        lenis = new Lenis({
          duration: 0.9,
          smoothWheel: true,
          autoRaf: true,
          anchors: true,
          prevent: (node) => node.closest('[role="dialog"]') !== null,
        });
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      lenis?.destroy();
    };
  }, []);
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
