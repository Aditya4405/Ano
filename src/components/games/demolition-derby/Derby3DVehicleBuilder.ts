import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DamageLevel, DebrisPiece, VehicleId, VehicleState } from './types';
import { VEHICLES } from './DerbyPhysicsEngine';

export interface Vehicle3DObject {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  chassisMesh: THREE.Mesh;
  hoodMesh: THREE.Mesh;
  cabinMesh: THREE.Mesh;
  frontBumperMesh: THREE.Mesh;
  rearBumperMesh: THREE.Mesh;
  bullBarMesh: THREE.Group;
  trunkMesh?: THREE.Mesh;
  sideBarL?: THREE.Mesh;
  sideBarR?: THREE.Mesh;
  windowL?: THREE.Mesh;
  windowR?: THREE.Mesh;
  wheelFLGroup: THREE.Group;
  wheelFRGroup: THREE.Group;
  wheelRLGroup: THREE.Group;
  wheelRRGroup: THREE.Group;
  wheelFLMesh: THREE.Mesh;
  wheelFRMesh: THREE.Mesh;
  wheelRLMesh: THREE.Mesh;
  wheelRRMesh: THREE.Mesh;
  headlightL: THREE.Mesh;
  headlightR: THREE.Mesh;
  taillightL: THREE.Mesh;
  taillightR: THREE.Mesh;
  smokePoint: THREE.Vector3;
  exhaustPoint: THREE.Vector3;
  originalColor: string;
  accentColor: string;
  currentDamageLevel: DamageLevel;
  lastImpactLocalDir?: THREE.Vector3;
}

// ── GLTF GLB ASSET LOADER & CACHE ──────────────────────────
let cachedGLTFScene: THREE.Group | null = null;
let gltfLoadingPromise: Promise<THREE.Group | null> | null = null;

export function preloadDerbyVehicleGLB(): Promise<THREE.Group | null> {
  if (cachedGLTFScene) {
    return Promise.resolve(cachedGLTFScene);
  }
  if (gltfLoadingPromise) {
    return gltfLoadingPromise;
  }

  gltfLoadingPromise = new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      '/assets/demolition_derby.glb',
      (gltf) => {
        cachedGLTFScene = gltf.scene;
        console.log('[Demolition Derby] Successfully loaded demolition_derby.glb vehicle asset!');
        resolve(cachedGLTFScene);
      },
      undefined,
      (err) => {
        console.warn('[Demolition Derby] GLB vehicle asset load warning, falling back to procedural model:', err);
        resolve(null);
      }
    );
  });

  return gltfLoadingPromise;
}

// Automatically initiate preload when module is evaluated
if (typeof window !== 'undefined') {
  preloadDerbyVehicleGLB();
}

