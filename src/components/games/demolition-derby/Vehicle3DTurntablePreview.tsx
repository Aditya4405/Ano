'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VehicleId } from './types';
import { create3DVehicle } from './Derby3DVehicleBuilder';
import { VEHICLES } from './DerbyPhysicsEngine';

interface Vehicle3DTurntablePreviewProps {
  vehicleId: VehicleId;
  color?: string;
  accentColor?: string;
  autoRotate?: boolean;
  className?: string;
}

const gltfCache: Record<string, THREE.Group> = {};

export function Vehicle3DTurntablePreview({
  vehicleId,
  color,
  accentColor,
  autoRotate = true,
  className = 'w-full h-full min-h-[220px]',
}: Vehicle3DTurntablePreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) return;

    const width = mountNode.clientWidth || 300;
    const height = mountNode.clientHeight || 220;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10);
    scene.fog = new THREE.FogExp2(0x0a0c10, 0.035);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(4.6, 2.4, 5.0);
    camera.lookAt(0, 0.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountNode.appendChild(renderer.domElement);

    // Studio Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    fillLight.position.set(-5, 4, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 1.8);
    rimLight.position.set(0, 5, -6);
    scene.add(rimLight);

    // Grid Turntable Floor
    const gridGeo = new THREE.CylinderGeometry(3.6, 3.6, 0.08, 32);
    const gridMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.8,
      roughness: 0.4,
    });
    const platform = new THREE.Mesh(gridGeo, gridMat);
    platform.position.y = -0.04;
    platform.receiveShadow = true;
    scene.add(platform);

    const ringGeo = new THREE.RingGeometry(3.3, 3.45, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // Normalize vehicle ID for GLB lookup
    const normId = vehicleId === 'muscle' || vehicleId === 'starter' ? 'road_crusher'
      : vehicleId === 'heavy' ? 'iron_tanker'
      : vehicleId === 'rally' ? 'apex_phantom'
      : vehicleId === 'armored' ? 'armored_juggernaut'
      : vehicleId;

    const def = VEHICLES[vehicleId] || VEHICLES.road_crusher;
    const vehColor = color || def.color;
    const vehAccent = accentColor || def.accentColor;

    const vehContainer = new THREE.Group();
    scene.add(vehContainer);

    let isDisposed = false;

    // Load Blender GLB Model
    const applyGLTFModel = (gltfScene: THREE.Group) => {
      if (isDisposed) return;
      vehContainer.clear();
      const cloned = gltfScene.clone(true);
      const mainColor = new THREE.Color(vehColor);
      const accentColor = new THREE.Color(vehAccent);

      cloned.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material = mesh.material.map((m) => m.clone());
            } else {
              mesh.material = mesh.material.clone();
            }

            const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
            if (mat && mat.name) {
              if (mat.name.includes('DERBY_Mat_BodyPaint')) {
                mat.color.copy(mainColor);
              } else if (mat.name.includes('DERBY_Mat_AccentMetal')) {
                mat.color.copy(accentColor);
              }
            }
          }
        }
      });
      // Align orientation (Blender model front facing Z+ -> Three.js standard)
      cloned.rotation.y = Math.PI;
      vehContainer.add(cloned);
    };

    if (gltfCache[normId]) {
      applyGLTFModel(gltfCache[normId]);
    } else {
      // Temporary procedural fallback while loading
      const fallback = create3DVehicle(vehicleId, vehColor, vehAccent, '01', def.name);
      vehContainer.add(fallback.root);

      const loader = new GLTFLoader();
      loader.load(
        `/models/derby/${normId}.glb`,
        (gltf) => {
          gltfCache[normId] = gltf.scene;
          applyGLTFModel(gltf.scene);
        },
        undefined,
        (err) => {
          console.warn(`[3D Preview] GLB /models/derby/${normId}.glb load error, staying with procedural model:`, err);
        }
      );
    }

    let isDragging = false;
    let prevMouseX = 0;
    let targetRotationY = 0.4;
    let currentRotationY = 0.4;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      prevMouseX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const deltaX = clientX - prevMouseX;
      prevMouseX = clientX;
      targetRotationY += deltaX * 0.012;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', onPointerDown);
    domEl.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    domEl.addEventListener('touchstart', onPointerDown, { passive: true });
    domEl.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    let animFrameId: number;
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);

      if (autoRotate && !isDragging) {
        targetRotationY += 0.008;
      }

      currentRotationY += (targetRotationY - currentRotationY) * 0.1;
      vehContainer.rotation.y = currentRotationY;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mountNode) return;
      const nw = mountNode.clientWidth;
      const nh = mountNode.clientHeight;
      if (nw === 0 || nh === 0) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('mousedown', onPointerDown);
      domEl.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      domEl.removeEventListener('touchstart', onPointerDown);
      domEl.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      if (mountNode.contains(renderer.domElement)) {
        mountNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [vehicleId, color, accentColor, autoRotate]);

  return <div ref={mountRef} className={className} />;
}
