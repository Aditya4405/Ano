import {
  ArenaDefinition,
  ArenaId,
  VehicleDefinition,
  VehicleId,
  VehicleState,
  VehicleStats,
  VehicleUpgrades,
} from './types';

// ── 5 VEHICLES DEFINITION ──────────────────────────────────
export const VEHICLES: Record<VehicleId, VehicleDefinition> = {
  starter: {
    id: 'starter',
    name: 'Derby Cruiser',
    tagline: 'Balanced Starter Car',
    description: 'Reliable all-around vehicle with balanced armor, speed, and handling for beginners.',
    price: 0,
    unlockedByDefault: true,
    color: '#3b82f6', // Blue
    accentColor: '#fbbf24',
    baseStats: { speed: 65, acceleration: 65, handling: 65, armor: 60, ram: 60, weight: 1400 },
    width: 2.0,
    length: 4.2,
    height: 1.4,
  },
  muscle: {
    id: 'muscle',
    name: 'Road Crusher V8',
    tagline: 'High Speed & Heavy Ramming',
    description: 'Aggressive muscle coupe engineered for explosive high-speed head-on collisions.',
    price: 1200,
    unlockedByDefault: false,
    color: '#ef4444', // Red
    accentColor: '#10b981',
    baseStats: { speed: 85, acceleration: 80, handling: 55, armor: 65, ram: 85, weight: 1750 },
    width: 2.1,
    length: 4.5,
    height: 1.35,
  },
  heavy: {
    id: 'heavy',
    name: 'Iron Tanker',
    tagline: 'Ultimate Armor & Collision Power',
    description: 'Heavyweight titan featuring reinforced steel plating that crushes lighter opponents.',
    price: 2500,
    unlockedByDefault: false,
    color: '#6b7280', // Steel Gray
    accentColor: '#f59e0b',
    baseStats: { speed: 55, acceleration: 50, handling: 45, armor: 95, ram: 95, weight: 2600 },
    width: 2.4,
    length: 4.8,
    height: 1.6,
  },
  rally: {
    id: 'rally',
    name: 'Apex Phantom',
    tagline: 'Agile Drift & Quick Escape',
    description: 'Lightweight rally machine with exceptional steering, fast recovery, and quick acceleration.',
    price: 3200,
    unlockedByDefault: false,
    color: '#8b5cf6', // Purple
    accentColor: '#06b6d4',
    baseStats: { speed: 90, acceleration: 90, handling: 95, armor: 50, ram: 55, weight: 1200 },
    width: 1.95,
    length: 4.0,
    height: 1.3,
  },
  armored: {
    id: 'armored',
    name: 'Armored Juggernaut',
    tagline: 'Unstoppable Demolition Monster',
    description: 'Top-tier battle rig built to dominate the arena with high health and terrifying ram damage.',
    price: 5000,
    unlockedByDefault: false,
    color: '#b91c1c', // Dark Crimson
    accentColor: '#eab308',
    baseStats: { speed: 75, acceleration: 70, handling: 70, armor: 90, ram: 90, weight: 2200 },
    width: 2.3,
    length: 4.7,
    height: 1.55,
  },
};

