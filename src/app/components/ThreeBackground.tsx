"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export function ThreeBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 24;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Dynamic Lighting
    const ambientLight = new THREE.AmbientLight(0x0a101d, 2.5);
    scene.add(ambientLight);

    const goldPointLight = new THREE.PointLight(0xf59e0b, 50, 100);
    goldPointLight.position.set(12, 8, 10);
    scene.add(goldPointLight);

    const cyanPointLight = new THREE.PointLight(0x06b6d4, 40, 100);
    cyanPointLight.position.set(-14, -8, 8);
    scene.add(cyanPointLight);

    // Central Monolith / Evidence Prism (Double Crystal)
    const prismGroup = new THREE.Group();
    scene.add(prismGroup);

    // Inner glowing core
    const innerGeom = new THREE.OctahedronGeometry(4.2, 1);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x0c1322,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0x050c18,
      wireframe: false,
    });
    const innerMesh = new THREE.Mesh(innerGeom, innerMat);
    prismGroup.add(innerMesh);

    // Outer wireframe cage (holographic grid)
    const wireGeom = new THREE.IcosahedronGeometry(5.6, 1);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const wireMesh = new THREE.Mesh(wireGeom, wireMat);
    prismGroup.add(wireMesh);

    // Amber highlight ring
    const ringGeom = new THREE.TorusGeometry(7.2, 0.04, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.4,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.rotation.x = Math.PI / 3;
    prismGroup.add(ringMesh);

    // Cyan secondary ring
    const ring2Geom = new THREE.TorusGeometry(8.0, 0.03, 16, 100);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.25,
    });
    const ring2Mesh = new THREE.Mesh(ring2Geom, ring2Mat);
    ring2Mesh.rotation.y = Math.PI / 4;
    prismGroup.add(ring2Mesh);

    // Particle Cloud (1,000 quantum nodes representing parsed clauses and anchors)
    const particleCount = 1000;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const amberColor = new THREE.Color(0xf59e0b);
    const cyanColor = new THREE.Color(0x38bdf8);
    const slateColor = new THREE.Color(0x475569);

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      // Spread across a broad 3D volume
      particlePositions[idx] = (Math.random() - 0.5) * 55;
      particlePositions[idx + 1] = (Math.random() - 0.5) * 45;
      particlePositions[idx + 2] = (Math.random() - 0.5) * 35;

      // Color distribution: mostly subtle slate with sparks of gold and cyan
      const r = Math.random();
      const chosenColor = r > 0.85 ? amberColor : r > 0.65 ? cyanColor : slateColor;
      particleColors[idx] = chosenColor.r;
      particleColors[idx + 1] = chosenColor.g;
      particleColors[idx + 2] = chosenColor.b;
    }

    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );
    particleGeom.setAttribute(
      "color",
      new THREE.BufferAttribute(particleColors, 3)
    );

    const particleMat = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);

    // Mouse movement interaction
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth mouse interpolation (spring feel)
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      // Rotate prism
      prismGroup.rotation.y = elapsed * 0.15 + mouseX * 0.5;
      prismGroup.rotation.x = Math.sin(elapsed * 0.2) * 0.2 + mouseY * 0.3;
      ringMesh.rotation.z = elapsed * 0.3;
      ring2Mesh.rotation.x = elapsed * -0.25;

      // Slowly oscillate particles
      particles.rotation.y = elapsed * 0.03 + mouseX * 0.2;
      particles.rotation.x = Math.sin(elapsed * 0.05) * 0.1 + mouseY * 0.15;

      // Parallax camera sway
      camera.position.x = mouseX * 2.5;
      camera.position.y = -mouseY * 2.5;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // Clean up
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);

      renderer.dispose();
      innerGeom.dispose();
      innerMat.dispose();
      wireGeom.dispose();
      wireMat.dispose();
      ringGeom.dispose();
      ringMat.dispose();
      ring2Geom.dispose();
      ring2Mat.dispose();
      particleGeom.dispose();
      particleMat.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ opacity: 0.85 }}
      aria-hidden="true"
    />
  );
}
