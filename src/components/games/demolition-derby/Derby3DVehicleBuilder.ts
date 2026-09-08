import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DamageLevel, DebrisPiece, VehicleId, VehicleState } from './types';
import { VEHICLES } from './DerbyPhysicsEngine';

export interface OriginalMaterialRecord {
  mesh: THREE.Mesh;
  material: THREE.Material | THREE.Material[];
  originalColor?: THREE.Color;
  originalRoughness?: number;
  originalMetalness?: number;
  originalEmissive?: THREE.Color;
  originalEmissiveIntensity?: number;
  originalOpacity?: number;
  originalTransparent?: boolean;
}

export interface OriginalTransformRecord {
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

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
  originalMaterials?: OriginalMaterialRecord[];
  originalTransforms?: OriginalTransformRecord[];
}

// ── CAPTURE BASE VEHICLE VISUAL STATE ────────────────────────
export function captureOriginalVehicleVisualState(veh: Vehicle3DObject): void {
  veh.originalMaterials = [];
  veh.originalTransforms = [];

  // Deep clone each material per mesh so NO materials are ever shared
  veh.root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else {
          mesh.material = mesh.material.clone();
        }

        const primaryMat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
        veh.originalMaterials!.push({
          mesh,
          material: Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone(),
          originalColor: primaryMat.color ? primaryMat.color.clone() : undefined,
          originalRoughness: primaryMat.roughness !== undefined ? primaryMat.roughness : undefined,
          originalMetalness: primaryMat.metalness !== undefined ? primaryMat.metalness : undefined,
          originalEmissive: primaryMat.emissive ? primaryMat.emissive.clone() : undefined,
          originalEmissiveIntensity: primaryMat.emissiveIntensity !== undefined ? primaryMat.emissiveIntensity : undefined,
          originalOpacity: primaryMat.opacity !== undefined ? primaryMat.opacity : undefined,
          originalTransparent: primaryMat.transparent,
        });
      }
    }
  });

  const deformableParts: (THREE.Object3D | undefined)[] = [
    veh.hoodMesh,
    veh.frontBumperMesh,
    veh.rearBumperMesh,
    veh.trunkMesh,
    veh.sideBarL,
    veh.sideBarR,
    veh.windowL,
    veh.windowR,
    veh.headlightL,
    veh.headlightR,
    veh.taillightL,
    veh.taillightR,
    veh.chassisMesh,
    veh.cabinMesh,
  ];

  for (const part of deformableParts) {
    if (part) {
      veh.originalTransforms.push({
        mesh: part,
        position: part.position.clone(),
        rotation: part.rotation.clone(),
        scale: part.scale.clone(),
      });
    }
  }
}

// ── RESTORE VEHICLE TO CLEAN ORIGINAL VISUAL STATE ───────────
export function resetVehicleVisualState(vehObj: Vehicle3DObject): void {
  vehObj.currentDamageLevel = 'CLEAN';
  vehObj.lastImpactLocalDir = undefined;

  // 1. Restore all original mesh transforms for deformable parts
  if (vehObj.originalTransforms && vehObj.originalTransforms.length > 0) {
    for (const record of vehObj.originalTransforms) {
      if (record.mesh) {
        record.mesh.position.copy(record.position);
        record.mesh.rotation.copy(record.rotation);
        record.mesh.scale.copy(record.scale);
      }
    }
  } else {
    if (vehObj.hoodMesh) vehObj.hoodMesh.rotation.set(0, 0, 0);
    if (vehObj.frontBumperMesh) vehObj.frontBumperMesh.rotation.set(0, 0, 0);
    if (vehObj.rearBumperMesh) vehObj.rearBumperMesh.rotation.set(0, 0, 0);
    if (vehObj.trunkMesh) vehObj.trunkMesh.rotation.set(0, 0, 0);
    if (vehObj.sideBarL) vehObj.sideBarL.rotation.set(0, 0, 0);
    if (vehObj.sideBarR) vehObj.sideBarR.rotation.set(0, 0, 0);
  }

  // 2. Restore all original materials and properties
  if (vehObj.originalMaterials && vehObj.originalMaterials.length > 0) {
    for (const record of vehObj.originalMaterials) {
      const mesh = record.mesh;
      if (mesh) {
        if (Array.isArray(record.material)) {
          mesh.material = record.material.map((m) => m.clone());
        } else {
          mesh.material = record.material.clone();
        }

        const primaryMat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
        if (primaryMat) {
          if (record.originalColor && primaryMat.color) {
            primaryMat.color.copy(record.originalColor);
          }
          if (record.originalRoughness !== undefined) {
            primaryMat.roughness = record.originalRoughness;
          }
          if (record.originalMetalness !== undefined) {
            primaryMat.metalness = record.originalMetalness;
          }
          if (record.originalEmissive && primaryMat.emissive) {
            primaryMat.emissive.copy(record.originalEmissive);
          }
          if (record.originalEmissiveIntensity !== undefined) {
            primaryMat.emissiveIntensity = record.originalEmissiveIntensity;
          }
          if (record.originalOpacity !== undefined) {
            primaryMat.opacity = record.originalOpacity;
          }
          if (record.originalTransparent !== undefined) {
            primaryMat.transparent = record.originalTransparent;
          }
        }
      }
    }
  }

  // 3. Re-enforce original configured paint and accent colors
  const mainColor = new THREE.Color(vehObj.originalColor);
  const accentColor = new THREE.Color(vehObj.accentColor);

  vehObj.root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
      if (mat && mat.name) {
        if (mat.name.includes('DERBY_Mat_BodyPaint')) {
          mat.color.copy(mainColor);
        } else if (mat.name.includes('DERBY_Mat_AccentMetal')) {
          mat.color.copy(accentColor);
        }
      }
    }
  });
}

// ── GLTF GLB ASSET LOADER & CACHE ──────────────────────────
const ALL_DERBY_VEHICLE_GLBS = ['road_crusher', 'iron_tanker', 'apex_phantom', 'armored_juggernaut'] as const;
const cachedGLTFScenes: Record<string, THREE.Group> = {};

