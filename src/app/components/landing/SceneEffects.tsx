"use client";
import { Bloom, EffectComposer } from "@react-three/postprocessing";

export default function SceneEffects() {
  return (
    <EffectComposer multisampling={0}>
      {/* Bloom keeps the ambient highlight without the driver-sensitive DOF shader. */}
      <Bloom intensity={0.14} luminanceThreshold={1.5} mipmapBlur />
    </EffectComposer>
  );
}
