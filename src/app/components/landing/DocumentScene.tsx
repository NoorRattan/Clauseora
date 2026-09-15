"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  Sparkles,
} from "@react-three/drei";
import {
  Bloom,
  DepthOfField,
  EffectComposer,
} from "@react-three/postprocessing";
import { Group, MathUtils, PCFShadowMap } from "three";

function Sculpture({ active }: { active: boolean }) {
  const sculpture = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  useFrame(({ clock, pointer, camera }, delta) => {
    if (!sculpture.current || !active) return;
    const time = clock.getElapsedTime();
    sculpture.current.rotation.y = MathUtils.damp(
      sculpture.current.rotation.y,
      -0.35 + pointer.x * 0.13,
      3,
      delta,
    );
    sculpture.current.rotation.x = MathUtils.damp(
      sculpture.current.rotation.x,
      0.26 + pointer.y * 0.08,
      3,
      delta,
    );
    sculpture.current.position.y = Math.sin(time * 0.35) * 0.07;
    const size = hovered ? 1.025 : 1;
    sculpture.current.scale.setScalar(
      MathUtils.damp(sculpture.current.scale.x, size, 4, delta),
    );
    camera.position.x = MathUtils.damp(
      camera.position.x,
      pointer.x * 0.15,
      2,
      delta,
    );
    camera.position.y = MathUtils.damp(
      camera.position.y,
      pointer.y * 0.12,
      2,
      delta,
    );
    camera.lookAt(0, 0, 0);
  });
  return (
    <group
      ref={sculpture}
      rotation={[0.26, -0.35, -0.45]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh castShadow receiveShadow>
        <torusGeometry args={[1.86, 0.3, 32, 120]} />
        <meshPhysicalMaterial
          color="#90b39a"
          metalness={0.52}
          roughness={0.19}
          clearcoat={1}
          clearcoatRoughness={0.2}
          envMapIntensity={1.4}
        />
      </mesh>
      <mesh rotation={[0, 0.2, 0.1]}>
        <torusGeometry args={[2.36, 0.009, 8, 100]} />
        <meshStandardMaterial
          color="#9cbd9c"
          metalness={0.65}
          roughness={0.4}
          transparent
          opacity={0.35}
        />
      </mesh>
      <mesh position={[1.4, 1.1, 0.25]} castShadow>
        <sphereGeometry args={[0.075, 20, 20]} />
        <meshStandardMaterial color="#ddeed8" metalness={0.7} roughness={0.1} />
      </mesh>
    </group>
  );
}

export default function DocumentScene({
  active,
  onReady,
}: {
  active: boolean;
  onReady: () => void;
}) {
  const [effects, setEffects] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(
      "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
    );
    const update = () => setEffects(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 7.3], fov: 43 }}
      frameloop={active ? "always" : "demand"}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      shadows={{ type: PCFShadowMap }}
      onCreated={onReady}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[3, 5, 4]}
          color="#efffe4"
          intensity={2.5}
          castShadow
          shadow-mapSize={[512, 512]}
        />
        <Environment resolution={128}>
          <Lightformer
            intensity={4}
            position={[-4, 3, 3]}
            scale={[4, 6, 1]}
            color="#e1eed1"
          />
          <Lightformer
            intensity={2}
            position={[4, -1, 2]}
            scale={[2, 5, 1]}
            color="#95d6af"
          />
          <Lightformer
            intensity={3}
            position={[0, 4, -3]}
            scale={[5, 2, 1]}
            color="#f5f1db"
          />
        </Environment>
        <Sculpture active={active} />
        <ContactShadows
          position={[0, -2.65, 0]}
          opacity={0.3}
          scale={8}
          blur={2.5}
          far={4}
          resolution={128}
          frames={1}
        />
        {active && (
          <Sparkles
            count={20}
            scale={[5.5, 5, 2]}
            size={1.4}
            speed={0.15}
            opacity={0.3}
            color="#d0e4be"
          />
        )}
        {effects && (
          <EffectComposer multisampling={0}>
            <Bloom intensity={0.14} luminanceThreshold={1.5} mipmapBlur />
            <DepthOfField
              focusDistance={0.07}
              focalLength={0.15}
              bokehScale={0.4}
              height={240}
            />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  );
}