// ── 7 ARENAS DEFINITION (WORLD COORDS: CENTER (0,0)) ───────
export const ARENAS: Record<ArenaId, ArenaDefinition> = {
  arena_1: {
    id: 'arena_1',
    index: 1,
    name: 'Junkyard Stadium',
    environment: 'Scrap metal, rusty containers, old cars & concrete barriers',
    difficultyTag: 'Easy',
    description: 'Open scrapyard stadium designed for intense collisions and high-speed impacts.',
    surfaceFriction: 1.0,
    radius: 38, // World radius units
    obstacleType: 'open',
    groundColor: '#18181b',
    skyColor: '#09090b',
    wallColor: '#ea580c',
    fogColor: '#09090b',
    hasRamps: false,
    hasObstacles: true,
  },
  arena_2: {
    id: 'arena_2',
    index: 2,
    name: 'Industrial Yard',
    environment: 'Steel structures, shipping containers & tight collision lanes',
    difficultyTag: 'Easy / Medium',
    description: 'Confined industrial storage lot forcing intense close-quarters wall crashes.',
    surfaceFriction: 0.95,
    radius: 34,
    obstacleType: 'tight',
    groundColor: '#1e293b',
    skyColor: '#0f172a',
    wallColor: '#f59e0b',
    fogColor: '#0f172a',
    hasRamps: false,
    hasObstacles: true,
  },
  arena_3: {
    id: 'arena_3',
    index: 3,
    name: 'Desert Derby',
    environment: 'Sand dunes, dust clouds, rocky barriers & wooden barriers',
    difficultyTag: 'Medium',
    description: 'Wide dusty desert pit with reduced tire grip and rock hazards.',
    surfaceFriction: 0.82,
    radius: 42,
    obstacleType: 'obstacles',
    groundColor: '#78350f',
    skyColor: '#451a03',
    wallColor: '#d97706',
    fogColor: '#451a03',
    hasRamps: true,
    hasObstacles: true,
  },
  arena_4: {
    id: 'arena_4',
    index: 4,
    name: 'Construction Zone',
    environment: 'Concrete blocks, steel girders, high ramps & heavy machinery',
    difficultyTag: 'Medium',
    description: 'Active construction crater featuring dirt ramps for spectacular airborne jump attacks.',
    surfaceFriction: 0.9,
    radius: 38,
    obstacleType: 'ramp',
    groundColor: '#3b0764',
    skyColor: '#1e1b4b',
    wallColor: '#eab308',
    fogColor: '#18181b',
    hasRamps: true,
    hasObstacles: true,
  },
  arena_5: {
    id: 'arena_5',
    index: 5,
    name: 'Night Stadium',
    environment: 'Floodlights, cheering crowd, metal barriers & dark arena floor',
    difficultyTag: 'Medium / Difficult',
    description: 'Full-capacity night derby show under stadium lights with fast aggressive bot AI.',
    surfaceFriction: 1.0,
    radius: 36,
    obstacleType: 'open',
    groundColor: '#09090b',
    skyColor: '#000000',
    wallColor: '#ef4444',
    fogColor: '#000000',
    hasRamps: true,
    hasObstacles: true,
  },
  arena_6: {
    id: 'arena_6',
    index: 6,
    name: 'Frozen Arena',
    environment: 'Ice sheets, snow drifts, sub-zero temperature & icy barriers',
    difficultyTag: 'Medium / Difficult',
    description: 'Slippery frozen lake arena requiring master-level drift control and steering precision.',
    surfaceFriction: 0.42, // Extreme ice drift!
    radius: 40,
    obstacleType: 'slippery',
    groundColor: '#172554',
    skyColor: '#0f172a',
    wallColor: '#38bdf8',
    fogColor: '#172554',
    hasRamps: false,
    hasObstacles: true,
  },
  arena_7: {
    id: 'arena_7',
    index: 7,
    name: 'Industrial Death Ring',
    environment: 'Reinforced steel ring, dangerous inner obstacles & jump ramps',
    difficultyTag: 'Difficult',
    description: 'The ultimate battle ground. Enclosed steel cage with extreme bot difficulty.',
    surfaceFriction: 0.95,
    radius: 32,
    obstacleType: 'obstacles',
    groundColor: '#18181b',
    skyColor: '#450a0a',
    wallColor: '#dc2626',
    fogColor: '#18181b',
    hasRamps: true,
    hasObstacles: true,
  },
};

export function computeEffectiveStats(
  vehicleId: VehicleId,
  upgrades?: VehicleUpgrades,
  normalized: boolean = false
): VehicleStats {
  const def = VEHICLES[vehicleId] || VEHICLES.starter;
  if (normalized) {
    return { ...def.baseStats };
  }

  const up = upgrades || { engine: 0, armor: 0, ram: 0, handling: 0, brakes: 0 };
  return {
    speed: Math.min(100, def.baseStats.speed + up.engine * 4),
    acceleration: Math.min(100, def.baseStats.acceleration + up.engine * 4),
    handling: Math.min(100, def.baseStats.handling + up.handling * 4),
    armor: Math.min(100, def.baseStats.armor + up.armor * 4),
    ram: Math.min(100, def.baseStats.ram + up.ram * 4),
    weight: def.baseStats.weight + up.armor * 50,
  };
}

export interface DriverInput {
  throttle: number; // -1 (reverse), 0, 1 (forward)
  steering: number; // -1 (left), 0, 1 (right)
  handbrake: boolean;
}

export interface PhysicsUpdateResult {
  justJumped: boolean;
  justLanded: boolean;
  landingSpeed: number;
  obstacleHit?: string;
}