export function preloadDerbyVehicleGLB(vehicleId?: VehicleId): Promise<THREE.Group | null> {
  const normId = !vehicleId || vehicleId === 'muscle' || vehicleId === 'starter' ? 'road_crusher'
    : vehicleId === 'heavy' ? 'iron_tanker'
    : vehicleId === 'rally' ? 'apex_phantom'
    : vehicleId === 'armored' ? 'armored_juggernaut'
    : vehicleId;

  if (cachedGLTFScenes[normId]) {
    return Promise.resolve(cachedGLTFScenes[normId]);
  }

  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      `/models/derby/${normId}.glb`,
      (gltf) => {
        cachedGLTFScenes[normId] = gltf.scene;
        resolve(gltf.scene);
      },
      undefined,
      (err) => {
        console.warn(`[Demolition Derby] GLB /models/derby/${normId}.glb load error, fallback to procedural:`, err);
        resolve(null);
      }
    );
  });
}

export function preloadAllDerbyGLTFModels(): Promise<void> {
  return Promise.all(ALL_DERBY_VEHICLE_GLBS.map((id) => preloadDerbyVehicleGLB(id as VehicleId))).then(() => {});
}

if (typeof window !== 'undefined') {
  preloadAllDerbyGLTFModels();
}

// ── CANVAS NUMBER DECAL & DIRTY PAINT TEXTURE GENERATOR ───
function createDirtyDerbyDecalTexture(numberStr: string, titleStr: string, bgColorHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColorHex;
  ctx.fillRect(0, 0, 512, 512);

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

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(256, 256, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 14;
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'black 200px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numberStr || '23', 256, 240);

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

  // GLB model Front is modeled towards -Z in Three.js coordinates (facing forward away from chase camera)
  clonedScene.rotation.y = 0;

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

  function wrapWheelInGroup(wheelMesh: THREE.Mesh, posX: number, posY: number, posZ: number): { group: THREE.Group; mesh: THREE.Mesh } {
    const wGroup = new THREE.Group();
    wGroup.position.set(posX, posY, posZ);

    if (wheelMesh.parent) {
      wheelMesh.parent.remove(wheelMesh);
    }
    wheelMesh.position.set(0, 0, 0);
    wheelMesh.rotation.set(0, Math.PI, 0);
    wGroup.add(wheelMesh);

    return { group: wGroup, mesh: wheelMesh };
  }

  // Canonical positions in vehicle space (Forward is -Z, Left is -X):
  // Front Left:  x = -1.02, y = 0.42, z = -1.45
  // Front Right: x = +1.02, y = 0.42, z = -1.45
  // Rear Left:   x = -1.02, y = 0.42, z = +1.45
  // Rear Right:  x = +1.02, y = 0.42, z = +1.45
  const wFL = wrapWheelInGroup(rawWheelFL, -1.02, 0.42, -1.45);
  const wFR = wrapWheelInGroup(rawWheelFR,  1.02, 0.42, -1.45);
  const wRL = wrapWheelInGroup(rawWheelRL, -1.02, 0.42,  1.45);
  const wRR = wrapWheelInGroup(rawWheelRR,  1.02, 0.42,  1.45);

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

  const exhaustPoint = new THREE.Vector3(-0.60, 0.37, 2.13);
  const smokePoint = new THREE.Vector3(0.0, 0.65, -1.35);

  const veh: Vehicle3DObject = {
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

  captureOriginalVehicleVisualState(veh);
  return veh;
}

// ==========================================================
// 1. ROAD CRUSHER V8 (High Speed & Heavy Ramming)
// ==========================================================
function buildRoadCrusherV8(
  mainColorHex: string,
  accentColorHex: string,
  carNumber: string = '08',
  carTitle: string = 'ROAD CRUSHER'
): Vehicle3DObject {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const w = 2.20;
  const l = 4.80;
  const h = 1.45;

  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(mainColorHex), roughness: 0.35, metalness: 0.70 });
  const accentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(accentColorHex), roughness: 0.40, metalness: 0.80 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.90, roughness: 0.25 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.75, roughness: 0.1 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.95 });

  // Chassis
  const chassisMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.90, h * 0.20, l * 0.94), darkMat);
  chassisMesh.position.y = h * 0.22;
  chassisMesh.castShadow = true;
  bodyGroup.add(chassisMesh);

  // Main Muscle Body (Long, Low, Wide)
  const mainBodyMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h * 0.44, l * 0.92), bodyMat);
  mainBodyMesh.position.y = h * 0.50;
  mainBodyMesh.castShadow = true;
  mainBodyMesh.receiveShadow = true;
  bodyGroup.add(mainBodyMesh);

  // Wide Muscle Rear Haunches / Fenders
  const fenderL = new THREE.Mesh(new THREE.BoxGeometry(0.18, h * 0.38, l * 0.38), bodyMat);
  fenderL.position.set(-w * 0.48, h * 0.50, l * 0.26);
  bodyGroup.add(fenderL);
  const fenderR = new THREE.Mesh(new THREE.BoxGeometry(0.18, h * 0.38, l * 0.38), bodyMat);
  fenderR.position.set(w * 0.48, h * 0.50, l * 0.26);
  bodyGroup.add(fenderR);

  // Elongated Hood with dual air extraction vents
  const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.90, h * 0.22, l * 0.40), accentMat);
  hoodMesh.position.set(0, h * 0.62, -l * 0.26);
  hoodMesh.rotation.x = -0.05;
  hoodMesh.castShadow = true;
  bodyGroup.add(hoodMesh);

  // Exposed V8 Supercharger / Blower Block
  const blowerBase = new THREE.Mesh(new THREE.BoxGeometry(w * 0.36, h * 0.26, l * 0.16), chromeMat);
  blowerBase.position.set(0, h * 0.76, -l * 0.24);
  blowerBase.castShadow = true;
  bodyGroup.add(blowerBase);

  // Dual Red Butterfly Throttle Valves / Scoop
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, h * 0.14, l * 0.12), steelMat);
  scoop.position.set(0, h * 0.88, -l * 0.28);
  bodyGroup.add(scoop);
  const butterfly1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
  butterfly1.rotation.x = Math.PI / 2;
  butterfly1.position.set(-0.11, h * 0.88, -l * 0.34);
  bodyGroup.add(butterfly1);
  const butterfly2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
  butterfly2.rotation.x = Math.PI / 2;
  butterfly2.position.set(0.11, h * 0.88, -l * 0.34);
  bodyGroup.add(butterfly2);

  // Chopped Muscle Cabin
  const cabinW = w * 0.80;
  const cabinL = l * 0.40;
  const cabinH = h * 0.48;
  const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(cabinW, cabinH, cabinL), glassMat);
  cabinMesh.position.set(0, h * 0.82, l * 0.06);
  cabinMesh.castShadow = true;
  bodyGroup.add(cabinMesh);

  // Fastback Roof
  const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.94, 0.08, cabinL * 0.96), accentMat);
  roofMesh.position.set(0, h * 0.82 + cabinH * 0.5, l * 0.06);
  roofMesh.castShadow = true;
  bodyGroup.add(roofMesh);

  // Window Steel Safety Bars
  for (let zOffset of [-0.4, 0, 0.4]) {
    const barL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, cabinH * 0.85), steelMat);
    barL.position.set(-cabinW * 0.51, h * 0.82, l * 0.06 + zOffset);
    bodyGroup.add(barL);
    const barR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, cabinH * 0.85), steelMat);
    barR.position.set(cabinW * 0.51, h * 0.82, l * 0.06 + zOffset);
    bodyGroup.add(barR);
  }

  // Heavy Front Ram / Bull Bar
  const bullBarGroup = new THREE.Group();
  const mainBar = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, h * 0.30, 0.26), steelMat);
  mainBar.position.set(0, h * 0.42, -l * 0.48);
  mainBar.castShadow = true;
  bullBarGroup.add(mainBar);

  for (let xOffset of [-w * 0.40, -w * 0.15, w * 0.15, w * 0.40]) {
    const fang = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h * 0.55), steelMat);
    fang.position.set(xOffset, h * 0.46, -l * 0.50);
    fang.castShadow = true;
    bullBarGroup.add(fang);
  }
  bodyGroup.add(bullBarGroup);

  const frontBumperMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * 0.22, 0.20), chromeMat);
  frontBumperMesh.position.set(0, h * 0.34, -l * 0.46);
  bodyGroup.add(frontBumperMesh);

  const rearBumperMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * 0.24, 0.20), chromeMat);
  rearBumperMesh.position.set(0, h * 0.36, l * 0.46);
  bodyGroup.add(rearBumperMesh);

  // Side Rocker Exhaust Pipes
  const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, l * 0.5), chromeMat);
  exhaustL.rotation.x = Math.PI / 2;
  exhaustL.position.set(-w * 0.49, h * 0.24, 0);
  bodyGroup.add(exhaustL);
  const exhaustR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, l * 0.5), chromeMat);
  exhaustR.rotation.x = Math.PI / 2;
  exhaustR.position.set(w * 0.49, h * 0.24, 0);
  bodyGroup.add(exhaustR);

  // Quad Headlights & Triple Taillights
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 1.0 });
  const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headMat);
  headlightL.position.set(-w * 0.35, h * 0.52, -l * 0.46);
  bodyGroup.add(headlightL);
  const headlightR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headMat);
  headlightR.position.set(w * 0.35, h * 0.52, -l * 0.46);
  bodyGroup.add(headlightR);

  const tailMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.9 });
  const taillightL = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.14, 0.08), tailMat);
  taillightL.position.set(-w * 0.35, h * 0.54, l * 0.46);
  bodyGroup.add(taillightL);
  const taillightR = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.14, 0.08), tailMat);
  taillightR.position.set(w * 0.35, h * 0.54, l * 0.46);
  bodyGroup.add(taillightR);

  // Wheels (Medium Thick Muscle Wheels)
  const tireRadius = 0.44;
  const tireWidth = 0.36;
  const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 20);
  const rimGeo = new THREE.CylinderGeometry(tireRadius * 0.58, tireRadius * 0.58, tireWidth * 1.05, 10);

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
  const wheelOffsetX = w * 0.48;
  const wheelOffsetY = tireRadius;

  const wFL = makeWheel();
  const wheelFLGroup = new THREE.Group();
  wheelFLGroup.position.set(-wheelOffsetX, wheelOffsetY, -wheelOffsetZ);
  wheelFLGroup.add(wFL.group);
  root.add(wheelFLGroup);

  const wFR = makeWheel();
  const wheelFRGroup = new THREE.Group();
  wheelFRGroup.position.set(wheelOffsetX, wheelOffsetY, -wheelOffsetZ);
  wheelFRGroup.add(wFR.group);
  root.add(wheelFRGroup);

  const wRL = makeWheel();
  const wheelRLGroup = new THREE.Group();
  wheelRLGroup.position.set(-wheelOffsetX, wheelOffsetY, wheelOffsetZ);
  wheelRLGroup.add(wRL.group);
  root.add(wheelRLGroup);

  const wRR = makeWheel();
  const wheelRRGroup = new THREE.Group();
  wheelRRGroup.position.set(wheelOffsetX, wheelOffsetY, wheelOffsetZ);
  wheelRRGroup.add(wRR.group);
  root.add(wheelRRGroup);

  const exhaustPoint = new THREE.Vector3(-w * 0.49, h * 0.24, l * 0.20);
  const smokePoint = new THREE.Vector3(0, h * 0.88, -l * 0.28);

  const veh: Vehicle3DObject = {
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

  captureOriginalVehicleVisualState(veh);
  return veh;
}

