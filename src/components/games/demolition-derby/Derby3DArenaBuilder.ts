import * as THREE from 'three';
import { ArenaDefinition, ArenaObstacle, ObstacleCollider } from './types';
import { ARENA_OBSTACLES } from './DerbyPhysicsEngine';

export interface Derby3DArena {
  sceneGroup: THREE.Group;
  terrainMesh: THREE.Mesh;
  skidMeshGroup: THREE.Group;
  spotlights: THREE.SpotLight[];
  obstacleMeshes: Map<string, THREE.Object3D>;
  colliders: ObstacleCollider[];
  debugGizmoGroup: THREE.Group;
}

// ── PROCEDURAL DIRT GROUND TEXTURE GENERATOR ──────────────
function createDirtGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Base dirt brown color
  ctx.fillStyle = '#3d2314';
  ctx.fillRect(0, 0, 1024, 1024);

  // Noise patches for mud and gravel
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = Math.random() * 14 + 2;
    const opacity = Math.random() * 0.2 + 0.05;
    const isDark = Math.random() > 0.35;
    ctx.fillStyle = isDark ? `rgba(20, 12, 8, ${opacity})` : `rgba(120, 70, 24, ${opacity})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pre-baked tire tracks in dirt surface
  ctx.strokeStyle = 'rgba(15, 8, 4, 0.3)';
  ctx.lineWidth = 14;
  for (let i = 0; i < 16; i++) {
    const cx = 512 + (Math.random() - 0.5) * 600;
    const cy = 512 + (Math.random() - 0.5) * 600;
    const rad = 140 + Math.random() * 320;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.needsUpdate = true;
  return texture;
}

// ── BUILD REALISTIC OUTDOOR DIRT ARENA STADIUM ────────────
export function build3DArena(arena: ArenaDefinition, scene: THREE.Scene): Derby3DArena {
  const sceneGroup = new THREE.Group();
  const obstacleMeshes = new Map<string, THREE.Object3D>();
  const spotlights: THREE.SpotLight[] = [];
  const colliders: ObstacleCollider[] = [];

  const debugGizmoGroup = new THREE.Group();
  debugGizmoGroup.name = 'debugGizmoGroup';
  debugGizmoGroup.visible = false;
  sceneGroup.add(debugGizmoGroup);

  const radius = arena.radius || 42;

  // 1. Dirt Terrain Mesh
  const terrainGeo = new THREE.PlaneGeometry(radius * 2.8, radius * 2.8, 64, 64);
  terrainGeo.rotateX(-Math.PI / 2);

  // Height displacement for subtle mounds
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const distSq = x * x + z * z;
    let y = (Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.35) + (Math.sin(x * 0.04) * 0.25);

    if (distSq > (radius * 0.88) * (radius * 0.88)) {
      y += (Math.sqrt(distSq) - radius * 0.88) * 0.3; // Outer incline slope
    }
    pos.setY(i, y);
  }
  terrainGeo.computeVertexNormals();

  const dirtTexture = createDirtGroundTexture();
  const dirtMat = new THREE.MeshStandardMaterial({
    map: dirtTexture,
    roughness: 0.9,
    metalness: 0.05,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, dirtMat);
  terrainMesh.receiveShadow = true;
  sceneGroup.add(terrainMesh);

  // Dynamic skid marks group
  const skidMeshGroup = new THREE.Group();
  sceneGroup.add(skidMeshGroup);

  // 2. Sky Dome & Distant Mountain Ring
  const skyGeo = new THREE.SphereGeometry(220, 32, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(arena.skyColor || '#1e293b'),
    side: THREE.BackSide,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  sceneGroup.add(skyMesh);

  const mountainGeo = new THREE.CylinderGeometry(180, 195, 55, 32, 1, true);
  const mountainMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1e293b'),
    roughness: 0.95,
    side: THREE.BackSide,
  });
  const mountainMesh = new THREE.Mesh(mountainGeo, mountainMat);
  mountainMesh.position.y = 20;
  sceneGroup.add(mountainMesh);

  // 3. Low-Profile Perimeter Barriers (Concrete K-Rails & Tire Wall Ring)
  const barrierGroup = new THREE.Group();
  const wallSegments = 32;
  const segmentWidth = ((2 * Math.PI * radius) / wallSegments) + 0.1; // Seamless perimeter span without gaps

  const concreteMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.85 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.5 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.95 });

  for (let i = 0; i < wallSegments; i++) {
    const angle = (i / wallSegments) * Math.PI * 2;
    const bx = Math.sin(angle) * radius;
    const bz = Math.cos(angle) * radius;
    const wallRot = angle + Math.PI / 2;

    // Concrete K-Rail Barrier (Low height ~1.2m)
    const blockGeo = new THREE.BoxGeometry(segmentWidth, 1.2, 0.8);
    const blockMesh = new THREE.Mesh(blockGeo, concreteMat);
    blockMesh.position.set(bx, 0.6, bz);
    blockMesh.rotation.y = wallRot;
    blockMesh.castShadow = true;
    blockMesh.receiveShadow = true;
    barrierGroup.add(blockMesh);

    // Hazard Stripes
    const stripeGeo = new THREE.BoxGeometry(segmentWidth + 0.05, 0.35, 0.85);
    const stripeMesh = new THREE.Mesh(stripeGeo, yellowMat);
    stripeMesh.position.set(bx, 0.6, bz);
    stripeMesh.rotation.y = wallRot;
    barrierGroup.add(stripeMesh);

    // Register Static Wall Collider for Barrier Segment
    colliders.push({
      id: `wall_${i}`,
      type: 'box',
      x: bx,
      y: 0.6,
      z: bz,
      halfWidth: segmentWidth / 2,
      halfLength: 0.4,
      halfHeight: 0.6,
      rotation: wallRot,
    });

    // Wireframe Debug Gizmo for Wall
    const wireGeo = new THREE.WireframeGeometry(blockGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0xef4444 });
    const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
    wireMesh.position.set(bx, 0.6, bz);
    wireMesh.rotation.y = wallRot;
    debugGizmoGroup.add(wireMesh);

    // Stacked Tire Wall behind K-Rail
    for (let t = 0; t < 2; t++) {
      const tireGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12);
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      const offsetR = radius + 1.2;
      tireMesh.position.set(Math.sin(angle) * offsetR, 0.25 + t * 0.48, Math.cos(angle) * offsetR);
      tireMesh.castShadow = true;
      barrierGroup.add(tireMesh);
    }
  }
  sceneGroup.add(barrierGroup);

  // 4. Stadium Floodlight Towers (4 Corners - positioned safely inside playable stadium turf)
  const towerPositions = [
    { x: -radius * 0.5, z: -radius * 0.5 },
    { x: radius * 0.5, z: -radius * 0.5 },
    { x: -radius * 0.5, z: radius * 0.5 },
    { x: radius * 0.5, z: radius * 0.5 },
  ];

  towerPositions.forEach((pos, idx) => {
    const towerGroup = new THREE.Group();
    towerGroup.position.set(pos.x, 0, pos.z);

    const poleGeo = new THREE.CylinderGeometry(0.5, 0.85, 26, 8);
    const steelMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.3 });
    const poleMesh = new THREE.Mesh(poleGeo, steelMat);
    poleMesh.position.y = 13;
    poleMesh.castShadow = true;
    towerGroup.add(poleMesh);

    const headGeo = new THREE.BoxGeometry(4.5, 2.8, 1.6);
    const headMesh = new THREE.Mesh(headGeo, steelMat);
    headMesh.position.set(0, 25.5, 0);
    headMesh.lookAt(0, 0, 0);
    towerGroup.add(headMesh);

    const spot = new THREE.SpotLight(0xfffbeb, 3.8);
    spot.position.set(pos.x, 25.5, pos.z);
    spot.target.position.set(0, 0, 0);
    spot.angle = Math.PI / 4;
    spot.penumbra = 0.5;
    spot.castShadow = idx === 0;
    if (spot.castShadow) {
      spot.shadow.mapSize.width = 1024;
      spot.shadow.mapSize.height = 1024;
    }
    sceneGroup.add(spot);
    sceneGroup.add(spot.target);
    spotlights.push(spot);

    sceneGroup.add(towerGroup);

    // Register Static Pillar Cylinder Collider matching exact visual pole geometry (radius 0.85m)
    colliders.push({
      id: `tower_pillar_${idx}`,
      type: 'cylinder',
      x: pos.x,
      y: 13,
      z: pos.z,
      radius: 0.85,
      halfHeight: 13,
    });

    // Wireframe Debug Gizmo for Pillar
    const pWireGeo = new THREE.WireframeGeometry(poleGeo);
    const pWireMat = new THREE.LineBasicMaterial({ color: 0x06b6d4 });
    const pWireMesh = new THREE.LineSegments(pWireGeo, pWireMat);
    pWireMesh.position.set(pos.x, 13, pos.z);
    debugGizmoGroup.add(pWireMesh);
  });

  // 5. Spectator Grandstands Ring & Instanced Crowd
  const standsGeo = new THREE.CylinderGeometry(radius * 1.05, radius * 1.38, 11, 48, 4, true);
  const standsMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1e293b'),
    roughness: 0.75,
    side: THREE.DoubleSide,
  });
  const standsMesh = new THREE.Mesh(standsGeo, standsMat);
  standsMesh.position.y = 5.5;
  sceneGroup.add(standsMesh);

  // Instanced Crowd Figures
  const crowdCount = 200;
  const crowdGeo = new THREE.BoxGeometry(0.5, 0.9, 0.5);
  const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
  const crowdInstanced = new THREE.InstancedMesh(crowdGeo, crowdMat, crowdCount);

  const dummy = new THREE.Object3D();
  const crowdColors = ['#ef4444', '#3b82f6', '#eab308', '#10b981', '#ec4899', '#f97316'];

  for (let i = 0; i < crowdCount; i++) {
    const angle = (i / crowdCount) * Math.PI * 2;
    const r = radius * 1.12 + Math.random() * (radius * 0.2);
    const heightStep = 3.8 + (r - radius) * 0.85;

    dummy.position.set(Math.sin(angle) * r, heightStep, Math.cos(angle) * r);
    dummy.rotation.y = angle + Math.PI;
    dummy.scale.set(0.9, 0.8 + Math.random() * 0.4, 0.9);
    dummy.updateMatrix();

    crowdInstanced.setMatrixAt(i, dummy.matrix);
    crowdInstanced.setColorAt(i, new THREE.Color(crowdColors[i % crowdColors.length]));
  }
  crowdInstanced.instanceMatrix.needsUpdate = true;
  if (crowdInstanced.instanceColor) crowdInstanced.instanceColor.needsUpdate = true;
  sceneGroup.add(crowdInstanced);

  // 6. Arena Physical Props & Static Colliders
  if (arena.hasObstacles) {
    ARENA_OBSTACLES.forEach((ob) => {
      const propGroup = create3DObstacleObject(ob);
      propGroup.position.set(ob.x, 0, ob.z);

      if (ob.rotation) {
        propGroup.rotation.y = ob.rotation;
      }

      sceneGroup.add(propGroup);
      obstacleMeshes.set(ob.id, propGroup);

      // Register Static Obstacle Collider
      const obstacleCollider = createObstacleColliderDef(ob);
      colliders.push(obstacleCollider);

      // Wireframe Debug Gizmo for Obstacle
      const debugGizmo = createObstacleDebugGizmo(obstacleCollider);
      if (debugGizmo) {
        debugGizmoGroup.add(debugGizmo);
      }
    });
  }

  scene.add(sceneGroup);

  return {
    sceneGroup,
    terrainMesh,
    skidMeshGroup,
    spotlights,
    obstacleMeshes,
    colliders,
    debugGizmoGroup,
  };
}

// ── CREATE OBSTACLE COLLIDER DATA ─────────────────────────
function createObstacleColliderDef(ob: ArenaObstacle): ObstacleCollider {
  const rot = ob.rotation || 0;

  if (ob.type === 'ramp') {
    return {
      id: ob.id,
      type: 'ramp',
      x: ob.x,
      y: (ob.height || 2.2) / 2,
      z: ob.z,
      halfWidth: (ob.width || 8.5) / 2,
      halfLength: (ob.length || 7.0) / 2,
      halfHeight: (ob.height || 2.2) / 2,
      rampHeight: ob.height || 2.2,
      rotation: rot,
    };
  } else if (ob.type === 'concrete_block') {
    return {
      id: ob.id,
      type: 'box',
      x: ob.x,
      y: 0.6,
      z: ob.z,
      halfWidth: (ob.width || 2.4) / 2,
      halfLength: (ob.length || 1.2) / 2,
      halfHeight: 0.6,
      rotation: rot,
    };
  } else if (ob.type === 'tire_stack') {
    return {
      id: ob.id,
      type: 'cylinder',
      x: ob.x,
      y: 0.9,
      z: ob.z,
      radius: ob.radius ? ob.radius * 0.95 : 1.6,
      halfHeight: 0.9,
    };
  } else if (ob.type === 'metal_barrel') {
    return {
      id: ob.id,
      type: 'cylinder',
      x: ob.x,
      y: 0.65,
      z: ob.z,
      radius: ob.radius || 0.9,
      halfHeight: 0.65,
    };
  } else {
    // Scrap wreck or dirt mound
    return {
      id: ob.id,
      type: 'cylinder',
      x: ob.x,
      y: 1.0,
      z: ob.z,
      radius: ob.radius || 2.5,
      halfHeight: 1.0,
    };
  }
}

// ── CREATE OBSTACLE DEBUG WIREFRAME GIZMO ─────────────────
function createObstacleDebugGizmo(col: ObstacleCollider): THREE.Object3D | null {
  const wireMat = new THREE.LineBasicMaterial({ color: 0xeab308 });

  if (col.type === 'cylinder') {
    const geo = new THREE.WireframeGeometry(new THREE.CylinderGeometry(col.radius, col.radius, (col.halfHeight || 1) * 2, 12));
    const mesh = new THREE.LineSegments(geo, wireMat);
    mesh.position.set(col.x, col.y, col.z);
    return mesh;
  } else if (col.type === 'box' || col.type === 'ramp') {
    const geo = new THREE.WireframeGeometry(new THREE.BoxGeometry((col.halfWidth || 1) * 2, (col.halfHeight || 1) * 2, (col.halfLength || 1) * 2));
    const mesh = new THREE.LineSegments(geo, wireMat);
    mesh.position.set(col.x, col.y, col.z);
    if (col.rotation) mesh.rotation.y = col.rotation;
    return mesh;
  }
  return null;
}

// ── BUILD 3D OBSTACLE PROPS ───────────────────────────────
function create3DObstacleObject(ob: ArenaObstacle): THREE.Group {
  const group = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.4, metalness: 0.8 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.9, metalness: 0.1 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.5 });
  const redBarrelMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.3, metalness: 0.5 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.95 });

  if (ob.type === 'ramp') {
    const rWidth = ob.width || 8.5;
    const rLength = ob.length || 7.0;
    const rHeight = ob.height || 2.2;

    const rampGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -rWidth / 2, 0, rLength / 2,
       rWidth / 2, 0, rLength / 2,
      -rWidth / 2, rHeight, -rLength / 2,

       rWidth / 2, 0, rLength / 2,
       rWidth / 2, rHeight, -rLength / 2,
      -rWidth / 2, rHeight, -rLength / 2,

      -rWidth / 2, 0, -rLength / 2,
      -rWidth / 2, rHeight, -rLength / 2,
       rWidth / 2, 0, -rLength / 2,

       rWidth / 2, 0, -rLength / 2,
      -rWidth / 2, rHeight, -rLength / 2,
       rWidth / 2, rHeight, -rLength / 2,
    ]);

    rampGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    rampGeo.computeVertexNormals();

    const rampMesh = new THREE.Mesh(rampGeo, yellowMat);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    group.add(rampMesh);

    const railGeo = new THREE.BoxGeometry(0.2, rHeight * 0.8, rLength);
    const railL = new THREE.Mesh(railGeo, steelMat);
    railL.position.set(-rWidth / 2, rHeight * 0.4, 0);
    railL.rotation.x = -Math.atan2(rHeight, rLength);
    group.add(railL);

    const railR = new THREE.Mesh(railGeo, steelMat);
    railR.position.set(rWidth / 2, rHeight * 0.4, 0);
    railR.rotation.x = -Math.atan2(rHeight, rLength);
    group.add(railR);
  } else if (ob.type === 'concrete_block') {
    const blockGeo = new THREE.BoxGeometry(ob.width || 2.4, 1.2, ob.length || 1.2);
    const blockMesh = new THREE.Mesh(blockGeo, concreteMat);
    blockMesh.position.y = 0.6;
    blockMesh.castShadow = true;
    blockMesh.receiveShadow = true;
    group.add(blockMesh);

    const stripeGeo = new THREE.BoxGeometry((ob.width || 2.4) + 0.05, 0.4, (ob.length || 1.2) + 0.05);
    const stripeMesh = new THREE.Mesh(stripeGeo, yellowMat);
    stripeMesh.position.y = 0.6;
    group.add(stripeMesh);
  } else if (ob.type === 'tire_stack') {
    for (let y = 0; y < 3; y++) {
      const tireGeo = new THREE.CylinderGeometry((ob.radius || 1.6) * 0.8, (ob.radius || 1.6) * 0.8, 0.6, 16);
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      tireMesh.position.set((Math.random() - 0.5) * 0.2, 0.3 + y * 0.55, (Math.random() - 0.5) * 0.2);
      tireMesh.castShadow = true;
      group.add(tireMesh);
    }
  } else if (ob.type === 'metal_barrel') {
    for (let i = 0; i < 3; i++) {
      const barrelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.3, 16);
      const barrelMesh = new THREE.Mesh(barrelGeo, redBarrelMat);
      const bx = (i - 1) * 0.7;
      barrelMesh.position.set(bx, 0.65, 0);
      barrelMesh.castShadow = true;
      group.add(barrelMesh);
    }
  } else if (ob.type === 'scrap_wreck' || ob.type === 'mound') {
    const moundGeo = new THREE.SphereGeometry(ob.radius || 3.0, 16, 8);
    moundGeo.scale(1, 0.4, 1);
    const moundMesh = new THREE.Mesh(moundGeo, concreteMat);
    moundMesh.castShadow = true;
    moundMesh.receiveShadow = true;
    group.add(moundMesh);
  }

  return group;
}