// ── WORLD-SPACE ARENA OBSTACLES ───────────────────────────
export const ARENA_OBSTACLES = [
  // Central Ramp
  { id: 'central_ramp', type: 'ramp' as const, x: 0, z: 0, radius: 4.8, width: 8.5, length: 7.0, rotation: 0, height: 2.2 },
  // Dirt Mounds
  { id: 'mound_1', type: 'mound' as const, x: -16, z: 12, radius: 4.0, height: 1.2 },
  { id: 'mound_2', type: 'mound' as const, x: 16, z: -12, radius: 4.0, height: 1.2 },
  // Concrete Blocks (Hazard Stripes)
  { id: 'block_1', type: 'concrete_block' as const, x: -12, z: -12, radius: 2.2 },
  { id: 'block_2', type: 'concrete_block' as const, x: 12, z: 12, radius: 2.2 },
  { id: 'block_3', type: 'concrete_block' as const, x: 12, z: -12, radius: 2.2 },
  { id: 'block_4', type: 'concrete_block' as const, x: -12, z: 12, radius: 2.2 },
  // Tire Stacks
  { id: 'tires_1', type: 'tire_stack' as const, x: -20, z: 0, radius: 2.5 },
  { id: 'tires_2', type: 'tire_stack' as const, x: 20, z: 0, radius: 2.5 },
  { id: 'tires_3', type: 'tire_stack' as const, x: 0, z: -20, radius: 2.5 },
  { id: 'tires_4', type: 'tire_stack' as const, x: 0, z: 20, radius: 2.5 },
  // Metal Barrels
  { id: 'barrel_1', type: 'metal_barrel' as const, x: -22, z: 10, radius: 1.6 },
  { id: 'barrel_2', type: 'metal_barrel' as const, x: 22, z: -10, radius: 1.6 },
  { id: 'barrel_3', type: 'metal_barrel' as const, x: -10, z: 22, radius: 1.6 },
  { id: 'barrel_4', type: 'metal_barrel' as const, x: 10, z: -22, radius: 1.6 },
  // Scrap Vehicle Wrecks
  { id: 'wreck_1', type: 'scrap_wreck' as const, x: -24, z: -16, radius: 2.8 },
  { id: 'wreck_2', type: 'scrap_wreck' as const, x: 24, z: 16, radius: 2.8 },
];

// ── PURE WORLD-SPACE VEHICLE PHYSICS SIMULATION ───────────
export function updateVehiclePhysics(
  v: VehicleState,
  input: DriverInput,
  arena: ArenaDefinition,
  dt: number = 0.016
): PhysicsUpdateResult {
  let justJumped = false;
  let justLanded = false;
  let landingSpeed = 0;
  let obstacleHit: string | undefined;

  if (v.isDestroyed || v.hp <= 0) {
    return { justJumped: false, justLanded: false, landingSpeed: 0 };
  }

  const friction = arena.surfaceFriction;
  const maxSpeedUnit = (v.topSpeed / 100) * 30; // Max ~30 world units/sec
  const accelPower = (v.accelPower / 100) * 28 * friction;
  const turnRate = (v.turnPower / 100) * 3.4 * (input.handbrake ? 1.4 : 1.0);

  // Jump Cooldown timer
  if (v.jumpCooldown > 0) {
    v.jumpCooldown -= dt;
  }

  // Airborne physics handling
  if (v.isAirborne || v.y > 0) {
    v.vy -= 18 * dt; // Gravity
    v.y += v.vy * dt;

    if (v.y <= 0) {
      v.y = 0;
      v.vy = 0;
      v.isAirborne = false;
      justLanded = true;
      landingSpeed = v.speed;
    }
  }

  // 1. Update RotationAngle (Steering)
  if (Math.abs(v.speed) > 0.3) {
    const dir = v.speed > 0 ? 1 : -1;
    v.rotationY += input.steering * turnRate * dir * dt;
  }

  // 2. Facing Vector Direction
  const forwardX = Math.sin(v.rotationY);
  const forwardZ = -Math.cos(v.rotationY);

  // 3. Accelerate / Reverse
  let accelForce = input.throttle * accelPower;
  if (input.handbrake) {
    v.isDrifting = Math.abs(v.speed) > 4;
    accelForce *= 0.2;
  } else {
    v.isDrifting = friction < 0.6 && Math.abs(input.steering) > 0.35 && Math.abs(v.speed) > 6;
  }

  v.vx += forwardX * accelForce * dt;
  v.vz += forwardZ * accelForce * dt;

  // 4. Drag & Friction
  const dragFactor = Math.max(0, 1 - (1.8 / (friction * 10)) * dt);
  v.vx *= dragFactor;
  v.vz *= dragFactor;

  // 5. Max Speed Cap
  v.speed = Math.sqrt(v.vx * v.vx + v.vz * v.vz);
  if (v.speed > maxSpeedUnit) {
    v.vx = (v.vx / v.speed) * maxSpeedUnit;
    v.vz = (v.vz / v.speed) * maxSpeedUnit;
    v.speed = maxSpeedUnit;
  }

  // 6. Update Persistent WORLD POSITION
  v.x += v.vx * dt;
  v.z += v.vz * dt;

  // 7. RAMP JUMP CHECK
  if (!v.isAirborne && v.jumpCooldown <= 0 && v.speed > 6.0) {
    const dxRamp = v.x - 0;
    const dzRamp = v.z - 0;
    if (Math.abs(dxRamp) < 4.2 && Math.abs(dzRamp) < 3.5) {
      v.isAirborne = true;
      v.vy = 8.5 + (v.speed / maxSpeedUnit) * 6.0;
      v.jumpCooldown = 1.8;
      justJumped = true;
    }
  }

  // 8. OBSTACLE COLLISIONS
  if (arena.hasObstacles && !v.isAirborne) {
    ARENA_OBSTACLES.forEach((ob) => {
      if (ob.type === 'ramp') return; // Ramps handled above

      const dx = v.x - ob.x;
      const dz = v.z - ob.z;
      const distSq = dx * dx + dz * dz;
      const minDist = ob.radius + 1.2;

      if (distSq < minDist * minDist && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = minDist - dist;

        v.x += nx * overlap;
        v.z += nz * overlap;

        const dot = v.vx * nx + v.vz * nz;
        if (dot < 0) {
          const bounciness = ob.type === 'tire_stack' ? 0.7 : ob.type === 'metal_barrel' ? 0.5 : 0.25;
          v.vx -= (1 + bounciness) * dot * nx;
          v.vz -= (1 + bounciness) * dot * nz;
          v.speed *= 0.6;
          obstacleHit = ob.type;

          if (ob.type === 'concrete_block' && Math.abs(dot) > 6) {
            v.hp = Math.max(0, v.hp - Math.round(Math.abs(dot) * 0.35));
          }
        }
      }
    });
  }

  // 9. Outer Arena Boundary Collision
  const distFromCenter = Math.sqrt(v.x * v.x + v.z * v.z);
  const maxRadius = arena.radius - 1.8;

  if (distFromCenter > maxRadius) {
    const nx = v.x / distFromCenter;
    const nz = v.z / distFromCenter;

    v.x = nx * maxRadius;
    v.z = nz * maxRadius;

    const dot = v.vx * nx + v.vz * nz;
    if (dot > 0) {
      v.vx -= 1.6 * dot * nx;
      v.vz -= 1.6 * dot * nz;
      v.speed *= 0.5;

      if (dot > 8) {
        v.hp = Math.max(0, v.hp - Math.round(dot * 0.4));
      }
    }
  }

  return { justJumped, justLanded, landingSpeed, obstacleHit };
}