// ==========================================================
// 2. IRON TANKER (Ultimate Armor & Collision Power)
// ==========================================================
function buildIronTanker(
  mainColorHex: string,
  accentColorHex: string,
  carNumber: string = '55',
  carTitle: string = 'IRON TANKER'
): Vehicle3DObject {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const w = 2.60;
  const l = 5.20;
  const h = 1.90;

  const armorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(mainColorHex), roughness: 0.55, metalness: 0.85 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(accentColorHex), roughness: 0.45, metalness: 0.60 });
  const heavySteel = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95, roughness: 0.30 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.95 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, transparent: true, opacity: 0.85, roughness: 0.1 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.98 });

  // Heavy Box Chassis
  const chassisMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, h * 0.28, l * 0.96), heavySteel);
  chassisMesh.position.y = h * 0.28;
  chassisMesh.castShadow = true;
  bodyGroup.add(chassisMesh);

  // Massive Armored Body Shell
  const mainBodyMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, h * 0.55, l * 0.92), armorMat);
  mainBodyMesh.position.y = h * 0.58;
  mainBodyMesh.castShadow = true;
  bodyGroup.add(mainBodyMesh);

  // Heavy Side Armor Skirts / Blast Plates
  const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.16, h * 0.40, l * 0.86), armorMat);
  skirtL.position.set(-w * 0.48, h * 0.44, 0);
  skirtL.castShadow = true;
  bodyGroup.add(skirtL);
  const skirtR = new THREE.Mesh(new THREE.BoxGeometry(0.16, h * 0.40, l * 0.86), armorMat);
  skirtR.position.set(w * 0.48, h * 0.44, 0);
  skirtR.castShadow = true;
  bodyGroup.add(skirtR);

  // Sloped Reinforced Heavy Hood
  const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, h * 0.32, l * 0.36), hazardMat);
  hoodMesh.position.set(0, h * 0.74, -l * 0.27);
  hoodMesh.rotation.x = -0.12;
  hoodMesh.castShadow = true;
  bodyGroup.add(hoodMesh);

  // Heavy Industrial Cab (Bunker Visor)
  const cabinW = w * 0.86;
  const cabinL = l * 0.42;
  const cabinH = h * 0.52;
  const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(cabinW, cabinH, cabinL), glassMat);
  cabinMesh.position.set(0, h * 1.05, l * 0.08);
  cabinMesh.castShadow = true;
  bodyGroup.add(cabinMesh);

  const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 1.04, 0.12, cabinL * 1.02), heavySteel);
  roofMesh.position.set(0, h * 1.05 + cabinH * 0.5, l * 0.08);
  roofMesh.castShadow = true;
  bodyGroup.add(roofMesh);

  // Heavy Roof Roll Cage & Dual Floodlights
  const floodMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, emissive: 0xfde047, emissiveIntensity: 1.2 });
  const floodL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 16), floodMat);
  floodL.rotation.x = Math.PI / 2;
  floodL.position.set(-0.45, h * 1.05 + cabinH * 0.5 + 0.18, l * 0.08 - cabinL * 0.45);
  bodyGroup.add(floodL);
  const floodR = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 16), floodMat);
  floodR.rotation.x = Math.PI / 2;
  floodR.position.set(0.45, h * 1.05 + cabinH * 0.5 + 0.18, l * 0.08 - cabinL * 0.45);
  bodyGroup.add(floodR);

  // Multi-Tier Box Demolition Bumper with Angle Plow Corners
  const bullBarGroup = new THREE.Group();
  const frontBoxBumper = new THREE.Mesh(new THREE.BoxGeometry(w * 1.12, h * 0.44, 0.38), heavySteel);
  frontBoxBumper.position.set(0, h * 0.48, -l * 0.48);
  frontBoxBumper.castShadow = true;
  bullBarGroup.add(frontBoxBumper);

  // Heavy Push-Plow Wedge Center
  const plowWedge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.60, h * 0.36, 0.28), hazardMat);
  plowWedge.position.set(0, h * 0.48, -l * 0.52);
  bullBarGroup.add(plowWedge);
  bodyGroup.add(bullBarGroup);

  const frontBumperMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, h * 0.28, 0.24), heavySteel);
  frontBumperMesh.position.set(0, h * 0.38, -l * 0.46);
  bodyGroup.add(frontBumperMesh);

  const rearBumperMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, h * 0.32, 0.26), heavySteel);
  rearBumperMesh.position.set(0, h * 0.42, l * 0.46);
  bodyGroup.add(rearBumperMesh);

  // Headlights & Tail Lights
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff7ed, emissive: 0xfde047, emissiveIntensity: 1.0 });
  const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.20, 0.10), headMat);
  headlightL.position.set(-w * 0.36, h * 0.62, -l * 0.46);
  bodyGroup.add(headlightL);
  const headlightR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.20, 0.10), headMat);
  headlightR.position.set(w * 0.36, h * 0.62, -l * 0.46);
  bodyGroup.add(headlightR);

  const tailMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xb91c1c, emissiveIntensity: 0.9 });
  const taillightL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.10), tailMat);
  taillightL.position.set(-w * 0.36, h * 0.64, l * 0.46);
  bodyGroup.add(taillightL);
  const taillightR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.10), tailMat);
  taillightR.position.set(w * 0.36, h * 0.64, l * 0.46);
  bodyGroup.add(taillightR);

  // Massive Heavy-Duty Industrial Tyres
  const tireRadius = 0.52;
  const tireWidth = 0.48;
  const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 22);
  const rimGeo = new THREE.CylinderGeometry(tireRadius * 0.52, tireRadius * 0.52, tireWidth * 1.08, 12);

  function makeWheel(): { group: THREE.Group; mesh: THREE.Mesh } {
    const wGroup = new THREE.Group();
    const tMesh = new THREE.Mesh(tireGeo, tyreMat);
    tMesh.rotation.z = Math.PI / 2;
    tMesh.castShadow = true;
    wGroup.add(tMesh);
    const rMesh = new THREE.Mesh(rimGeo, heavySteel);
    rMesh.rotation.z = Math.PI / 2;
    rMesh.castShadow = true;
    wGroup.add(rMesh);
    return { group: wGroup, mesh: tMesh };
  }

  const wheelOffsetZ = l * 0.32;
  const wheelOffsetX = w * 0.49;
  const wheelOffsetY = tireRadius;

  const wFL = makeWheel();
  const wheelFLGroup = new THREE.Group();
  wheelFLGroup.position.set(-wheelOffsetX, wheelOffsetY, -wheelOffsetZ);
  wheelFLGroup.add(wFL.group);
  root.add(wheelFLGroup);

  const wFR = makeWheel();
  const wheelFRGroup = new THREE.Group();
  wheelFRGroup.position.set(wheelOffsetX, wheelOffsetY, -wheelOffsetZ);
  wheelFRGroup.add(wFR.group);
  root.add(wheelFRGroup);

  const wRL = makeWheel();
  const wheelRLGroup = new THREE.Group();
  wheelRLGroup.position.set(-wheelOffsetX, wheelOffsetY, wheelOffsetZ);
  wheelRLGroup.add(wRL.group);
  root.add(wheelRLGroup);

  const wRR = makeWheel();
  const wheelRRGroup = new THREE.Group();
  wheelRRGroup.position.set(wheelOffsetX, wheelOffsetY, wheelOffsetZ);
  wheelRRGroup.add(wRR.group);
  root.add(wheelRRGroup);

  const exhaustPoint = new THREE.Vector3(-w * 0.40, h * 0.35, l * 0.48);
  const smokePoint = new THREE.Vector3(0, h * 0.85, -l * 0.30);

  const veh: Vehicle3DObject = {
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

  captureOriginalVehicleVisualState(veh);
  return veh;
}

