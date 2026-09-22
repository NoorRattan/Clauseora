"use client";
import { Bloom, DepthOfField, EffectComposer } from "@react-three/postprocessing";

export default function SceneEffects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.14} luminanceThreshold={1.5} mipmapBlur />
      <DepthOfField focusDistance={0.07} focalLength={0.15} bokehScale={0.4} height={240} />
    </EffectComposer>
  );
}