// ── WORLD-SPACE VEHICLE COLLISION RESOLUTION ──────────────
export interface CollisionResult {
  hasCollision: boolean;
  damageA: number;
  damageB: number;
  impactX: number;
  impactY: number;
  impactZ: number;
  relativeVelocity: number;
  impactSeverity: 'NORMAL' | 'HEAVY' | 'CRITICAL';
}

export function checkVehicleCollision(
  a: VehicleState,
  b: VehicleState
): CollisionResult | null {
  if (a.isDestroyed || b.isDestroyed || a.hp <= 0 || b.hp <= 0) return null;

  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const distSq = dx * dx + dz * dz;
  const minDist = 3.2; // Bounding collision radius

  if (distSq >= minDist * minDist || distSq === 0) return null;

  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const nz = dz / dist;

  // Relative velocity vector in World Space
  const rvx = a.vx - b.vx;
  const rvz = a.vz - b.vz;
  const relVel = Math.sqrt(rvx * rvx + rvz * rvz);

  if (relVel < 1.2) return null; // Ignore minor touch

  // Separate overlapping vehicles in World Space
  const overlap = minDist - dist;
  a.x -= nx * overlap * 0.5;
  a.z -= nz * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.z += nz * overlap * 0.5;

  // Elastic Impulse Physics
  const massTotal = a.weight + b.weight;
  const massRatioA = b.weight / massTotal;
  const massRatioB = a.weight / massTotal;

  const impulse = relVel * 0.9;
  a.vx -= nx * impulse * massRatioA;
  a.vz -= nz * impulse * massRatioA;
  b.vx += nx * impulse * massRatioB;
  b.vz += nz * impulse * massRatioB;

  // Damage calculation
  const baseDmg = relVel * 2.5;
  const damageA = Math.round(Math.max(4, (baseDmg * (b.ramStat / 60)) / (a.armor / 60)));
  const damageB = Math.round(Math.max(4, (baseDmg * (a.ramStat / 60)) / (b.armor / 60)));

  const severity = relVel > 18 ? 'CRITICAL' : relVel > 9 ? 'HEAVY' : 'NORMAL';

  return {
    hasCollision: true,
    damageA,
    damageB,
    impactX: (a.x + b.x) / 2,
    impactY: (a.y + b.y) / 2,
    impactZ: (a.z + b.z) / 2,
    relativeVelocity: relVel,
    impactSeverity: severity,
  };
}