// ── CANVAS NUMBER DECAL & DIRTY PAINT TEXTURE GENERATOR ───
function createDirtyDerbyDecalTexture(numberStr: string, titleStr: string, bgColorHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base paint color
  ctx.fillStyle = bgColorHex;
  ctx.fillRect(0, 0, 512, 512);

  // Dirt & Mud splatters overlay
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() * 12 + 1;
    const alpha = Math.random() * 0.25 + 0.05;
    ctx.fillStyle = `rgba(30, 18, 10, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // White racing door circle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(256, 256, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Racing Number
  ctx.fillStyle = '#0f172a';
  ctx.font = 'black 200px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numberStr || '23', 256, 240);

  // Car Title below number
  if (titleStr) {
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(titleStr.toUpperCase(), 256, 375);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ── BUILD 3D VEHICLE FROM GLB MODEL ────────────────────────
function create3DVehicleFromGLB(
  gltfScene: THREE.Group,
  vehicleId: VehicleId,
  mainColorHex: string,
  accentColorHex: string,
  carNumber: string = '23',
  carTitle: string = 'DERBY'
): Vehicle3DObject {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const clonedScene = gltfScene.clone(true);

  const nodesMap = new Map<string, THREE.Object3D>();
  clonedScene.traverse((child) => {
    if (child.name) {
      nodesMap.set(child.name, child);
    }
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      const mesh = child as THREE.Mesh;
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else {
          mesh.material = mesh.material.clone();
        }
      }
    }
  });

  const mainColor = new THREE.Color(mainColorHex);
  const accentColor = new THREE.Color(accentColorHex);

  clonedScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        if (mat.name && mat.name.includes('DERBY_Mat_BodyPaint')) {
          mat.color = mainColor;
        } else if (mat.name && mat.name.includes('DERBY_Mat_AccentMetal')) {
          mat.color = accentColor;
        }
      }
    }
  });

  const findMesh = (name: string): THREE.Mesh => {
    const obj = nodesMap.get(name);
    if (obj && (obj as THREE.Mesh).isMesh) return obj as THREE.Mesh;
    return new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
  };

  const rawWheelFL = findMesh('DERBY_Wheel_FL');
  const rawWheelFR = findMesh('DERBY_Wheel_FR');
  const rawWheelRL = findMesh('DERBY_Wheel_RL');
  const rawWheelRR = findMesh('DERBY_Wheel_RR');

  function wrapWheelInGroup(wheelMesh: THREE.Mesh): { group: THREE.Group; mesh: THREE.Mesh } {
    const wGroup = new THREE.Group();
    const pos = wheelMesh.position.clone();
    wGroup.position.copy(pos);

    if (wheelMesh.parent) {
      wheelMesh.parent.remove(wheelMesh);
    }
    wheelMesh.position.set(0, 0, 0);
    wGroup.add(wheelMesh);

    return { group: wGroup, mesh: wheelMesh };
  }

  const wFL = wrapWheelInGroup(rawWheelFL);
  const wFR = wrapWheelInGroup(rawWheelFR);
  const wRL = wrapWheelInGroup(rawWheelRL);
  const wRR = wrapWheelInGroup(rawWheelRR);

  bodyGroup.add(clonedScene);

  root.add(wFL.group);
  root.add(wFR.group);
  root.add(wRL.group);
  root.add(wRR.group);

  const chassisMesh = findMesh('DERBY_Car_Body');
  const hoodMesh = findMesh('DERBY_Hood');
  const trunkMesh = findMesh('DERBY_Trunk');
  const cabinMesh = findMesh('DERBY_Windshield');
  const frontBumperMesh = findMesh('DERBY_Bumper_Front');
  const rearBumperMesh = findMesh('DERBY_Bumper_Rear');
  const sideBarL = findMesh('DERBY_SideBar_L');
  const sideBarR = findMesh('DERBY_SideBar_R');
  const windowL = findMesh('DERBY_Window_L');
  const windowR = findMesh('DERBY_Window_R');
  const bullBarMesh = new THREE.Group();
  const headlightL = findMesh('DERBY_Headlight_L');
  const headlightR = findMesh('DERBY_Headlight_R');
  const taillightL = findMesh('DERBY_Taillight_L');
  const taillightR = findMesh('DERBY_Taillight_R');

  const exhaustPoint = new THREE.Vector3(0.60, 0.37, 2.13);
  const smokePoint = new THREE.Vector3(0.0, 0.65, -1.35);

  return {
    root,
    bodyGroup,
    chassisMesh,
    hoodMesh,
    trunkMesh,
    cabinMesh,
    frontBumperMesh,
    rearBumperMesh,
    sideBarL,
    sideBarR,
    windowL,
    windowR,
    bullBarMesh,
    wheelFLGroup: wFL.group,
    wheelFRGroup: wFR.group,
    wheelRLGroup: wRL.group,
    wheelRRGroup: wRR.group,
    wheelFLMesh: wFL.mesh,
    wheelFRMesh: wFR.mesh,
    wheelRLMesh: wRL.mesh,
    wheelRRMesh: wRR.mesh,
    headlightL,
    headlightR,
    taillightL,
    taillightR,
    smokePoint,
    exhaustPoint,
    originalColor: mainColorHex,
    accentColor: accentColorHex,
    currentDamageLevel: 'CLEAN',
  };
}

// ── BUILD REALISTIC 3D MUSCLE DERBY CAR MODEL ──────────────
export function create3DVehicle(
  vehicleId: VehicleId,
  mainColorHex: string,
  accentColorHex: string,
  carNumber: string = '23',
  carTitle: string = 'DERBY'
): Vehicle3DObject {
  if (cachedGLTFScene) {
    return create3DVehicleFromGLB(cachedGLTFScene, vehicleId, mainColorHex, accentColorHex, carNumber, carTitle);
  }

  // Fallback procedural car model
  const w = 2.0;
  const l = 4.6;
  const h = 1.45;

  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const mainColor = new THREE.Color(mainColorHex);
  const accentColor = new THREE.Color(accentColorHex);
  const darkMetal = new THREE.Color('#1e293b');
  const steelMetal = new THREE.Color('#475569');
  const chromeMetal = new THREE.Color('#cbd5e1');

  // PBR Materials
  const decalTex = createDirtyDerbyDecalTexture(carNumber, carTitle, mainColorHex);
  const bodyMat = new THREE.MeshStandardMaterial({
    map: decalTex,
    roughness: 0.5,
    metalness: 0.3,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.4,
    metalness: 0.5,
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: darkMetal,
    roughness: 0.8,
    metalness: 0.2,
  });

  const steelMat = new THREE.MeshStandardMaterial({
    color: steelMetal,
    roughness: 0.4,
    metalness: 0.8,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: chromeMetal,
    roughness: 0.2,
    metalness: 0.9,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#020617'),
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.8,
  });

  const tyreMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0f172a'),
    roughness: 0.95,
    metalness: 0.05,
  });

  // 1. Lower Heavy Chassis Base
  const chassisGeo = new THREE.BoxGeometry(w * 0.92, h * 0.35, l * 0.96);
  const chassisMesh = new THREE.Mesh(chassisGeo, darkMat);
  chassisMesh.position.y = h * 0.25;
  chassisMesh.castShadow = true;
  chassisMesh.receiveShadow = true;
  bodyGroup.add(chassisMesh);

  // 2. Main Muscle Car Body Shell
  const mainBodyGeo = new THREE.BoxGeometry(w, h * 0.48, l * 0.9);
  const mainBodyMesh = new THREE.Mesh(mainBodyGeo, bodyMat);
  mainBodyMesh.position.y = h * 0.52;
  mainBodyMesh.castShadow = true;
  mainBodyMesh.receiveShadow = true;
  bodyGroup.add(mainBodyMesh);

  // 3. Sloped Front Hood & Engine Grille
  const hoodGeo = new THREE.BoxGeometry(w * 0.96, h * 0.24, l * 0.36);
  const hoodMesh = new THREE.Mesh(hoodGeo, accentMat);
  hoodMesh.position.set(0, h * 0.64, -l * 0.26);
  hoodMesh.rotation.x = -0.06;
  hoodMesh.castShadow = true;
  bodyGroup.add(hoodMesh);

  // Front Grille Mesh
  const grilleGeo = new THREE.BoxGeometry(w * 0.82, h * 0.2, 0.1);
  const grilleMesh = new THREE.Mesh(grilleGeo, darkMat);
  grilleMesh.position.set(0, h * 0.52, -l * 0.455);
  bodyGroup.add(grilleMesh);

  // 4. Cabin & Glass Windows
  const cabinW = w * 0.84;
  const cabinL = l * 0.46;
  const cabinH = h * 0.52;
  const cabinGeo = new THREE.BoxGeometry(cabinW, cabinH, cabinL);
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
  cabinMesh.position.set(0, h * 0.88, l * 0.04);
  cabinMesh.castShadow = true;
  bodyGroup.add(cabinMesh);

  // Cabin Roof
  const roofGeo = new THREE.BoxGeometry(cabinW * 0.94, 0.08, cabinL * 0.92);
  const roofMesh = new THREE.Mesh(roofGeo, accentMat);
  roofMesh.position.set(0, h * 0.88 + cabinH * 0.5, l * 0.04);
  roofMesh.castShadow = true;
  bodyGroup.add(roofMesh);

  // 5. Heavy Welded Iron Bull Bar & Front Bumper
  const bullBarGroup = new THREE.Group();
  const barMainGeo = new THREE.BoxGeometry(w * 1.1, h * 0.32, 0.28);
  const barMainMesh = new THREE.Mesh(barMainGeo, steelMat);
  barMainMesh.position.set(0, h * 0.44, -l * 0.48);
  barMainMesh.castShadow = true;
  bullBarGroup.add(barMainMesh);

  for (let xOffset of [-w * 0.42, -w * 0.16, w * 0.16, w * 0.42]) {
    const strutGeo = new THREE.CylinderGeometry(0.045, 0.045, h * 0.48);
    const strutMesh = new THREE.Mesh(strutGeo, steelMat);
    strutMesh.position.set(xOffset, h * 0.48, -l * 0.49);
    strutMesh.castShadow = true;
    bullBarGroup.add(strutMesh);
  }
  bodyGroup.add(bullBarGroup);

  // Front & Rear Heavy Bumpers
  const fBumperGeo = new THREE.BoxGeometry(w * 1.04, h * 0.24, 0.22);
  const frontBumperMesh = new THREE.Mesh(fBumperGeo, chromeMat);
  frontBumperMesh.position.set(0, h * 0.36, -l * 0.46);
  frontBumperMesh.castShadow = true;
  bodyGroup.add(frontBumperMesh);

  const rBumperGeo = new THREE.BoxGeometry(w * 1.04, h * 0.26, 0.22);
  const rearBumperMesh = new THREE.Mesh(rBumperGeo, chromeMat);
  rearBumperMesh.position.set(0, h * 0.38, l * 0.46);
  rearBumperMesh.castShadow = true;
  bodyGroup.add(rearBumperMesh);

  // 6. External Welded Steel Roll Cage Frame
  const rollBarL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, cabinL * 1.12), steelMat);
  rollBarL.position.set(-cabinW * 0.52, h * 0.88 + cabinH * 0.42, l * 0.04);
  rollBarL.rotation.x = Math.PI / 2;
  bodyGroup.add(rollBarL);

  const rollBarR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, cabinL * 1.12), steelMat);
  rollBarR.position.set(cabinW * 0.52, h * 0.88 + cabinH * 0.42, l * 0.04);
  rollBarR.rotation.x = Math.PI / 2;
  bodyGroup.add(rollBarR);

  // 7. Headlights & Taillights
  const headGeo = new THREE.BoxGeometry(0.28, 0.18, 0.08);
  const headMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fef08a'),
    emissive: new THREE.Color('#fde047'),
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  const headlightL = new THREE.Mesh(headGeo, headMat);
  headlightL.position.set(-w * 0.36, h * 0.54, -l * 0.46);
  bodyGroup.add(headlightL);

  const headlightR = new THREE.Mesh(headGeo, headMat);
  headlightR.position.set(w * 0.36, h * 0.54, -l * 0.46);
  bodyGroup.add(headlightR);

  const tailGeo = new THREE.BoxGeometry(0.24, 0.16, 0.08);
  const tailMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ef4444'),
    emissive: new THREE.Color('#dc2626'),
    emissiveIntensity: 0.8,
    roughness: 0.2,
  });

  const taillightL = new THREE.Mesh(tailGeo, tailMat);
  taillightL.position.set(-w * 0.36, h * 0.56, l * 0.46);
  bodyGroup.add(taillightL);

  const taillightR = new THREE.Mesh(tailGeo, tailMat);
  taillightR.position.set(w * 0.36, h * 0.56, l * 0.46);
  bodyGroup.add(taillightR);

  // 8. 4 Independent 3D Wheel Assemblies
  const tireRadius = 0.45; // ~0.9m diameter wheel
  const tireWidth = 0.32;

  const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 20);
  const rimGeo = new THREE.CylinderGeometry(tireRadius * 0.56, tireRadius * 0.56, tireWidth * 1.06, 12);

  function makeWheel(): { group: THREE.Group; mesh: THREE.Mesh } {
    const wGroup = new THREE.Group();

    const tMesh = new THREE.Mesh(tireGeo, tyreMat);
    tMesh.rotation.z = Math.PI / 2;
    tMesh.castShadow = true;
    wGroup.add(tMesh);

    const rMesh = new THREE.Mesh(rimGeo, chromeMat);
    rMesh.rotation.z = Math.PI / 2;
    rMesh.castShadow = true;
    wGroup.add(rMesh);

    return { group: wGroup, mesh: tMesh };
  }

  const wheelOffsetZ = l * 0.31;
  const wheelOffsetX = w * 0.49;
  const wheelOffsetY = tireRadius;

  // Front Left
  const wFL = makeWheel();
  const wheelFLGroup = new THREE.Group();
  wheelFLGroup.position.set(-wheelOffsetX, wheelOffsetY, -wheelOffsetZ);
  wheelFLGroup.add(wFL.group);
  root.add(wheelFLGroup);

  // Front Right
  const wFR = makeWheel();
  const wheelFRGroup = new THREE.Group();
  wheelFRGroup.position.set(wheelOffsetX, wheelOffsetY, -wheelOffsetZ);
  wheelFRGroup.add(wFR.group);
  root.add(wheelFRGroup);

  // Rear Left
  const wRL = makeWheel();
  const wheelRLGroup = new THREE.Group();
  wheelRLGroup.position.set(-wheelOffsetX, wheelOffsetY, wheelOffsetZ);
  wheelRLGroup.add(wRL.group);
  root.add(wheelRLGroup);

  // Rear Right
  const wRR = makeWheel();
  const wheelRRGroup = new THREE.Group();
  wheelRRGroup.position.set(wheelOffsetX, wheelOffsetY, wheelOffsetZ);
  wheelRRGroup.add(wRR.group);
  root.add(wheelRRGroup);

  const exhaustPoint = new THREE.Vector3(w * 0.35, h * 0.25, l * 0.48);
  const smokePoint = new THREE.Vector3(0, h * 0.65, -l * 0.35);

  return {
    root,
    bodyGroup,
    chassisMesh,
    hoodMesh,
    cabinMesh,
    frontBumperMesh,
    rearBumperMesh,
    bullBarMesh: bullBarGroup,
    wheelFLGroup,
    wheelFRGroup,
    wheelRLGroup,
    wheelRRGroup,
    wheelFLMesh: wFL.mesh,
    wheelFRMesh: wFR.mesh,
    wheelRLMesh: wRL.mesh,
    wheelRRMesh: wRR.mesh,
    headlightL,
    headlightR,
    taillightL,
    taillightR,
    smokePoint,
    exhaustPoint,
    originalColor: mainColorHex,
    accentColor: accentColorHex,
    currentDamageLevel: 'CLEAN',
  };
}

// ── UPDATE 3D VEHICLE TRANSFORM & WHEELS & DAMAGE ─────────
export function update3DVehicleObject(
  vehObj: Vehicle3DObject,
  state: VehicleState,
  steeringAngleRatio: number,
  dt: number = 0.016
) {
  const { root, bodyGroup, wheelFLGroup, wheelFRGroup, wheelFLMesh, wheelFRMesh, wheelRLMesh, wheelRRMesh } = vehObj;

  // 1. Root Position & Facing Yaw from Cannon-es Physics Body
  root.position.set(state.x, state.y, state.z);
  root.rotation.y = state.rotationY;

  // 2. Wheel Steering Pivot (Y Axis)
  const maxSteerAngle = 0.55;
  const steerAngle = steeringAngleRatio * maxSteerAngle;
  wheelFLGroup.rotation.y = steerAngle;
  wheelFRGroup.rotation.y = steerAngle;

  // 3. Wheel Spin Rotation (X Axis)
  const wheelRadius = 0.45;
  const angularDist = (state.speed * dt) / wheelRadius;

  wheelFLMesh.rotation.x += angularDist;
  wheelFRMesh.rotation.x += angularDist;
  wheelRLMesh.rotation.x += angularDist;
  wheelRRMesh.rotation.x += angularDist;

  // 4. Suspension Dynamic Pitch & Roll
  const forwardAccelEstimate = Math.sin(state.rotationY) * state.vx + -Math.cos(state.rotationY) * state.vz;
  const targetPitch = Math.max(-0.14, Math.min(0.14, -forwardAccelEstimate * 0.008));
  const targetRoll = Math.max(-0.18, Math.min(0.18, steeringAngleRatio * (state.speed / 15) * 0.12));

  bodyGroup.rotation.x += (targetPitch - bodyGroup.rotation.x) * 0.2;
  bodyGroup.rotation.z += (targetRoll - bodyGroup.rotation.z) * 0.2;

  // 5. Visual Damage Progression based on HP
  const hpRatio = state.hp / state.maxHp;
  let newLevel: DamageLevel = 'CLEAN';

  if (state.isDestroyed || state.hp <= 0) {
    newLevel = 'WRECKED';
  } else if (hpRatio < 0.3) {
    newLevel = 'CRUMPLED';
  } else if (hpRatio < 0.6) {
    newLevel = 'DENTED';
  } else if (hpRatio < 0.85) {
    newLevel = 'SCRATCHED';
  }

  if (newLevel !== vehObj.currentDamageLevel) {
    vehObj.currentDamageLevel = newLevel;
    applyVisualDamageToMesh(vehObj, newLevel);
  }
}

// ── APPLY VISUAL DAMAGE DEFORMATION & CHARRED WRECK ───────
function applyVisualDamageToMesh(vehObj: Vehicle3DObject, level: DamageLevel) {
  const {
    hoodMesh,
    frontBumperMesh,
    rearBumperMesh,
    trunkMesh,
    sideBarL,
    sideBarR,
    windowL,
    windowR,
    headlightL,
    headlightR,
    taillightL,
    taillightR,
  } = vehObj;

  const severity = level === 'SCRATCHED' ? 0.25 : level === 'DENTED' ? 0.5 : level === 'CRUMPLED' ? 0.75 : level === 'WRECKED' ? 1.0 : 0.0;
  if (severity === 0) return;

  const dir = vehObj.lastImpactLocalDir || new THREE.Vector3(0, 0, -1);

  // Front impact damage
  if (dir.z < -0.2 || (dir.z >= -0.2 && dir.z <= 0.2 && dir.x >= -0.2 && dir.x <= 0.2)) {
    if (hoodMesh) hoodMesh.rotation.set(0.12 * severity, 0.03 * severity, 0.05 * severity);
    if (frontBumperMesh) frontBumperMesh.rotation.set(-0.20 * severity, 0.05 * severity, -0.04 * severity);
    if (headlightL && (headlightL.material as THREE.MeshStandardMaterial)) {
      (headlightL.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.max(0, 0.9 * (1 - severity * 1.2));
    }
    if (headlightR && (headlightR.material as THREE.MeshStandardMaterial)) {
      (headlightR.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.max(0, 0.9 * (1 - severity * 1.2));
    }
  }

  // Rear impact damage
  if (dir.z > 0.2) {
    if (rearBumperMesh) rearBumperMesh.rotation.set(0.18 * severity, -0.05 * severity, 0.04 * severity);
    if (trunkMesh) trunkMesh.rotation.set(-0.14 * severity, 0.04 * severity, -0.03 * severity);
    if (taillightL && (taillightL.material as THREE.MeshStandardMaterial)) {
      (taillightL.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.max(0, 0.8 * (1 - severity * 1.2));
    }
    if (taillightR && (taillightR.material as THREE.MeshStandardMaterial)) {
      (taillightR.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.max(0, 0.8 * (1 - severity * 1.2));
    }
  }

  // Left impact damage
  if (dir.x < -0.2) {
    if (sideBarL) sideBarL.rotation.set(0.04 * severity, 0.02 * severity, -0.10 * severity);
    if (windowL && (windowL.material as THREE.MeshStandardMaterial)) {
      (windowL.material as THREE.MeshStandardMaterial).opacity = Math.max(0.2, 0.85 * (1 - severity * 0.6));
    }
  }

  // Right impact damage
  if (dir.x > 0.2) {
    if (sideBarR) sideBarR.rotation.set(0.04 * severity, -0.02 * severity, 0.10 * severity);
    if (windowR && (windowR.material as THREE.MeshStandardMaterial)) {
      (windowR.material as THREE.MeshStandardMaterial).opacity = Math.max(0.2, 0.85 * (1 - severity * 0.6));
    }
  }

  // WRECKED material weathering (darken paint color & increase roughness without destroying PBR properties)
  if (level === 'WRECKED') {
    vehObj.bodyGroup.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.color) {
          mat.color.multiplyScalar(0.6);
          mat.roughness = Math.min(0.95, mat.roughness + 0.35);
        }
      }
    });
  }
}

// ── GENERATE 3D DEBRIS PARTS ON HEAVY IMPACT ───────────────
export function spawnImpactDebrisParts(
  impactX: number,
  impactY: number,
  impactZ: number,
  impactVelocity: number,
  mainColorHex: string
): DebrisPiece[] {
  const debrisList: DebrisPiece[] = [];
  const partTypes: Array<'bumper' | 'hood' | 'door' | 'shard'> = ['bumper', 'hood', 'door', 'shard', 'shard'];
  const count = Math.min(8, Math.max(3, Math.floor(impactVelocity * 0.35)));

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * (impactVelocity * 0.6);

    debrisList.push({
      id: `debris_${Date.now()}_${Math.random()}`,
      x: impactX + (Math.random() - 0.5) * 0.8,
      y: Math.max(0.4, impactY + Math.random() * 0.6),
      z: impactZ + (Math.random() - 0.5) * 0.8,
      vx: Math.cos(angle) * speed,
      vy: 3 + Math.random() * 5,
      vz: Math.sin(angle) * speed,
      rotX: Math.random() * Math.PI * 2,
      rotY: Math.random() * Math.PI * 2,
      rotZ: Math.random() * Math.PI * 2,
      vRotX: (Math.random() - 0.5) * 12,
      vRotY: (Math.random() - 0.5) * 12,
      vRotZ: (Math.random() - 0.5) * 12,
      color: Math.random() > 0.5 ? mainColorHex : '#475569',
      scale: 0.35 + Math.random() * 0.45,
      life: 0,
      maxLife: 4.5,
      type: partTypes[i % partTypes.length],
    });
  }

  return debrisList;
}