// ==========================================================
// 3. APEX PHANTOM (Agile Drift & Quick Escape)
// ==========================================================
function buildApexPhantom(
  mainColorHex: string,
  accentColorHex: string,
  carNumber: string = '07',
  carTitle: string = 'APEX PHANTOM'
): Vehicle3DObject {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const w = 2.05;
  const l = 4.40;
  const h = 1.15;

  const aeroMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(mainColorHex), roughness: 0.25, metalness: 0.85 });
  const neonMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(accentColorHex), roughness: 0.30, metalness: 0.90, emissive: new THREE.Color(accentColorHex), emissiveIntensity: 0.3 });
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.35, metalness: 0.90 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.70, roughness: 0.05 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.90 });

  // Ultra-Low Chassis Pan
  const chassisMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.90, h * 0.18, l * 0.95), carbonMat);
  chassisMesh.position.y = h * 0.20;
  chassisMesh.castShadow = true;
  bodyGroup.add(chassisMesh);

  // Aerodynamic Low-Wedge Body
  const mainBodyMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, h * 0.42, l * 0.90), aeroMat);
  mainBodyMesh.position.y = h * 0.45;
  mainBodyMesh.castShadow = true;
  bodyGroup.add(mainBodyMesh);

  // Sharp Sloped Aerodynamic Front Nose with Aero Ducts
  const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, h * 0.20, l * 0.42), neonMat);
  hoodMesh.position.set(0, h * 0.50, -l * 0.26);
  hoodMesh.rotation.x = -0.16;
  hoodMesh.castShadow = true;
  bodyGroup.add(hoodMesh);

  // Carbon Front Splitter Blade
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.06, l * 0.18), carbonMat);
  splitter.position.set(0, h * 0.18, -l * 0.46);
  splitter.castShadow = true;
  bodyGroup.add(splitter);

  // Side Aero Strake Skirts
  const strakeL = new THREE.Mesh(new THREE.BoxGeometry(0.10, h * 0.22, l * 0.50), neonMat);
  strakeL.position.set(-w * 0.47, h * 0.35, 0);
  bodyGroup.add(strakeL);
  const strakeR = new THREE.Mesh(new THREE.BoxGeometry(0.10, h * 0.22, l * 0.50), neonMat);
  strakeR.position.set(w * 0.47, h * 0.35, 0);
  bodyGroup.add(strakeR);

  // Low Panoramic Canopy
  const cabinW = w * 0.76;
  const cabinL = l * 0.40;
  const cabinH = h * 0.46;
  const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(cabinW, cabinH, cabinL), glassMat);
  cabinMesh.position.set(0, h * 0.74, l * 0.04);
  cabinMesh.castShadow = true;
  bodyGroup.add(cabinMesh);

  const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 0.88, 0.06, cabinL * 0.88), carbonMat);
  roofMesh.position.set(0, h * 0.74 + cabinH * 0.5, l * 0.04);
  roofMesh.castShadow = true;
  bodyGroup.add(roofMesh);

  // High-Downforce Rear Drift Wing
  const wingGroup = new THREE.Group();
  const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, 0.06, 0.35), neonMat);
  wingBlade.position.set(0, h * 0.88, l * 0.40);
  wingBlade.castShadow = true;
  wingGroup.add(wingBlade);

  // Wing Endplates
  const endplateL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.38), carbonMat);
  endplateL.position.set(-w * 0.54, h * 0.88, l * 0.40);
  wingGroup.add(endplateL);
  const endplateR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.38), carbonMat);
  endplateR.position.set(w * 0.54, h * 0.88, l * 0.40);
  wingGroup.add(endplateR);

  // Stanchions
  const standL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h * 0.40), carbonMat);
  standL.position.set(-w * 0.28, h * 0.68, l * 0.40);
  wingGroup.add(standL);
  const standR = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h * 0.40), carbonMat);
  standR.position.set(w * 0.28, h * 0.68, l * 0.40);
  wingGroup.add(standR);
  bodyGroup.add(wingGroup);

  const frontBumperMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 0.20, 0.18), carbonMat);
  frontBumperMesh.position.set(0, h * 0.28, -l * 0.45);
  bodyGroup.add(frontBumperMesh);

  const rearBumperMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 0.22, 0.18), carbonMat);
  rearBumperMesh.position.set(0, h * 0.32, l * 0.45);
  bodyGroup.add(rearBumperMesh);

  // High Central Exhaust Ports
  const exMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.8 });
  const centerExhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 16), exMat);
  centerExhaust.rotation.x = Math.PI / 2;
  centerExhaust.position.set(0, h * 0.44, l * 0.46);
  bodyGroup.add(centerExhaust);

  // Futuristic LED Light Strips
  const headMat = new THREE.MeshStandardMaterial({ color: 0xa5f3fc, emissive: 0x06b6d4, emissiveIntensity: 1.4 });
  const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.08), headMat);
  headlightL.position.set(-w * 0.34, h * 0.44, -l * 0.45);
  bodyGroup.add(headlightL);
  const headlightR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.08), headMat);
  headlightR.position.set(w * 0.34, h * 0.44, -l * 0.45);
  bodyGroup.add(headlightR);

  const tailMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 1.2 });
  const taillightL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), tailMat);
  taillightL.position.set(-w * 0.34, h * 0.48, l * 0.45);
  bodyGroup.add(taillightL);
  const taillightR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), tailMat);
  taillightR.position.set(w * 0.34, h * 0.48, l * 0.45);
  bodyGroup.add(taillightR);

  // Lightweight Performance Alloy Wheels
  const tireRadius = 0.38;
  const tireWidth = 0.34;
  const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 20);
  const rimGeo = new THREE.CylinderGeometry(tireRadius * 0.65, tireRadius * 0.65, tireWidth * 1.05, 8);

  function makeWheel(): { group: THREE.Group; mesh: THREE.Mesh } {
    const wGroup = new THREE.Group();
    const tMesh = new THREE.Mesh(tireGeo, tyreMat);
    tMesh.rotation.z = Math.PI / 2;
    tMesh.castShadow = true;
    wGroup.add(tMesh);
    const rMesh = new THREE.Mesh(rimGeo, carbonMat);
    rMesh.rotation.z = Math.PI / 2;
    rMesh.castShadow = true;
    wGroup.add(rMesh);
    return { group: wGroup, mesh: tMesh };
  }

  const wheelOffsetZ = l * 0.30;
  const wheelOffsetX = w * 0.48;
  const wheelOffsetY = tireRadius;

  const wFL = makeWheel();
  const wheelFLGroup = new THREE.Group();
  wheelFLGroup.position.set(-wheelOffsetX, wheelOffsetY, -wheelOffsetZ);
  wheelFLGroup.add(wFL.group);
  root.add(wheelFLGroup);

  const wFR = makeWheel();
  const wheelFRGroup = new THREE.Group();
  wheelFRGroup.position.set(wheelOffsetX, wheelOffsetY, -wheelOffsetZ);
  wheelFRGroup.add(wFR.group);
  root.add(wheelFRGroup);

  const wRL = makeWheel();
  const wheelRLGroup = new THREE.Group();
  wheelRLGroup.position.set(-wheelOffsetX, wheelOffsetY, wheelOffsetZ);
  wheelRLGroup.add(wRL.group);
  root.add(wheelRLGroup);

  const wRR = makeWheel();
  const wheelRRGroup = new THREE.Group();
  wheelRRGroup.position.set(wheelOffsetX, wheelOffsetY, wheelOffsetZ);
  wheelRRGroup.add(wRR.group);
  root.add(wheelRRGroup);

  const exhaustPoint = new THREE.Vector3(0, h * 0.44, l * 0.46);
  const smokePoint = new THREE.Vector3(0, h * 0.55, -l * 0.30);

  const veh: Vehicle3DObject = {
    root,
    bodyGroup,
    chassisMesh,
    hoodMesh,
    cabinMesh,
    frontBumperMesh,
    rearBumperMesh,
    bullBarMesh: wingGroup,
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

  captureOriginalVehicleVisualState(veh);
  return veh;
}

