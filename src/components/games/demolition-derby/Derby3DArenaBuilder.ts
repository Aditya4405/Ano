import * as THREE from 'three';
import { ArenaDefinition, ArenaObstacle, ObstacleCollider } from './types';
import { ARENA_OBSTACLES, getArenaObstacles } from './DerbyPhysicsEngine';

export interface Derby3DArena {
  sceneGroup: THREE.Group;
  terrainMesh: THREE.Mesh;
  skidMeshGroup: THREE.Group;
  spotlights: THREE.SpotLight[];
  obstacleMeshes: Map<string, THREE.Object3D>;
  colliders: ObstacleCollider[];
  debugGizmoGroup: THREE.Group;
}

// ── PROCEDURAL 7-ARENA MULTI-LAYER GROUND CANVAS TEXTURES ─────────────
function createArenaGroundTexture(arena: ArenaDefinition): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d')!;

  switch (arena.id) {
    case 'arena_2': {
      // Arena 2: Industrial Yard (Dark cracked asphalt, yellow parking lane lines, drainage grates, grease slicks)
      ctx.fillStyle = '#1e2229';
      ctx.fillRect(0, 0, 2048, 2048);
      // Concrete slab seams
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 6;
      for (let x = 0; x <= 2048; x += 256) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 2048); ctx.stroke();
      }
      for (let y = 0; y <= 2048; y += 256) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2048, y); ctx.stroke();
      }
      // Yellow warehouse safety stripes
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 14;
      ctx.setLineDash([40, 30]);
      ctx.beginPath(); ctx.ellipse(1024, 1024, 750, 520, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Oil spills
      for (let i = 0; i < 15; i++) {
        ctx.fillStyle = 'rgba(10, 10, 15, 0.65)';
        ctx.beginPath();
        ctx.arc(400 + Math.random() * 1248, 400 + Math.random() * 1248, 40 + Math.random() * 90, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'arena_3': {
      // Arena 3: Desert Derby (Sunbaked orange-red sand dunes, dust ruts, sandstone speckles)
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(0, 0, 2048, 2048);
      for (let i = 0; i < 9000; i++) {
        const x = Math.random() * 2048;
        const y = Math.random() * 2048;
        const r = Math.random() * 32 + 6;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(161, 98, 7, 0.28)' : 'rgba(113, 63, 18, 0.25)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // Sand dune wind ripples
      ctx.strokeStyle = 'rgba(202, 138, 4, 0.25)';
      ctx.lineWidth = 8;
      for (let y = 50; y < 2048; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= 2048; x += 128) {
          ctx.lineTo(x, y + Math.sin(x * 0.02) * 20);
        }
        ctx.stroke();
      }
      break;
    }
    case 'arena_4': {
      // Arena 4: Construction Zone (Crushed aggregate gravel, trench tire treads, hazard yellow borders)
      ctx.fillStyle = '#374151';
      ctx.fillRect(0, 0, 2048, 2048);
      for (let i = 0; i < 12000; i++) {
        const x = Math.random() * 2048;
        const y = Math.random() * 2048;
        const r = Math.random() * 6 + 1;
        ctx.fillStyle = Math.random() > 0.5 ? '#1f2937' : '#6b7280';
        ctx.fillRect(x, y, r, r);
      }
      // Heavy bulldozer tread tracks
      ctx.strokeStyle = 'rgba(17, 24, 39, 0.55)';
      ctx.lineWidth = 42;
      for (let i = 0; i < 16; i++) {
        const radX = 620 + (Math.random() - 0.5) * 200;
        const radY = 460 + (Math.random() - 0.5) * 150;
        ctx.beginPath(); ctx.ellipse(1024, 1024, radX, radY, 0, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case 'arena_5': {
      // Arena 5: Night Stadium (Ultra dark oiled asphalt, bright white competition lane lines, neon accents)
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, 2048, 2048);
      // Bright track borders
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.ellipse(1024, 1024, 780, 560, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.ellipse(1024, 1024, 740, 520, 0, 0, Math.PI * 2); ctx.stroke();
      // Burnout smoke rings
      for (let i = 0; i < 20; i++) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.arc(600 + Math.random() * 848, 600 + Math.random() * 848, 120 + Math.random() * 120, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'arena_6': {
      // Arena 6: Frozen Arena (Translucent ice sheet with frost veins, cracked glaciers, snow drifts)
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(0, 0, 2048, 2048);
      // Frost crack lines
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.65)';
      ctx.lineWidth = 4;
      for (let i = 0; i < 40; i++) {
        let cx = Math.random() * 2048;
        let cy = Math.random() * 2048;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (let seg = 0; seg < 6; seg++) {
          cx += (Math.random() - 0.5) * 160;
          cy += (Math.random() - 0.5) * 160;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
      // Snow patches
      for (let i = 0; i < 5000; i++) {
        const x = Math.random() * 2048;
        const y = Math.random() * 2048;
        const r = Math.random() * 24 + 4;
        ctx.fillStyle = `rgba(240, 249, 255, ${Math.random() * 0.35 + 0.1})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'arena_7': {
      // Arena 7: Industrial Death Ring (Metal diamond steel plate floor with glowing heat grates)
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 2048, 2048);
      // Steel diamond pattern
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 3;
      for (let d = -2048; d <= 4096; d += 64) {
        ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + 2048, 2048); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(d, 2048); ctx.lineTo(d + 2048, 0); ctx.stroke();
      }
      // Glowing molten grates
      ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.beginPath(); ctx.arc(1024, 1024, 280, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.65)';
      ctx.beginPath(); ctx.arc(1024, 1024, 160, 0, Math.PI * 2); ctx.fill();
      break;
    }
    default: {
      // Arena 1: Junkyard packed loam dirt
      ctx.fillStyle = '#2b180d';
      ctx.fillRect(0, 0, 2048, 2048);
      for (let i = 0; i < 8000; i++) {
        const x = Math.random() * 2048;
        const y = Math.random() * 2048;
        const r = Math.random() * 28 + 4;
        ctx.fillStyle = Math.random() > 0.4 ? 'rgba(18, 10, 6, 0.15)' : 'rgba(74, 42, 22, 0.15)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.lineWidth = 32;
      ctx.strokeStyle = 'rgba(12, 6, 4, 0.45)';
      for (let i = 0; i < 20; i++) {
        const rx = 650 + (Math.random() - 0.5) * 160;
        const ry = 480 + (Math.random() - 0.5) * 120;
        ctx.beginPath(); ctx.ellipse(1024, 1024, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

// ── PROCEDURAL BANNER / JUMBOTRON GRAPHICS TEXTURE ─────────────────────────
function createScoreboardTexture(arena: ArenaDefinition): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, 1024, 256);

  // Border Frame
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 1012, 244);

  // Title Banner
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 50px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`ANO DEMOLITION DERBY`, 512, 70);

  // Subtitle
  ctx.fillStyle = '#ef4444';
  ctx.font = 'black 32px Arial, sans-serif';
  ctx.fillText(`${arena.name.toUpperCase()} • LIVE BRAWL`, 512, 125);

  // Status Bar
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillText('NO RULES  •  FULL DESTRUCTION  •  STANDINGS ACTIVE', 512, 185);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createHazardStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = '#09090b';
  const stripeWidth = 24;
  for (let x = -64; x < 320; x += stripeWidth * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeWidth, 0);
    ctx.lineTo(x + stripeWidth - 32, 64);
    ctx.lineTo(x - 32, 64);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  texture.needsUpdate = true;
  return texture;
}

// ── BUILD REALISTIC AAA DEMOLITION DERBY STADIUM ───────────────────────────
export function build3DArena(arena: ArenaDefinition, scene: THREE.Scene): Derby3DArena {
  const sceneGroup = new THREE.Group();
  const obstacleMeshes = new Map<string, THREE.Object3D>();
  const spotlights: THREE.SpotLight[] = [];
  const colliders: ObstacleCollider[] = [];

  const debugGizmoGroup = new THREE.Group();
  debugGizmoGroup.name = 'debugGizmoGroup';
  debugGizmoGroup.visible = false;
  sceneGroup.add(debugGizmoGroup);

  // Stadium Dimensions: Oval footprint (~88m x 64m)
  const scale = (arena.radius || 42) / 42;
  const halfA = 44 * scale; // Major axis X (Length)
  const halfB = 32 * scale; // Minor axis Z (Width)

  // 1. Layered Arena Terrain Floor with Theme Texture
  const terrainGeo = new THREE.PlaneGeometry(halfA * 3.0, halfB * 3.0, 64, 64);
  terrainGeo.rotateX(-Math.PI / 2);

  // Subtle bank displacement around outer rim
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const normDistSq = (x / halfA) * (x / halfA) + (z / halfB) * (z / halfB);

    let y = (Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.25) + (Math.sin(x * 0.03) * 0.15);
    if (normDistSq > 0.85) {
      y += (Math.sqrt(normDistSq) - 0.85) * 3.2; // Banking incline slope outside barrier
    }
    pos.setY(i, y);
  }
  terrainGeo.computeVertexNormals();

  const arenaGroundTexture = createArenaGroundTexture(arena);
  const terrainMat = new THREE.MeshStandardMaterial({
    map: arenaGroundTexture,
    roughness: arena.id === 'arena_6' ? 0.25 : arena.id === 'arena_7' ? 0.55 : 0.92,
    metalness: arena.id === 'arena_7' ? 0.75 : arena.id === 'arena_6' ? 0.15 : 0.04,
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  sceneGroup.add(terrainMesh);

  // Dynamic skid marks group
  const skidMeshGroup = new THREE.Group();
  sceneGroup.add(skidMeshGroup);

  // 2. Sky Dome & Distant Industrial Arena Walls
  const skyGeo = new THREE.SphereGeometry(260, 32, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(arena.skyColor || '#0a0a0f'),
    side: THREE.BackSide,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  sceneGroup.add(skyMesh);

  // 3. Modular Heavy Concrete Jersey Barrier (K-Rail) Perimeter with Catch Fencing
  const barrierGroup = new THREE.Group();
  const wallSegments = 48;
  const hazardTex = createHazardStripeTexture();

  const concreteMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.88, metalness: 0.1 });
  const concreteDarkMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.92, metalness: 0.05 });
  const steelMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.35, metalness: 0.85 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5 });
  const fenceWireMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.4, metalness: 0.7, wireframe: true });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.95 });

  for (let i = 0; i < wallSegments; i++) {
    const theta = (i / wallSegments) * Math.PI * 2;
    const nextTheta = ((i + 1) / wallSegments) * Math.PI * 2;

    const x1 = Math.sin(theta) * halfA;
    const z1 = Math.cos(theta) * halfB;
    const x2 = Math.sin(nextTheta) * halfA;
    const z2 = Math.cos(nextTheta) * halfB;

    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    const segLength = Math.hypot(x2 - x1, z2 - z1) + 0.15; // Seamless overlap
    const wallAngle = Math.atan2(x2 - x1, z2 - z1);

    // Modular Chamfered Concrete Barrier Block (Base 0.9m, Top 0.5m, Height 1.3m)
    const blockGroup = new THREE.Group();
    blockGroup.position.set(midX, 0.65, midZ);
    blockGroup.rotation.y = wallAngle;

    // Lower Wide Footing
    const baseGeo = new THREE.BoxGeometry(0.85, 0.5, segLength);
    const baseMesh = new THREE.Mesh(baseGeo, concreteDarkMat);
    baseMesh.position.y = -0.4;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    blockGroup.add(baseMesh);

    // Upper Tapered Wall
    const topGeo = new THREE.BoxGeometry(0.55, 0.8, segLength);
    const topMesh = new THREE.Mesh(topGeo, i % 3 === 0 ? hazardMat : concreteMat);
    topMesh.position.y = 0.25;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    blockGroup.add(topMesh);

    // Steel Catch-Fence Post behind barrier (Height 4.0m)
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.8, 8);
    const postMesh = new THREE.Mesh(postGeo, steelMat);
    postMesh.position.set(0.45, 1.4, 0);
    postMesh.castShadow = true;
    blockGroup.add(postMesh);

    // Steel Debris Catch Mesh Screen
    const fenceGeo = new THREE.PlaneGeometry(segLength, 2.6);
    const fenceMesh = new THREE.Mesh(fenceGeo, fenceWireMat);
    fenceMesh.position.set(0.45, 2.0, 0);
    fenceMesh.rotation.y = Math.PI / 2;
    blockGroup.add(fenceMesh);

    // Warning Sign Plate on selected fence sections
    if (i % 6 === 0) {
      const signGeo = new THREE.PlaneGeometry(1.6, 0.8);
      const signMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(0.43, 2.2, 0);
      signMesh.rotation.y = Math.PI / 2;
      blockGroup.add(signMesh);
    }

    barrierGroup.add(blockGroup);

    // Register Box Collider for Physical Barrier Segment
    colliders.push({
      id: `perimeter_wall_${i}`,
      type: 'box',
      x: midX,
      y: 0.65,
      z: midZ,
      halfWidth: 0.5,
      halfLength: segLength / 2,
      halfHeight: 0.65,
      rotation: wallAngle,
    });

    // Wireframe Debug Gizmo for Barrier
    const wireGeo = new THREE.WireframeGeometry(new THREE.BoxGeometry(1.0, 1.3, segLength));
    const wireMat = new THREE.LineBasicMaterial({ color: 0xef4444 });
    const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
    wireMesh.position.set(midX, 0.65, midZ);
    wireMesh.rotation.y = wallAngle;
    debugGizmoGroup.add(wireMesh);
  }
  sceneGroup.add(barrierGroup);

  // 4. Multi-Tiered Stadium Grandstands with Low-Poly Crowd Silhouettes
  const standsGroup = new THREE.Group();
  const tiers = 5;
  const grandstandSegments = 36;

  for (let t = 0; t < tiers; t++) {
    const tierR_A = halfA + 3.5 + t * 2.8;
    const tierR_B = halfB + 3.5 + t * 2.8;
    const tierY = 1.0 + t * 1.5;

    for (let s = 0; s < grandstandSegments; s++) {
      const theta = (s / grandstandSegments) * Math.PI * 2;
      const nextTheta = ((s + 1) / grandstandSegments) * Math.PI * 2;

      const sx1 = Math.sin(theta) * tierR_A;
      const sz1 = Math.cos(theta) * tierR_B;
      const sx2 = Math.sin(nextTheta) * tierR_A;
      const sz2 = Math.cos(nextTheta) * tierR_B;

      const smidX = (sx1 + sx2) / 2;
      const smidZ = (sz1 + sz2) / 2;
      const sLength = Math.hypot(sx2 - sx1, sz2 - sz1) + 0.1;
      const sAngle = Math.atan2(sx2 - sx1, sz2 - sz1);

      // Grandstand Step Tier Bench
      const stepGeo = new THREE.BoxGeometry(2.4, 0.6, sLength);
      const stepMat = new THREE.MeshStandardMaterial({ color: t % 2 === 0 ? '#1e293b' : '#334155', roughness: 0.8 });
      const stepMesh = new THREE.Mesh(stepGeo, stepMat);
      stepMesh.position.set(smidX, tierY, smidZ);
      stepMesh.rotation.y = sAngle;
      stepMesh.receiveShadow = true;
      standsGroup.add(stepMesh);
    }
  }

  // Instanced Spectator Silhouettes (400 cheering fans)
  const crowdCount = 380;
  const crowdGeo = new THREE.BoxGeometry(0.45, 0.95, 0.45);
  const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const crowdInstanced = new THREE.InstancedMesh(crowdGeo, crowdMat, crowdCount);

  const crowdColors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#f97316', '#e2e8f0', '#8b5cf6'];
  const dummy = new THREE.Object3D();

  for (let i = 0; i < crowdCount; i++) {
    const theta = (i / crowdCount) * Math.PI * 2;
    const tierIdx = Math.floor(Math.random() * tiers);
    const rA = halfA + 3.8 + tierIdx * 2.8;
    const rB = halfB + 3.8 + tierIdx * 2.8;
    const yPos = 1.75 + tierIdx * 1.5;

    const jitter = (Math.random() - 0.5) * 0.8;
    const px = Math.sin(theta) * (rA + jitter);
    const pz = Math.cos(theta) * (rB + jitter);

    dummy.position.set(px, yPos, pz);
    dummy.lookAt(0, 0, 0); // Face arena center
    dummy.scale.set(0.9 + Math.random() * 0.2, 0.85 + Math.random() * 0.35, 0.9);
    dummy.updateMatrix();

    crowdInstanced.setMatrixAt(i, dummy.matrix);
    crowdInstanced.setColorAt(i, new THREE.Color(crowdColors[i % crowdColors.length]));
  }
  crowdInstanced.instanceMatrix.needsUpdate = true;
  if (crowdInstanced.instanceColor) crowdInstanced.instanceColor.needsUpdate = true;
  standsGroup.add(crowdInstanced);

  sceneGroup.add(standsGroup);

  // 5. Overhead Industrial Steel Lattice Trusses & Stadium Catwalks
  const trussGroup = new THREE.Group();
  const trussMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.85 });

  // 4 Giant Structural Corner Columns
  const columnPositions = [
    { x: -halfA * 0.9, z: -halfB * 0.9 },
    { x: halfA * 0.9, z: -halfB * 0.9 },
    { x: -halfA * 0.9, z: halfB * 0.9 },
    { x: halfA * 0.9, z: halfB * 0.9 },
  ];

  columnPositions.forEach((cp, idx) => {
    const colGeo = new THREE.CylinderGeometry(1.2, 1.8, 38, 8);
    const colMesh = new THREE.Mesh(colGeo, trussMat);
    colMesh.position.set(cp.x, 19, cp.z);
    colMesh.castShadow = true;
    trussGroup.add(colMesh);
  });

  // 3 Overhead Steel Arch Girders
  for (let g = -1; g <= 1; g++) {
    const archZ = g * 20;
    const girderGeo = new THREE.BoxGeometry(halfA * 1.85, 1.4, 1.4);
    const girderMesh = new THREE.Mesh(girderGeo, trussMat);
    girderMesh.position.set(0, 32, archZ);
    trussGroup.add(girderMesh);

    // Cross brace diagonals
    const braceGeo = new THREE.BoxGeometry(halfA * 0.9, 0.6, 0.6);
    const brace1 = new THREE.Mesh(braceGeo, trussMat);
    brace1.position.set(-halfA * 0.45, 27, archZ);
    brace1.rotation.z = -Math.PI / 6;
    trussGroup.add(brace1);

    const brace2 = new THREE.Mesh(braceGeo, trussMat);
    brace2.position.set(halfA * 0.45, 27, archZ);
    brace2.rotation.z = Math.PI / 6;
    trussGroup.add(brace2);
  }

  // 6. Suspended Jumbotron LED Scoreboard (Overhead Center)
  const scoreboardGroup = new THREE.Group();
  scoreboardGroup.position.set(0, 26, 0);

  const jumbotronTex = createScoreboardTexture(arena);
  const jumbotronMat = new THREE.MeshBasicMaterial({ map: jumbotronTex });
  const jumbotronFrameMat = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.3, metalness: 0.8 });

  // 4-Sided Jumbotron Display Cube
  const screenBoxGeo = new THREE.BoxGeometry(16, 4.2, 10);
  const frameMesh = new THREE.Mesh(screenBoxGeo, jumbotronFrameMat);
  scoreboardGroup.add(frameMesh);

  // Front Screen (Facing South)
  const screenGeo = new THREE.PlaneGeometry(15.4, 3.8);
  const screenFront = new THREE.Mesh(screenGeo, jumbotronMat);
  screenFront.position.set(0, 0, 5.02);
  scoreboardGroup.add(screenFront);

  // Rear Screen (Facing North)
  const screenRear = new THREE.Mesh(screenGeo, jumbotronMat);
  screenRear.position.set(0, 0, -5.02);
  screenRear.rotation.y = Math.PI;
  scoreboardGroup.add(screenRear);

  // Support Suspension Cables
  const cableMat = new THREE.LineBasicMaterial({ color: 0x64748b });
  for (const corner of [{ x: -7, z: -4 }, { x: 7, z: -4 }, { x: -7, z: 4 }, { x: 7, z: 4 }]) {
    const cableGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(corner.x, 2, corner.z),
      new THREE.Vector3(corner.x * 0.8, 6, corner.z * 0.8),
    ]);
    const cableLine = new THREE.Line(cableGeo, cableMat);
    scoreboardGroup.add(cableLine);
  }

  trussGroup.add(scoreboardGroup);
  sceneGroup.add(trussGroup);

  // 7. Stadium Floodlight Towers (4 High-Intensity Floodlight Hubs)
  const floodlightPositions = [
    { x: -halfA * 0.75, z: -halfB * 0.75 },
    { x: halfA * 0.75, z: -halfB * 0.75 },
    { x: -halfA * 0.75, z: halfB * 0.75 },
    { x: halfA * 0.75, z: halfB * 0.75 },
  ];

  const floodlightColor =
    arena.id === 'arena_5' ? 0xf8fafc :
    arena.id === 'arena_7' ? 0xf97316 :
    arena.id === 'arena_6' ? 0xe0f2fe :
    arena.id === 'arena_3' ? 0xfef08a :
    arena.id === 'arena_2' ? 0xf59e0b :
    arena.id === 'arena_4' ? 0xfbbf24 : 0xfff7ed;

  const floodlightIntensity =
    arena.id === 'arena_5' ? 5.5 :
    arena.id === 'arena_7' ? 4.8 : 4.2;

  floodlightPositions.forEach((flPos, idx) => {
    const flGroup = new THREE.Group();
    flGroup.position.set(flPos.x, 0, flPos.z);

    const towerPoleGeo = new THREE.CylinderGeometry(0.6, 1.1, 30, 8);
    const towerPoleMesh = new THREE.Mesh(towerPoleGeo, steelMat);
    towerPoleMesh.position.y = 15;
    towerPoleMesh.castShadow = true;
    flGroup.add(towerPoleMesh);

    const headGeo = new THREE.BoxGeometry(5.5, 3.2, 1.8);
    const headMesh = new THREE.Mesh(headGeo, steelMat);
    headMesh.position.set(0, 29.5, 0);
    headMesh.lookAt(0, 0, 0);
    flGroup.add(headMesh);

    // Multi-Lamp Floodlight Bank (3x2 warm halogen bulbs)
    for (let lx = -1.8; lx <= 1.8; lx += 1.8) {
      for (let ly = -0.8; ly <= 0.8; ly += 1.6) {
        const bulbGeo = new THREE.SphereGeometry(0.4, 8, 8);
        const bulbMat = new THREE.MeshBasicMaterial({ color: floodlightColor });
        const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
        bulbMesh.position.set(lx, 29.5 + ly, 0.9);
        flGroup.add(bulbMesh);
      }
    }

    const spot = new THREE.SpotLight(floodlightColor, floodlightIntensity);
    spot.position.set(flPos.x, 29.5, flPos.z);
    spot.target.position.set(0, 0, 0);
    spot.angle = Math.PI / 3.5;
    spot.penumbra = 0.55;
    spot.castShadow = idx === 0;
    if (spot.castShadow) {
      spot.shadow.mapSize.width = 1024;
      spot.shadow.mapSize.height = 1024;
    }
    sceneGroup.add(spot);
    sceneGroup.add(spot.target);
    spotlights.push(spot);

    sceneGroup.add(flGroup);
  });

  // 8. Arena Physical Props & Tactical Combat Obstacles
  if (arena.hasObstacles) {
    const obstacles = getArenaObstacles(arena.id);
    obstacles.forEach((ob) => {
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
      halfWidth: (ob.width || 8.0) / 2,
      halfLength: (ob.length || 6.5) / 2,
      halfHeight: (ob.height || 2.2) / 2,
      rampHeight: ob.height || 2.2,
      rotation: rot,
    };
  } else if (ob.type === 'concrete_block') {
    return {
      id: ob.id,
      type: 'box',
      x: ob.x,
      y: 0.65,
      z: ob.z,
      halfWidth: (ob.width || 3.4) / 2,
      halfLength: (ob.length || 1.4) / 2,
      halfHeight: 0.65,
      rotation: rot,
    };
  } else if (ob.type === 'tire_stack') {
    return {
      id: ob.id,
      type: 'cylinder',
      x: ob.x,
      y: 0.95,
      z: ob.z,
      radius: ob.radius ? ob.radius * 0.95 : 1.8,
      halfHeight: 0.95,
    };
  } else if (ob.type === 'metal_barrel') {
    return {
      id: ob.id,
      type: 'cylinder',
      x: ob.x,
      y: 0.65,
      z: ob.z,
      radius: ob.radius || 1.1,
      halfHeight: 0.65,
    };
  } else {
    // Scrap wreck
    return {
      id: ob.id,
      type: 'cylinder',
      x: ob.x,
      y: 1.1,
      z: ob.z,
      radius: ob.radius || 2.8,
      halfHeight: 1.1,
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

  const steelMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.4, metalness: 0.8 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.9, metalness: 0.1 });
  const yellowRampMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.5, metalness: 0.3 });
  const redBarrelMat = new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.4, metalness: 0.6 });
  const blueBarrelMat = new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.4, metalness: 0.6 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.95 });
  const rustMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8, metalness: 0.4 });

  if (ob.type === 'ramp') {
    const rWidth = ob.width || 8.0;
    const rLength = ob.length || 6.5;
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

    const rampMesh = new THREE.Mesh(rampGeo, yellowRampMat);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    group.add(rampMesh);

    // Steel Safety Rails on Left & Right sides of Ramp
    const railGeo = new THREE.BoxGeometry(0.25, rHeight * 0.9, rLength);
    const railL = new THREE.Mesh(railGeo, steelMat);
    railL.position.set(-rWidth / 2, rHeight * 0.45, 0);
    railL.rotation.x = -Math.atan2(rHeight, rLength);
    group.add(railL);

    const railR = new THREE.Mesh(railGeo, steelMat);
    railR.position.set(rWidth / 2, rHeight * 0.45, 0);
    railR.rotation.x = -Math.atan2(rHeight, rLength);
    group.add(railR);
  } else if (ob.type === 'concrete_block') {
    const blockWidth = ob.width || 3.4;
    const blockLength = ob.length || 1.4;

    const blockGeo = new THREE.BoxGeometry(blockWidth, 1.3, blockLength);
    const blockMesh = new THREE.Mesh(blockGeo, concreteMat);
    blockMesh.position.y = 0.65;
    blockMesh.castShadow = true;
    blockMesh.receiveShadow = true;
    group.add(blockMesh);

    const stripeGeo = new THREE.BoxGeometry(blockWidth + 0.05, 0.45, blockLength + 0.05);
    const stripeMesh = new THREE.Mesh(stripeGeo, yellowRampMat);
    stripeMesh.position.y = 0.65;
    group.add(stripeMesh);
  } else if (ob.type === 'tire_stack') {
    const tRadius = ob.radius ? ob.radius * 0.85 : 1.5;
    for (let y = 0; y < 4; y++) {
      const tireGeo = new THREE.CylinderGeometry(tRadius, tRadius, 0.5, 16);
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      tireMesh.position.set((Math.random() - 0.5) * 0.15, 0.25 + y * 0.46, (Math.random() - 0.5) * 0.15);
      tireMesh.castShadow = true;
      group.add(tireMesh);
    }
  } else if (ob.type === 'metal_barrel') {
    // Trio of 55-Gallon Steel Oil Drums
    const barrelConfigs = [
      { x: -0.55, z: -0.3, mat: redBarrelMat },
      { x: 0.55, z: -0.3, mat: blueBarrelMat },
      { x: 0, z: 0.45, mat: rustMat },
    ];

    barrelConfigs.forEach((bCfg) => {
      const barrelGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.3, 16);
      const barrelMesh = new THREE.Mesh(barrelGeo, bCfg.mat);
      barrelMesh.position.set(bCfg.x, 0.65, bCfg.z);
      barrelMesh.castShadow = true;
      group.add(barrelMesh);

      // Upper & Lower Steel Rings
      const ringGeo = new THREE.TorusGeometry(0.46, 0.03, 8, 16);
      const ringTop = new THREE.Mesh(ringGeo, steelMat);
      ringTop.rotation.x = Math.PI / 2;
      ringTop.position.set(bCfg.x, 0.95, bCfg.z);
      group.add(ringTop);

      const ringBot = new THREE.Mesh(ringGeo, steelMat);
      ringBot.rotation.x = Math.PI / 2;
      ringBot.position.set(bCfg.x, 0.35, bCfg.z);
      group.add(ringBot);
    });
  } else if (ob.type === 'scrap_wreck' || ob.type === 'mound') {
    // Crushed Car Wreckage Prop
    const wreckBaseGeo = new THREE.BoxGeometry(3.6, 1.1, 2.0);
    const wreckMesh = new THREE.Mesh(wreckBaseGeo, rustMat);
    wreckMesh.position.y = 0.55;
    wreckMesh.rotation.set(0.08, 0.15, -0.05);
    wreckMesh.castShadow = true;
    wreckMesh.receiveShadow = true;
    group.add(wreckMesh);

    const roofCrushGeo = new THREE.BoxGeometry(2.2, 0.6, 1.6);
    const roofMesh = new THREE.Mesh(roofCrushGeo, rustMat);
    roofMesh.position.set(-0.2, 1.1, 0);
    roofMesh.rotation.set(-0.15, 0.05, 0.12);
    roofMesh.castShadow = true;
    group.add(roofMesh);
  }

  return group;
}
