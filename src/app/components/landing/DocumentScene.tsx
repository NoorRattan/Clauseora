"use client";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  Sparkles,
} from "@react-three/drei";
import { Group, MathUtils, PCFShadowMap } from "three";

const SceneEffects = lazy(() => import("./SceneEffects"));

function RenderSchedule({ active, onReady }: { active: boolean; onReady: () => void }) {
  const invalidate = useThree(state => state.invalidate);
  const frames = useRef(0);
  useFrame(() => {
    // onCreated precedes the first rendered frame. Keep the poster until ready.
    if (++frames.current === 3) onReady();
  });
  useEffect(() => {
    // Demand rendering: 30 fps ambient motion, no loop offscreen/in hidden tabs.
    // Pointer events also invalidate through Fiber's event system.
    if (!active) return;
    const timer = window.setInterval(invalidate, 1000 / 30);
    invalidate();
    return () => clearInterval(timer);
  }, [active, invalidate]);
  return null;
}

function Sculpture({ active, constrained }: { active: boolean; constrained: boolean }) {
  const sculpture = useRef<Group>(null);
  const elapsed = useRef(0);
  const [hovered, setHovered] = useState(false);
  useFrame(({ pointer, camera }, frameDelta) => {
    if (!sculpture.current || !active) return;
    const delta = Math.min(frameDelta, 0.05);
    const time = (elapsed.current += delta);
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
        <torusGeometry args={[1.86, 0.3, constrained ? 20 : 32, constrained ? 80 : 120]} />
        <meshPhysicalMaterial
          color="#9b90b3"
          metalness={0.52}
          roughness={0.19}
          clearcoat={1}
          clearcoatRoughness={0.2}
          envMapIntensity={1.4}
        />
      </mesh>
      <mesh rotation={[0, 0.2, 0.1]}>
        <torusGeometry args={[2.36, 0.009, 8, constrained ? 64 : 100]} />
        <meshStandardMaterial
          color="#a79cbd"
          metalness={0.65}
          roughness={0.4}
          transparent
          opacity={0.35}
        />
      </mesh>
      <mesh position={[1.4, 1.1, 0.25]} castShadow>
        <sphereGeometry args={[0.075, constrained ? 12 : 20, constrained ? 12 : 20]} />
        <meshStandardMaterial color="#dfd8ee" metalness={0.7} roughness={0.1} />
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
  const [constrained] = useState(() => window.innerWidth < 900 || navigator.hardwareConcurrency <= 4 ||
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4);
  useEffect(() => {
    const media = window.matchMedia(
      "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
    );
    const update = () => setEffects(media.matches && !constrained);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [constrained]);
  return (
    <Canvas
      dpr={[1, constrained ? 1 : 1.5]}
      camera={{ position: [0, 0, 7.3], fov: 43 }}
      frameloop="demand"
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      shadows={{ type: PCFShadowMap }}
    >
      <Suspense fallback={null}>
        <RenderSchedule active={active} onReady={onReady} />
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[3, 5, 4]}
          color="#ede4ff"
          intensity={2.5}
          castShadow
          shadow-mapSize={[512, 512]}
        />
        <Environment resolution={128}>
          <Lightformer
            intensity={4}
            position={[-4, 3, 3]}
            scale={[4, 6, 1]}
            color="#dad1ee"
          />
          <Lightformer
            intensity={2}
            position={[4, -1, 2]}
            scale={[2, 5, 1]}
            color="#aa95d6"
          />
          <Lightformer
            intensity={3}
            position={[0, 4, -3]}
            scale={[5, 2, 1]}
            color="#f5f1db"
          />
        </Environment>
        <Sculpture active={active} constrained={constrained} />
        <ContactShadows
          position={[0, -2.65, 0]}
          opacity={0.3}
          scale={8}
          blur={2.5}
          far={4}
          resolution={128}
          frames={1}
        />
        <group visible={active}>
          <Sparkles
            count={constrained ? 10 : 20}
            scale={[5.5, 5, 2]}
            size={1.4}
            speed={0.15}
            opacity={0.3}
            color="#cabee4"
          />
        </group>
        {effects && (
          <Suspense fallback={null}><SceneEffects /></Suspense>
        )}
      </Suspense>
    </Canvas>
  );
}