// ==========================================================
// 4. ARMORED JUGGERNAUT (Unstoppable Demolition Monster)
// ==========================================================
function buildArmoredJuggernaut(
  mainColorHex: string,
  accentColorHex: string,
  carNumber: string = '99',
  carTitle: string = 'JUGGERNAUT'
): Vehicle3DObject {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const w = 2.90;
  const l = 5.80;
  const h = 2.30;

  const juggMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(mainColorHex), roughness: 0.60, metalness: 0.80 });
  const goldHazard = new THREE.MeshStandardMaterial({ color: new THREE.Color(accentColorHex), roughness: 0.45, metalness: 0.75 });
  const heavyIron = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.95, roughness: 0.35 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, transparent: true, opacity: 0.85, roughness: 0.1 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.98 });

  // Massive Heavy Steel Frame
  const chassisMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h * 0.32, l * 0.96), heavyIron);
  chassisMesh.position.y = h * 0.32;
  chassisMesh.castShadow = true;
  bodyGroup.add(chassisMesh);

  // Colossal Armored Hull
  const mainBodyMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, h * 0.58, l * 0.92), juggMat);
  mainBodyMesh.position.y = h * 0.64;
  mainBodyMesh.castShadow = true;
  bodyGroup.add(mainBodyMesh);

  // Reinforced Hood
  const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, h * 0.36, l * 0.38), juggMat);
  hoodMesh.position.set(0, h * 0.82, -l * 0.28);
  hoodMesh.rotation.x = -0.10;
  hoodMesh.castShadow = true;
  bodyGroup.add(hoodMesh);

  // Armored Bunker Cabin with Slit Visors
  const cabinW = w * 0.88;
  const cabinL = l * 0.42;
  const cabinH = h * 0.54;
  const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(cabinW, cabinH, cabinL), glassMat);
  cabinMesh.position.set(0, h * 1.18, l * 0.06);
  cabinMesh.castShadow = true;
  bodyGroup.add(cabinMesh);

  const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(cabinW * 1.05, 0.16, cabinL * 1.05), heavyIron);
  roofMesh.position.set(0, h * 1.18 + cabinH * 0.5, l * 0.06);
  roofMesh.castShadow = true;
  bodyGroup.add(roofMesh);

  // Dual Vertical Smokestacks Behind Cabin
  const stackMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
  const stackL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h * 0.85, 16), stackMat);
  stackL.position.set(-cabinW * 0.42, h * 1.30, l * 0.30);
  stackL.castShadow = true;
  bodyGroup.add(stackL);
  const stackR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h * 0.85, 16), stackMat);
  stackR.position.set(cabinW * 0.42, h * 1.30, l * 0.30);
  stackR.castShadow = true;
  bodyGroup.add(stackR);

  // Enormous Bulldozer V-Plow Front Blade with Steel Spikes
  const bullBarGroup = new THREE.Group();
  const plowLeft = new THREE.Mesh(new THREE.BoxGeometry(w * 0.65, h * 0.55, 0.30), goldHazard);
  plowLeft.position.set(-w * 0.28, h * 0.50, -l * 0.48);
  plowLeft.rotation.y = 0.35;
  plowLeft.castShadow = true;
  bullBarGroup.add(plowLeft);

  const plowRight = new THREE.Mesh(new THREE.BoxGeometry(w * 0.65, h * 0.55, 0.30), goldHazard);
  plowRight.position.set(w * 0.28, h * 0.50, -l * 0.48);
  plowRight.rotation.y = -0.35;
  plowRight.castShadow = true;
  bullBarGroup.add(plowRight);

  // V-Plow Spikes
  for (let s of [-w * 0.45, -w * 0.22, 0, w * 0.22, w * 0.45]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.42, 8), heavyIron);
    spike.rotation.x = -Math.PI / 2;
    spike.position.set(s, h * 0.45, -l * 0.55);
    spike.castShadow = true;
    bullBarGroup.add(spike);
  }
  bodyGroup.add(bullBarGroup);

  const frontBumperMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 1.10, h * 0.32, 0.26), heavyIron);
  frontBumperMesh.position.set(0, h * 0.40, -l * 0.46);
  bodyGroup.add(frontBumperMesh);

  const rearBumperMesh = new THREE.Mesh(new THREE.BoxGeometry(w * 1.10, h * 0.35, 0.28), heavyIron);
  rearBumperMesh.position.set(0, h * 0.45, l * 0.46);
  bodyGroup.add(rearBumperMesh);

  // Heavy Industrial Headlights & Taillights
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xeab308, emissiveIntensity: 1.2 });
  const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.24, 0.12), headMat);
  headlightL.position.set(-w * 0.38, h * 0.70, -l * 0.46);
  bodyGroup.add(headlightL);
  const headlightR = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.24, 0.12), headMat);
  headlightR.position.set(w * 0.38, h * 0.70, -l * 0.46);
  bodyGroup.add(headlightR);

  const tailMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.0 });
  const taillightL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.20, 0.12), tailMat);
  taillightL.position.set(-w * 0.38, h * 0.72, l * 0.46);
  bodyGroup.add(taillightL);
  const taillightR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.20, 0.12), tailMat);
  taillightR.position.set(w * 0.38, h * 0.72, l * 0.46);
  bodyGroup.add(taillightR);

  // Monster Tractor Wheels (Deep Lugs)
  const tireRadius = 0.60;
  const tireWidth = 0.55;
  const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 24);
  const rimGeo = new THREE.CylinderGeometry(tireRadius * 0.50, tireRadius * 0.50, tireWidth * 1.10, 12);

  function makeWheel(): { group: THREE.Group; mesh: THREE.Mesh } {
    const wGroup = new THREE.Group();
    const tMesh = new THREE.Mesh(tireGeo, tyreMat);
    tMesh.rotation.z = Math.PI / 2;
    tMesh.castShadow = true;
    wGroup.add(tMesh);
    const rMesh = new THREE.Mesh(rimGeo, heavyIron);
    rMesh.rotation.z = Math.PI / 2;
    rMesh.castShadow = true;
    wGroup.add(rMesh);
    return { group: wGroup, mesh: tMesh };
  }

  const wheelOffsetZ = l * 0.32;
  const wheelOffsetX = w * 0.49;
  const wheelOffsetY = tireRadius;

  const wFL = makeWheel();
  const wheelFLGroup = new THREE.Group();
  wheelFLGroup.position.set(-wheelOffsetX, wheelOffsetY, -wheelOffsetZ);
  wheelFLGroup.add(wFL.group);
  root.add(wheelFLGroup);

  const wFR = makeWheel();
  const wheelFRGroup = new THREE.Group();
  wheelFRGroup.position.set(wheelOffsetX, wheelOffsetY, -wheelOffsetZ);
  wheelFRGroup.add(wFR.group);
  root.add(wheelFRGroup);

  const wRL = makeWheel();
  const wheelRLGroup = new THREE.Group();
  wheelRLGroup.position.set(-wheelOffsetX, wheelOffsetY, wheelOffsetZ);
  wheelRLGroup.add(wRL.group);
  root.add(wheelRLGroup);

  const wRR = makeWheel();
  const wheelRRGroup = new THREE.Group();
  wheelRRGroup.position.set(wheelOffsetX, wheelOffsetY, wheelOffsetZ);
  wheelRRGroup.add(wRR.group);
  root.add(wheelRRGroup);

  const exhaustPoint = new THREE.Vector3(-cabinW * 0.42, h * 1.70, l * 0.30);
  const smokePoint = new THREE.Vector3(0, h * 0.95, -l * 0.32);

  const veh: Vehicle3DObject = {
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

  captureOriginalVehicleVisualState(veh);
  return veh;
}

// ── MASTER 3D VEHICLE FACTORY ──────────────────────────────
export function create3DVehicle(
  vehicleId: VehicleId,
  mainColorHex: string,
  accentColorHex: string,
  carNumber: string = '23',
  carTitle: string = 'DERBY'
): Vehicle3DObject {
  const normId = vehicleId === 'muscle' || vehicleId === 'starter' ? 'road_crusher'
    : vehicleId === 'heavy' ? 'iron_tanker'
    : vehicleId === 'rally' ? 'apex_phantom'
    : vehicleId === 'armored' ? 'armored_juggernaut'
    : vehicleId;

  let veh: Vehicle3DObject;
  if (cachedGLTFScenes[normId]) {
    veh = create3DVehicleFromGLB(cachedGLTFScenes[normId], normId as VehicleId, mainColorHex, accentColorHex, carNumber, carTitle);
  } else {
    switch (normId) {
      case 'iron_tanker':
        veh = buildIronTanker(mainColorHex, accentColorHex, carNumber, 'IRON TANKER');
        break;
      case 'apex_phantom':
        veh = buildApexPhantom(mainColorHex, accentColorHex, carNumber, 'APEX PHANTOM');
        break;
      case 'armored_juggernaut':
        veh = buildArmoredJuggernaut(mainColorHex, accentColorHex, carNumber, 'JUGGERNAUT');
        break;
      case 'road_crusher':
      default:
        veh = buildRoadCrusherV8(mainColorHex, accentColorHex, carNumber, 'ROAD CRUSHER');
        break;
    }

    preloadDerbyVehicleGLB(normId as VehicleId).then((scene) => {
      if (scene) {
        const glbVeh = create3DVehicleFromGLB(scene, normId as VehicleId, mainColorHex, accentColorHex, carNumber, carTitle);
        veh.bodyGroup.clear();
        veh.bodyGroup.add(glbVeh.bodyGroup);
        veh.hoodMesh = glbVeh.hoodMesh;
        veh.frontBumperMesh = glbVeh.frontBumperMesh;
        veh.rearBumperMesh = glbVeh.rearBumperMesh;
        veh.trunkMesh = glbVeh.trunkMesh;
        veh.sideBarL = glbVeh.sideBarL;
        veh.sideBarR = glbVeh.sideBarR;
        veh.windowL = glbVeh.windowL;
        veh.windowR = glbVeh.windowR;
        veh.headlightL = glbVeh.headlightL;
        veh.headlightR = glbVeh.headlightR;
        veh.taillightL = glbVeh.taillightL;
        veh.taillightR = glbVeh.taillightR;
        veh.chassisMesh = glbVeh.chassisMesh;
        veh.cabinMesh = glbVeh.cabinMesh;
        veh.originalMaterials = glbVeh.originalMaterials;
        veh.originalTransforms = glbVeh.originalTransforms;
        veh.currentDamageLevel = 'CLEAN';
      }
    });
  }

  captureOriginalVehicleVisualState(veh);
  return veh;
}

// ── UPDATE 3D VEHICLE TRANSFORM & WHEELS & DAMAGE ─────────
export function update3DVehicleObject(
  vehObj: Vehicle3DObject,
  state: VehicleState,
  steeringAngleRatio: number,
  dt: number = 0.016
) {
  const { root, bodyGroup, wheelFLGroup, wheelFRGroup, wheelFLMesh, wheelFRMesh, wheelRLMesh, wheelRRMesh } = vehObj;

  // 1. Synchronize Authoritative Physics Transform
  root.position.set(state.x, state.y || 0, state.z);
  root.rotation.y = state.rotationY;

  // 2. Wheel Steering Pivot (Y Axis)
  const maxSteerAngle = 0.55;
  const steerAngle = -steeringAngleRatio * maxSteerAngle;
  wheelFLGroup.rotation.y = steerAngle;
  wheelFRGroup.rotation.y = steerAngle;

  // 3. Wheel Spin Rotation (X Axis rolling forward along -Z)
  const wheelRadius = 0.42;
  const angularDist = (state.speed * dt) / wheelRadius;

  wheelFLMesh.rotation.x -= angularDist;
  wheelFRMesh.rotation.x -= angularDist;
  wheelRLMesh.rotation.x -= angularDist;
  wheelRRMesh.rotation.x -= angularDist;

  // 4. Dynamic Suspension & Slope Pitch & Roll
  const targetPitch = state.pitch || 0;
  const targetRoll = state.roll || 0;

  bodyGroup.rotation.x += (targetPitch - bodyGroup.rotation.x) * Math.min(1.0, 15 * dt);
  bodyGroup.rotation.z += (targetRoll - bodyGroup.rotation.z) * Math.min(1.0, 15 * dt);

  // 5. Visual Damage Progression
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

// ── APPLY VISUAL DAMAGE DEFORMATION ────────────────────────
export function applyVisualDamageToMesh(vehObj: Vehicle3DObject, level: DamageLevel) {
  if (level === 'CLEAN') {
    resetVehicleVisualState(vehObj);
    return;
  }

  // Restore clean baseline first before calculating new damage state
  resetVehicleVisualState(vehObj);
  vehObj.currentDamageLevel = level;

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
  const dir = vehObj.lastImpactLocalDir || new THREE.Vector3(0, 0, -1);

  // Front impact damage (Forward is -Z)
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

  // Rear impact damage (Rear is +Z)
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

  // Left impact damage (Left is -X)
  if (dir.x < -0.2) {
    if (sideBarL) sideBarL.rotation.set(0.04 * severity, 0.02 * severity, -0.10 * severity);
    if (windowL && (windowL.material as THREE.MeshStandardMaterial)) {
      (windowL.material as THREE.MeshStandardMaterial).opacity = Math.max(0.2, 0.85 * (1 - severity * 0.6));
    }
  }

  // Right impact damage (Right is +X)
  if (dir.x > 0.2) {
    if (sideBarR) sideBarR.rotation.set(0.04 * severity, -0.02 * severity, 0.10 * severity);
    if (windowR && (windowR.material as THREE.MeshStandardMaterial)) {
      (windowR.material as THREE.MeshStandardMaterial).opacity = Math.max(0.2, 0.85 * (1 - severity * 0.6));
    }
  }

  // When WRECKED: deterministically calculate a 65% brightness tint from original baseline color
  if (level === 'WRECKED' && vehObj.originalMaterials) {
    for (const record of vehObj.originalMaterials) {
      const mesh = record.mesh;
      if (mesh && mesh.material) {
        const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
        if (mat && mat.color && record.originalColor) {
          mat.color.copy(record.originalColor).multiplyScalar(0.65);
          mat.roughness = Math.min(0.95, (record.originalRoughness ?? 0.35) + 0.35);
        }
      }
    }
  }
}

export function spawnImpactDebrisParts(
  impactX: number,
  impactY: number,
  impactZ: number,
  relSpeed: number,
  carColorHex: string
): DebrisPiece[] {
  const pieces: DebrisPiece[] = [];
  const count = Math.min(6, Math.max(2, Math.floor(relSpeed * 0.35)));

  for (let i = 0; i < count; i++) {
    const vx = (Math.random() - 0.5) * relSpeed * 0.6;
    const vy = 2.0 + Math.random() * relSpeed * 0.4;
    const vz = (Math.random() - 0.5) * relSpeed * 0.6;

    pieces.push({
      id: `debris_${Date.now()}_${Math.random()}`,
      x: impactX,
      y: impactY,
      z: impactZ,
      vx,
      vy,
      vz,
      rotX: Math.random() * Math.PI,
      rotY: Math.random() * Math.PI,
      rotZ: Math.random() * Math.PI,
      vRotX: (Math.random() - 0.5) * 12,
      vRotY: (Math.random() - 0.5) * 12,
      vRotZ: (Math.random() - 0.5) * 12,
      color: Math.random() > 0.5 ? carColorHex : '#334155',
      scale: 0.2 + Math.random() * 0.3,
      life: 0,
      maxLife: 2.5 + Math.random() * 1.5,
      type: 'shard',
    });
  }

  return pieces;
}
