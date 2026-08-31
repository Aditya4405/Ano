import {
  ArenaBoundaryType,
  ArenaDefinition,
  ArenaId,
  ArenaObstacle,
  ArenaSpawnPoint,
  ObstacleCollider,
  VehicleDefinition,
  VehicleId,
  VehicleState,
  VehicleStats,
  VehicleUpgrades,
} from './types';

// ── VEHICLE DIMENSIONS (MATCHING GLB ASSET FOOTPRINT) ────────
export const VEH_LENGTH = 4.36; // meters
export const VEH_WIDTH = 2.16;  // meters
export const VEH_HEIGHT = 1.45; // meters
export const VEH_HALF_LEN = 2.18; // local Z half-extent
export const VEH_HALF_WID = 1.08; // local X half-extent
export const COLLISION_MARGIN = 0.04; // safety contact clearance

// ── 4 DISTINCT MULTIPLAYER DERBY VEHICLES ──────────────────
export const VEHICLES: Record<VehicleId, VehicleDefinition> = {
  road_crusher: {
    id: 'road_crusher',
    name: 'ROAD CRUSHER V8',
    tagline: 'High Speed & Heavy Ramming',
    description: 'Aggressive V8 muscle machine with an elongated body, supercharged scoop, reinforced front crash ram, and high-speed collision power.',
    price: 1200,
    unlockedByDefault: true, // Starter car unlocked initially
    color: '#ef4444',
    accentColor: '#10b981',
    baseStats: { speed: 85, acceleration: 82, handling: 65, armor: 65, ram: 85, weight: 1750 },
    width: 2.20,
    length: 4.80,
    height: 1.45,
  },
  iron_tanker: {
    id: 'iron_tanker',
    name: 'IRON TANKER',
    tagline: 'Ultimate Armor & Collision Power',
    description: 'Heavyweight armored demolition titan with extreme steel plating, multi-tier box bumper, side skirts, and devastating crushing force.',
    price: 2500,
    unlockedByDefault: false,
    color: '#475569',
    accentColor: '#f59e0b',
    baseStats: { speed: 55, acceleration: 50, handling: 45, armor: 95, ram: 95, weight: 2600 },
    width: 2.60,
    length: 5.20,
    height: 1.90,
  },
  apex_phantom: {
    id: 'apex_phantom',
    name: 'APEX PHANTOM',
    tagline: 'Agile Drift & Quick Escape',
    description: 'Ultra-low aerodynamic drift machine with sharp front splitters, high-downforce rear wing, razor handling, and explosive acceleration.',
    price: 3200,
    unlockedByDefault: false,
    color: '#7c3aed',
    accentColor: '#06b6d4',
    baseStats: { speed: 95, acceleration: 92, handling: 95, armor: 45, ram: 52, weight: 1200 },
    width: 2.05,
    length: 4.40,
    height: 1.15,
  },
  armored_juggernaut: {
    id: 'armored_juggernaut',
    name: 'ARMORED JUGGERNAUT',
    tagline: 'Unstoppable Demolition Monster',
    description: 'Enormous demolition behemoth equipped with a colossal spiked bulldozer V-plow, oversized tractor wheels, and unstoppable mass.',
    price: 5000,
    unlockedByDefault: false,
    color: '#991b1b',
    accentColor: '#eab308',
    baseStats: { speed: 45, acceleration: 48, handling: 35, armor: 100, ram: 100, weight: 3400 },
    width: 2.90,
    length: 5.80,
    height: 2.30,
  },

  // Aliases for backwards compatibility
  starter: {
    id: 'starter',
    name: 'ROAD CRUSHER V8',
    tagline: 'High Speed & Heavy Ramming',
    description: 'Aggressive V8 muscle machine with an elongated body, supercharged scoop, reinforced front crash ram, and high-speed collision power.',
    price: 1200,
    unlockedByDefault: true,
    color: '#ef4444',
    accentColor: '#10b981',
    baseStats: { speed: 85, acceleration: 82, handling: 65, armor: 65, ram: 85, weight: 1750 },
    width: 2.20,
    length: 4.80,
    height: 1.45,
  },
  muscle: {
    id: 'muscle',
    name: 'ROAD CRUSHER V8',
    tagline: 'High Speed & Heavy Ramming',
    description: 'Aggressive V8 muscle machine with an elongated body, supercharged scoop, reinforced front crash ram, and high-speed collision power.',
    price: 1200,
    unlockedByDefault: true,
    color: '#ef4444',
    accentColor: '#10b981',
    baseStats: { speed: 85, acceleration: 82, handling: 65, armor: 65, ram: 85, weight: 1750 },
    width: 2.20,
    length: 4.80,
    height: 1.45,
  },
  heavy: {
    id: 'heavy',
    name: 'IRON TANKER',
    tagline: 'Ultimate Armor & Collision Power',
    description: 'Heavyweight armored demolition titan with extreme steel plating, multi-tier box bumper, side skirts, and devastating crushing force.',
    price: 2500,
    unlockedByDefault: false,
    color: '#475569',
    accentColor: '#f59e0b',
    baseStats: { speed: 55, acceleration: 50, handling: 45, armor: 95, ram: 95, weight: 2600 },
    width: 2.60,
    length: 5.20,
    height: 1.90,
  },
  rally: {
    id: 'rally',
    name: 'APEX PHANTOM',
    tagline: 'Agile Drift & Quick Escape',
    description: 'Ultra-low aerodynamic drift machine with sharp front splitters, high-downforce rear wing, razor handling, and explosive acceleration.',
    price: 3200,
    unlockedByDefault: false,
    color: '#7c3aed',
    accentColor: '#06b6d4',
    baseStats: { speed: 95, acceleration: 92, handling: 95, armor: 45, ram: 52, weight: 1200 },
    width: 2.05,
    length: 4.40,
    height: 1.15,
  },
  armored: {
    id: 'armored',
    name: 'ARMORED JUGGERNAUT',
    tagline: 'Unstoppable Demolition Monster',
    description: 'Enormous demolition behemoth equipped with a colossal spiked bulldozer V-plow, oversized tractor wheels, and unstoppable mass.',
    price: 5000,
    unlockedByDefault: false,
    color: '#991b1b',
    accentColor: '#eab308',
    baseStats: { speed: 45, acceleration: 48, handling: 35, armor: 100, ram: 100, weight: 3400 },
    width: 2.90,
    length: 5.80,
    height: 2.30,
  },
};

// ── 7 ARENAS DEFINITION (7 UNIQUE PLAYABLE SPACES) ─────────
export const ARENAS: Record<ArenaId, ArenaDefinition> = {
  // Arena 1: Junkyard Stadium (Easy - Wide Open Asymmetric Scrapyard Bowl)
  arena_1: {
    id: 'arena_1',
    index: 1,
    name: 'Junkyard Stadium',
    environment: 'Scrap metal, rusty containers, old cars & concrete barriers',
    difficultyTag: 'Easy',
    description: 'Open scrapyard stadium designed for intense collisions and high-speed impacts.',
    features: [
      'Scrap metal, rusty containers, old cars',
      'Concrete barriers, tire stacks, floodlights',
    ],
    surfaceFriction: 1.0,
    radius: 42,
    boundaryType: 'oval',
    boundaryHalfA: 44,
    boundaryHalfB: 32,
    obstacleType: 'open',
    groundColor: '#2b180d',
    skyColor: '#09090b',
    wallColor: '#ea580c',
    fogColor: '#09090b',
    hasRamps: true,
    hasObstacles: true,
    spawnPoints: [
      { x: 0, z: 24, rotationY: 0 },
      { x: 22, z: 16, rotationY: -2.4 },
      { x: 30, z: -4, rotationY: -Math.PI / 2 },
      { x: 18, z: -22, rotationY: -Math.PI },
      { x: -4, z: -26, rotationY: -Math.PI },
      { x: -24, z: -18, rotationY: 2.4 },
      { x: -30, z: 2, rotationY: Math.PI / 2 },
      { x: -20, z: 20, rotationY: 0.8 },
    ],
    lighting: {
      ambientColor: 0xffffff,
      ambientIntensity: 0.75,
      dirColor: 0xfffbeb,
      dirIntensity: 2.6,
      dirPos: [38, 58, 28],
      spotColor: 0xfff7ed,
      spotIntensity: 4.2,
    },
  },

  // Arena 2: Industrial Yard (Easy / Medium - Rectangular Warehouse Compound with Container Corridors)
  arena_2: {
    id: 'arena_2',
    index: 2,
    name: 'Industrial Yard',
    environment: 'Steel structures, shipping containers & tight collision lanes',
    difficultyTag: 'Easy / Medium',
    description: 'Confined industrial storage lot forcing intense close-quarters wall crashes.',
    features: [
      'Steel structures, shipping containers, forklifts',
      'Tight lanes, concrete walls, oil drums',
    ],
    surfaceFriction: 0.95,
    radius: 36,
    boundaryType: 'box',
    boundaryHalfA: 38,
    boundaryHalfB: 26,
    obstacleType: 'tight',
    groundColor: '#1e2229',
    skyColor: '#0f172a',
    wallColor: '#f59e0b',
    fogColor: '#0f172a',
    hasRamps: false,
    hasObstacles: true,
    spawnPoints: [
      { x: 0, z: 18, rotationY: 0 },
      { x: 26, z: 14, rotationY: -Math.PI / 2 },
      { x: 26, z: -14, rotationY: -Math.PI / 2 },
      { x: 8, z: -18, rotationY: -Math.PI },
      { x: -10, z: -18, rotationY: -Math.PI },
      { x: -26, z: -14, rotationY: Math.PI / 2 },
      { x: -26, z: 14, rotationY: Math.PI / 2 },
      { x: -10, z: 18, rotationY: 0 },
    ],
    lighting: {
      ambientColor: 0x94a3b8,
      ambientIntensity: 0.65,
      dirColor: 0xfef08a,
      dirIntensity: 2.4,
      dirPos: [-28, 50, -20],
      spotColor: 0xf59e0b,
      spotIntensity: 4.2,
    },
  },

  // Arena 3: Desert Derby (Medium - Wide Natural Canyon Basin with Sandstone Cliffs)
  arena_3: {
    id: 'arena_3',
    index: 3,
    name: 'Desert Derby',
    environment: 'Sand dunes, dust clouds, rocky barriers & wooden barriers',
    difficultyTag: 'Medium',
    description: 'Wide dusty desert pit with reduced tire grip and rock hazards.',
    features: [
      'Sand dunes, dust clouds, rocky outcrops',
      'Wooden barriers, cacti, watch towers',
    ],
    surfaceFriction: 0.72,
    radius: 46,
    boundaryType: 'oval',
    boundaryHalfA: 48,
    boundaryHalfB: 36,
    obstacleType: 'obstacles',
    groundColor: '#854d0e',
    skyColor: '#451a03',
    wallColor: '#d97706',
    fogColor: '#451a03',
    hasRamps: true,
    hasObstacles: true,
    spawnPoints: [
      { x: 0, z: 28, rotationY: 0 },
      { x: 30, z: 18, rotationY: -2.5 },
      { x: 36, z: -6, rotationY: -Math.PI / 2 },
      { x: 22, z: -26, rotationY: -Math.PI },
      { x: -6, z: -30, rotationY: -Math.PI },
      { x: -28, z: -22, rotationY: 2.5 },
      { x: -36, z: -4, rotationY: Math.PI / 2 },
      { x: -24, z: 22, rotationY: 0.9 },
    ],
    lighting: {
      ambientColor: 0xfef08a,
      ambientIntensity: 0.85,
      dirColor: 0xffedd5,
      dirIntensity: 3.2,
      dirPos: [45, 60, 30],
      spotColor: 0xfef08a,
      spotIntensity: 4.5,
    },
  },

  // Arena 4: Construction Zone (Medium - Stepped Multi-Zone Excavation Crater)
  arena_4: {
    id: 'arena_4',
    index: 4,
    name: 'Construction Zone',
    environment: 'Concrete blocks, steel girders, high ramps & heavy machinery',
    difficultyTag: 'Medium',
    description: 'Active construction crater featuring dirt ramps for spectacular airborne jump attacks.',
    features: [
      'Concrete blocks, steel girders, scaffolding',
      'Dirt ramps, excavators, cranes',
    ],
    surfaceFriction: 0.88,
    radius: 40,
    boundaryType: 'box',
    boundaryHalfA: 42,
    boundaryHalfB: 30,
    obstacleType: 'ramp',
    groundColor: '#374151',
    skyColor: '#1e1b4b',
    wallColor: '#eab308',
    fogColor: '#18181b',
    hasRamps: true,
    hasObstacles: true,
    spawnPoints: [
      { x: 0, z: 22, rotationY: 0 },
      { x: 24, z: 16, rotationY: -2.3 },
      { x: 32, z: -2, rotationY: -Math.PI / 2 },
      { x: 16, z: -22, rotationY: -Math.PI },
      { x: -6, z: -24, rotationY: -Math.PI },
      { x: -26, z: -14, rotationY: 2.3 },
      { x: -30, z: 4, rotationY: Math.PI / 2 },
      { x: -18, z: 18, rotationY: 0.7 },
    ],
    lighting: {
      ambientColor: 0xe2e8f0,
      ambientIntensity: 0.70,
      dirColor: 0xfef08a,
      dirIntensity: 2.8,
      dirPos: [-30, 55, 30],
      spotColor: 0xfbbf24,
      spotIntensity: 4.4,
    },
  },

  // Arena 5: Night Stadium (Medium / Difficult - Professional Midnight Speedway under Floodlights)
  arena_5: {
    id: 'arena_5',
    index: 5,
    name: 'Night Stadium',
    environment: 'Floodlights, cheering crowd, metal barriers & dark arena floor',
    difficultyTag: 'Medium / Difficult',
    description: 'Full-capacity night derby show under stadium lights with fast aggressive bot AI.',
    features: [
      'Floodlights, cheering crowd, large screens',
      'Metal barriers, dark arena floor',
    ],
    surfaceFriction: 1.0,
    radius: 42,
    boundaryType: 'oval',
    boundaryHalfA: 44,
    boundaryHalfB: 32,
    obstacleType: 'open',
    groundColor: '#0a0a0c',
    skyColor: '#000000',
    wallColor: '#ef4444',
    fogColor: '#000000',
    hasRamps: true,
    hasObstacles: true,
    spawnPoints: [
      { x: 0, z: 22, rotationY: 0 },
      { x: 12, z: 20, rotationY: 0 },
      { x: -12, z: 20, rotationY: 0 },
      { x: 24, z: 16, rotationY: -0.4 },
      { x: -24, z: 16, rotationY: 0.4 },
      { x: 32, z: -8, rotationY: -Math.PI / 2 },
      { x: -32, z: -8, rotationY: Math.PI / 2 },
      { x: 0, z: -26, rotationY: -Math.PI },
    ],
    lighting: {
      ambientColor: 0x1e293b,
      ambientIntensity: 0.45,
      dirColor: 0x38bdf8,
      dirIntensity: 1.2,
      dirPos: [0, 70, 0],
      spotColor: 0xf8fafc,
      spotIntensity: 5.5,
    },
  },

  // Arena 6: Frozen Arena (Medium / Difficult - Alpine Glacial Lake Ice Sheet)
  arena_6: {
    id: 'arena_6',
    index: 6,
    name: 'Frozen Arena',
    environment: 'Ice sheets, snow drifts, sub-zero temperature & icy barriers',
    difficultyTag: 'Medium / Difficult',
    description: 'Slippery frozen lake arena requiring master-level drift control and steering precision.',
    features: [
      'Ice sheets, snow drifts, frozen barriers',
      'Sub-zero temperature atmosphere',
    ],
    surfaceFriction: 0.45,
    radius: 44,
    boundaryType: 'oval',
    boundaryHalfA: 46,
    boundaryHalfB: 34,
    obstacleType: 'slippery',
    groundColor: '#1e3a5f',
    skyColor: '#0f172a',
    wallColor: '#38bdf8',
    fogColor: '#172554',
    hasRamps: true,
    hasObstacles: true,
    spawnPoints: [
      { x: 0, z: 25, rotationY: 0 },
      { x: 26, z: 18, rotationY: -2.4 },
      { x: 34, z: -4, rotationY: -Math.PI / 2 },
      { x: 20, z: -25, rotationY: -Math.PI },
      { x: -4, z: -28, rotationY: -Math.PI },
      { x: -26, z: -20, rotationY: 2.4 },
      { x: -34, z: -2, rotationY: Math.PI / 2 },
      { x: -22, z: 22, rotationY: 0.8 },
    ],
    lighting: {
      ambientColor: 0xe0f2fe,
      ambientIntensity: 0.85,
      dirColor: 0xf0f9ff,
      dirIntensity: 2.5,
      dirPos: [20, 60, 40],
      spotColor: 0xe0f2fe,
      spotIntensity: 3.8,
    },
  },

  // Arena 7: Industrial Death Ring (Difficult - Enclosed Steel Cage Colosseum)
  arena_7: {
    id: 'arena_7',
    index: 7,
    name: 'Industrial Death Ring',
    environment: 'Reinforced steel ring, dangerous inner obstacles & jump ramps',
    difficultyTag: 'Difficult',
    description: 'The ultimate battle ground. Enclosed steel cage with extreme bot difficulty.',
    features: [
      'Reinforced steel ring, inner obstacles',
      'Fire traps, jump ramps, crushers',
    ],
    surfaceFriction: 0.92,
    radius: 32,
    boundaryType: 'circle',
    boundaryHalfA: 32,
    boundaryHalfB: 32,
    obstacleType: 'obstacles',
    groundColor: '#111827',
    skyColor: '#450a0a',
    wallColor: '#dc2626',
    fogColor: '#18181b',
    hasRamps: false,
    hasObstacles: true,
    spawnPoints: [
      { x: 0, z: 24, rotationY: 0 },
      { x: 17, z: 17, rotationY: -2.35 },
      { x: 24, z: 0, rotationY: -Math.PI / 2 },
      { x: 17, z: -17, rotationY: -2.35 - Math.PI / 2 },
      { x: 0, z: -24, rotationY: -Math.PI },
      { x: -17, z: -17, rotationY: 2.35 },
      { x: -24, z: 0, rotationY: Math.PI / 2 },
      { x: -17, z: 17, rotationY: 0.78 },
    ],
    lighting: {
      ambientColor: 0x450a0a,
      ambientIntensity: 0.55,
      dirColor: 0xef4444,
      dirIntensity: 2.2,
      dirPos: [0, 45, 0],
      spotColor: 0xf97316,
      spotIntensity: 4.8,
    },
  },
};

export function getArenaSpawnPoints(arenaId: ArenaId): ArenaSpawnPoint[] {
  const arena = ARENAS[arenaId] || ARENAS.arena_1;
  return arena.spawnPoints;
}

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
  throttle: number; // -1 (reverse/brake), 0, 1 (forward)
  steering: number; // -1 (left), 0, 1 (right)
  handbrake: boolean;
}

export interface PhysicsUpdateResult {
  justJumped: boolean;
  justLanded: boolean;
  landingSpeed: number;
  obstacleHit?: string;
}

// ── WORLD-SPACE ARENA OBSTACLE SETS (7 UNIQUE LAYOUTS) ───────
export const ARENA_OBSTACLE_SETS: Record<ArenaId, ArenaObstacle[]> = {
  // Arena 1: Junkyard Stadium (Wide open center + peripheral scrap)
  arena_1: [
    { id: 'central_ramp', type: 'ramp', x: 0, z: 0, radius: 4.5, width: 8.0, length: 7.0, rotation: 0, height: 2.0 },
    { id: 'block_west', type: 'concrete_block', x: -18, z: 0, radius: 2.2, width: 3.4, length: 1.4, rotation: Math.PI / 4 },
    { id: 'block_east', type: 'concrete_block', x: 18, z: 0, radius: 2.2, width: 3.4, length: 1.4, rotation: -Math.PI / 4 },
    { id: 'tires_nw', type: 'tire_stack', x: -26, z: -14, radius: 1.8 },
    { id: 'tires_ne', type: 'tire_stack', x: 26, z: -14, radius: 1.8 },
    { id: 'tires_sw', type: 'tire_stack', x: -26, z: 14, radius: 1.8 },
    { id: 'tires_se', type: 'tire_stack', x: 26, z: 14, radius: 1.8 },
    { id: 'barrels_north', type: 'metal_barrel', x: -10, z: -18, radius: 1.1 },
    { id: 'barrels_south', type: 'metal_barrel', x: 10, z: 18, radius: 1.1 },
    { id: 'wreck_west', type: 'scrap_wreck', x: -32, z: 0, radius: 2.8 },
    { id: 'wreck_east', type: 'scrap_wreck', x: 32, z: 0, radius: 2.8 },
  ],

  // Arena 2: Industrial Yard (Tight shipping container corridors & heavy blast walls)
  arena_2: [
    { id: 'container_nw', type: 'concrete_block', x: -14, z: -9, radius: 3.2, width: 6.2, length: 2.4, rotation: 0 },
    { id: 'container_ne', type: 'concrete_block', x: 14, z: -9, radius: 3.2, width: 6.2, length: 2.4, rotation: 0 },
    { id: 'container_sw', type: 'concrete_block', x: -14, z: 9, radius: 3.2, width: 6.2, length: 2.4, rotation: 0 },
    { id: 'container_se', type: 'concrete_block', x: 14, z: 9, radius: 3.2, width: 6.2, length: 2.4, rotation: 0 },
    { id: 'pillar_west', type: 'scrap_wreck', x: -24, z: 0, radius: 2.2 },
    { id: 'pillar_east', type: 'scrap_wreck', x: 24, z: 0, radius: 2.2 },
    { id: 'drums_nw', type: 'metal_barrel', x: -6, z: -16, radius: 1.2 },
    { id: 'drums_se', type: 'metal_barrel', x: 6, z: 16, radius: 1.2 },
    { id: 'drums_center_w', type: 'metal_barrel', x: -4, z: 0, radius: 1.1 },
    { id: 'drums_center_e', type: 'metal_barrel', x: 4, z: 0, radius: 1.1 },
  ],

  // Arena 3: Desert Derby (Wide dusty canyon with sandstone rocks & wooden chicanes)
  arena_3: [
    { id: 'desert_mound_ramp', type: 'ramp', x: 0, z: 0, radius: 4.5, width: 8.5, length: 7.5, rotation: 0, height: 2.2 },
    { id: 'rock_nw', type: 'scrap_wreck', x: -20, z: -12, radius: 2.6 },
    { id: 'rock_ne', type: 'scrap_wreck', x: 20, z: -12, radius: 2.6 },
    { id: 'rock_sw', type: 'scrap_wreck', x: -20, z: 12, radius: 2.6 },
    { id: 'rock_se', type: 'scrap_wreck', x: 20, z: 12, radius: 2.6 },
    { id: 'fence_west', type: 'concrete_block', x: -28, z: 0, radius: 2.4, width: 4.5, length: 1.2, rotation: Math.PI / 3 },
    { id: 'fence_east', type: 'concrete_block', x: 28, z: 0, radius: 2.4, width: 4.5, length: 1.2, rotation: -Math.PI / 3 },
    { id: 'drums_desert_n', type: 'metal_barrel', x: -12, z: 18, radius: 1.2 },
    { id: 'drums_desert_s', type: 'metal_barrel', x: 12, z: -18, radius: 1.2 },
  ],

  // Arena 4: Construction Zone (High ramp, concrete sewer pipes, crane base & girders)
  arena_4: [
    { id: 'construction_jump_ramp', type: 'ramp', x: 0, z: 0, radius: 4.5, width: 8.5, length: 7.5, rotation: 0, height: 2.4 },
    { id: 'pipe_stack_west', type: 'concrete_block', x: -16, z: -8, radius: 2.8, width: 5.0, length: 2.0, rotation: Math.PI / 6 },
    { id: 'pipe_stack_east', type: 'concrete_block', x: 16, z: 8, radius: 2.8, width: 5.0, length: 2.0, rotation: -Math.PI / 6 },
    { id: 'crane_block_w', type: 'concrete_block', x: -22, z: 10, radius: 2.2, width: 3.2, length: 3.2, rotation: 0 },
    { id: 'crane_block_e', type: 'concrete_block', x: 22, z: -10, radius: 2.2, width: 3.2, length: 3.2, rotation: 0 },
    { id: 'tires_const_nw', type: 'tire_stack', x: -26, z: -12, radius: 1.8 },
    { id: 'tires_const_se', type: 'tire_stack', x: 26, z: 12, radius: 1.8 },
    { id: 'barrels_const', type: 'metal_barrel', x: 0, z: -16, radius: 1.2 },
  ],

  // Arena 5: Night Stadium (High-intensity neon stadium, sponsor tire walls & deflectors)
  arena_5: [
    { id: 'stadium_neon_ramp', type: 'ramp', x: 0, z: 0, radius: 4.5, width: 8.0, length: 7.0, rotation: 0, height: 2.0 },
    { id: 'neon_tires_nw', type: 'tire_stack', x: -22, z: -11, radius: 2.0 },
    { id: 'neon_tires_ne', type: 'tire_stack', x: 22, z: -11, radius: 2.0 },
    { id: 'neon_tires_sw', type: 'tire_stack', x: -22, z: 11, radius: 2.0 },
    { id: 'neon_tires_se', type: 'tire_stack', x: 22, z: 11, radius: 2.0 },
    { id: 'deflector_pylon_w', type: 'concrete_block', x: -16, z: 0, radius: 2.2, width: 3.6, length: 1.4, rotation: Math.PI / 4 },
    { id: 'deflector_pylon_e', type: 'concrete_block', x: 16, z: 0, radius: 2.2, width: 3.6, length: 1.4, rotation: -Math.PI / 4 },
    { id: 'barrels_stadium_n', type: 'metal_barrel', x: -8, z: -16, radius: 1.1 },
    { id: 'barrels_stadium_s', type: 'metal_barrel', x: 8, z: 16, radius: 1.1 },
  ],

  // Arena 6: Frozen Arena (Packed snow mound, ice boulders, frozen machinery)
  arena_6: [
    { id: 'ice_snow_mound', type: 'ramp', x: 0, z: 0, radius: 4.5, width: 8.0, length: 7.0, rotation: 0, height: 1.9 },
    { id: 'ice_boulder_nw', type: 'scrap_wreck', x: -18, z: -9, radius: 2.5 },
    { id: 'ice_boulder_ne', type: 'scrap_wreck', x: 18, z: -9, radius: 2.5 },
    { id: 'ice_boulder_sw', type: 'scrap_wreck', x: -18, z: 9, radius: 2.5 },
    { id: 'ice_boulder_se', type: 'scrap_wreck', x: 18, z: 9, radius: 2.5 },
    { id: 'frozen_wreck_w', type: 'scrap_wreck', x: -26, z: 0, radius: 2.8 },
    { id: 'frozen_wreck_e', type: 'scrap_wreck', x: 26, z: 0, radius: 2.8 },
    { id: 'frozen_barrels_n', type: 'metal_barrel', x: 0, z: -16, radius: 1.2 },
    { id: 'frozen_barrels_s', type: 'metal_barrel', x: 0, z: 16, radius: 1.2 },
  ],

  // Arena 7: Industrial Death Ring (Enclosed steel cage, central hazard pylon, crushers)
  arena_7: [
    { id: 'central_fire_pylon', type: 'concrete_block', x: 0, z: 0, radius: 2.2, width: 3.0, length: 3.0, rotation: Math.PI / 4 },
    { id: 'crusher_pillar_nw', type: 'concrete_block', x: -13, z: -8, radius: 2.2, width: 3.0, length: 2.0, rotation: 0 },
    { id: 'crusher_pillar_ne', type: 'concrete_block', x: 13, z: -8, radius: 2.2, width: 3.0, length: 2.0, rotation: 0 },
    { id: 'crusher_pillar_sw', type: 'concrete_block', x: -13, z: 8, radius: 2.2, width: 3.0, length: 2.0, rotation: 0 },
    { id: 'crusher_pillar_se', type: 'concrete_block', x: 13, z: 8, radius: 2.2, width: 3.0, length: 2.0, rotation: 0 },
    { id: 'molten_barrel_w', type: 'metal_barrel', x: -20, z: 0, radius: 1.3 },
    { id: 'molten_barrel_e', type: 'metal_barrel', x: 20, z: 0, radius: 1.3 },
  ],
};

export function getArenaObstacles(arenaId: ArenaId): ArenaObstacle[] {
  return ARENA_OBSTACLE_SETS[arenaId] || ARENA_OBSTACLE_SETS.arena_1;
}

export const ARENA_OBSTACLES: ArenaObstacle[] = ARENA_OBSTACLE_SETS.arena_1;

// ── CANONICAL THREE.JS VEHICLE COORDINATE SYSTEM ───────────
/**
 * CANONICAL CONVENTION:
 * World:
 *   X = Left / Right
 *   Y = Up (Grounded at 0)
 *   Z = Depth (Forward / Rear)
 *
 * Vehicle Local Space:
 *   Forward = (0, 0, -1) (Local -Z)
 *   Rear    = (0, 0,  1) (Local +Z)
 *   Right   = (1, 0,  0) (Local +X)
 *   Left    = (-1, 0, 0) (Local -X)
 *
 * Rotated by Yaw theta around +Y:
 *   Forward = (-sin(theta), 0, -cos(theta))
 *   Right   = (cos(theta),  0, -sin(theta))
 *   Left    = (-cos(theta), 0, sin(theta))
 *   Rear    = (sin(theta),  0, cos(theta))
 */
export function getVehicleForward(yaw: number): { x: number; z: number } {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

export function getVehicleRight(yaw: number): { x: number; z: number } {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

// ── 2D ORIENTED BOUNDING BOX (OBB) & SAT ───────────────────
export interface OrientedBoundingBox2D {
  x: number;
  z: number;
  halfLength: number; // along local forward/rear (-Z/+Z)
  halfWidth: number;  // along local left/right (-X/+X)
  rotation: number;   // yaw in radians
}

export interface SATResult {
  colliding: boolean;
  normal: { x: number; z: number }; // Unit vector pointing from A toward B
  penetration: number;
  contactX: number;
  contactZ: number;
}

export function getVehicleOBB(v: VehicleState, margin: number = COLLISION_MARGIN): OrientedBoundingBox2D {
  return {
    x: v.x,
    z: v.z,
    halfLength: VEH_HALF_LEN + margin,
    halfWidth: VEH_HALF_WID + margin,
    rotation: v.rotationY,
  };
}

export function getOBBCorners(obb: OrientedBoundingBox2D): { x: number; z: number }[] {
  const fwd = getVehicleForward(obb.rotation);
  const rgt = getVehicleRight(obb.rotation);
  const hl = obb.halfLength;
  const hw = obb.halfWidth;

  return [
    { x: obb.x + fwd.x * hl + rgt.x * hw, z: obb.z + fwd.z * hl + rgt.z * hw }, // Front Right
    { x: obb.x + fwd.x * hl - rgt.x * hw, z: obb.z + fwd.z * hl - rgt.z * hw }, // Front Left
    { x: obb.x - fwd.x * hl - rgt.x * hw, z: obb.z - fwd.z * hl - rgt.z * hw }, // Rear Left
    { x: obb.x - fwd.x * hl + rgt.x * hw, z: obb.z - fwd.z * hl + rgt.z * hw }, // Rear Right
  ];
}

export function getOBBAxes(obb: OrientedBoundingBox2D): [number, number][] {
  const fwd = getVehicleForward(obb.rotation);
  const rgt = getVehicleRight(obb.rotation);
  return [
    [fwd.x, fwd.z],
    [rgt.x, rgt.z],
  ];
}

/**
 * 2D Separating Axis Theorem (SAT) between two Oriented Bounding Boxes.
 * Returns contact normal pointing from A towards B, penetration depth, and real contact point.
 */
export function satOBB2D(a: OrientedBoundingBox2D, b: OrientedBoundingBox2D): SATResult | null {
  const aAxes = getOBBAxes(a);
  const bAxes = getOBBAxes(b);
  const axes = [...aAxes, ...bAxes];

  const dx = b.x - a.x;
  const dz = b.z - a.z;

  let minOverlap = Infinity;
  let minNx = 0;
  let minNz = 0;

  const projectOBB = (
    obb: OrientedBoundingBox2D,
    nx: number,
    nz: number
  ): number => {
    const fwd = getVehicleForward(obb.rotation);
    const rgt = getVehicleRight(obb.rotation);
    return (
      Math.abs(fwd.x * nx + fwd.z * nz) * obb.halfLength +
      Math.abs(rgt.x * nx + rgt.z * nz) * obb.halfWidth
    );
  };

  for (const [nx, nz] of axes) {
    const lenSq = nx * nx + nz * nz;
    if (lenSq < 0.00001) continue;
    const len = Math.sqrt(lenSq);
    const unx = nx / len;
    const unz = nz / len;

    const projA = projectOBB(a, unx, unz);
    const projB = projectOBB(b, unx, unz);
    const dist = Math.abs(dx * unx + dz * unz);
    const overlap = projA + projB - dist;

    if (overlap <= 0.0001) {
      return null; // Separating axis found -> No collision
    }

    if (overlap < minOverlap) {
      minOverlap = overlap;
      // Normal points from A towards B
      const dot = dx * unx + dz * unz;
      const sign = dot >= 0 ? 1 : -1;
      minNx = unx * sign;
      minNz = unz * sign;
    }
  }

  if (minOverlap === Infinity || minOverlap <= 0) return null;

  // Real contact point estimation along the collision boundary between A and B
  const contactX = a.x + minNx * (a.halfLength * 0.7);
  const contactZ = a.z + minNz * (a.halfLength * 0.7);

  return {
    colliding: true,
    normal: { x: minNx, z: minNz },
    penetration: minOverlap,
    contactX,
    contactZ,
  };
}

// ── RAMP SURFACE SYSTEM & HEIGHT QUERIES ───────────────────
export interface RampSurfaceQuery {
  inside: boolean;
  height: number;
  normalX: number;
  normalY: number;
  normalZ: number;
}

export function getRampSurfaceAt(
  worldX: number,
  worldZ: number,
  ramp: ArenaObstacle | ObstacleCollider
): RampSurfaceQuery {
  const rot = ramp.rotation || 0;
  const cosR = Math.cos(-rot);
  const sinR = Math.sin(-rot);

  const dx = worldX - ramp.x;
  const dz = worldZ - ramp.z;

  const lx = dx * cosR - dz * sinR;
  const lz = dx * sinR + dz * cosR;

  let width = 8.5;
  let length = 7.0;
  let height = 2.2;

  if ('width' in ramp && typeof ramp.width === 'number') {
    width = ramp.width;
  } else if ('halfWidth' in ramp && typeof ramp.halfWidth === 'number') {
    width = ramp.halfWidth * 2;
  }

  if ('length' in ramp && typeof ramp.length === 'number') {
    length = ramp.length;
  } else if ('halfLength' in ramp && typeof ramp.halfLength === 'number') {
    length = ramp.halfLength * 2;
  }

  if ('height' in ramp && typeof ramp.height === 'number') {
    height = ramp.height;
  } else if ('rampHeight' in ramp && typeof ramp.rampHeight === 'number') {
    height = ramp.rampHeight;
  }

  const halfW = width / 2;
  const halfL = length / 2;

  if (Math.abs(lx) <= halfW && Math.abs(lz) <= halfL) {
    const t = Math.max(0, Math.min(1, (halfL - lz) / length));
    const surfaceH = t * height;

    const slopeAngle = Math.atan2(height, length);
    const locNy = Math.cos(slopeAngle);
    const locNz = Math.sin(slopeAngle);

    const cosF = Math.cos(rot);
    const sinF = Math.sin(rot);
    const worldNx = -locNz * sinF;
    const worldNy = locNy;
    const worldNz = locNz * cosF;

    return {
      inside: true,
      height: surfaceH,
      normalX: worldNx,
      normalY: worldNy,
      normalZ: worldNz,
    };
  }

  return {
    inside: false,
    height: 0,
    normalX: 0,
    normalY: 1,
    normalZ: 0,
  };
}

export function getArenaSurfaceAt(
  worldX: number,
  worldZ: number,
  obstacles?: (ArenaObstacle | ObstacleCollider)[]
): { height: number; normalX: number; normalY: number; normalZ: number; isRamp: boolean } {
  if (obstacles) {
    for (const ob of obstacles) {
      if (ob.type === 'ramp') {
        const rampQuery = getRampSurfaceAt(worldX, worldZ, ob);
        if (rampQuery.inside) {
          return {
            height: rampQuery.height,
            normalX: rampQuery.normalX,
            normalY: rampQuery.normalY,
            normalZ: rampQuery.normalZ,
            isRamp: true,
          };
        }
      }
    }
  }

  return { height: 0, normalX: 0, normalY: 1, normalZ: 0, isRamp: false };
}

export function queryVehicleWheelSupport(
  v: VehicleState,
  obstacles?: (ArenaObstacle | ObstacleCollider)[]
): { chassisY: number; pitch: number; roll: number; isRampSupported: boolean } {
  const fwd = getVehicleForward(v.rotationY);
  const rgt = getVehicleRight(v.rotationY);

  const wheelOffsets = [
    { x: -1.02, z: -1.45 }, // FL (Front Left)
    { x:  1.02, z: -1.45 }, // FR (Front Right)
    { x: -1.02, z:  1.45 }, // RL (Rear Left)
    { x:  1.02, z:  1.45 }, // RR (Rear Right)
  ];

  let hFL = 0, hFR = 0, hRL = 0, hRR = 0;
  let onRamp = false;

  for (let i = 0; i < wheelOffsets.length; i++) {
    const wo = wheelOffsets[i];
    const wx = v.x + rgt.x * wo.x - fwd.x * wo.z;
    const wz = v.z + rgt.z * wo.x - fwd.z * wo.z;

    const surf = getArenaSurfaceAt(wx, wz, obstacles);
    if (surf.isRamp) onRamp = true;

    if (i === 0) hFL = surf.height;
    else if (i === 1) hFR = surf.height;
    else if (i === 2) hRL = surf.height;
    else if (i === 3) hRR = surf.height;
  }

  const hFront = (hFL + hFR) * 0.5;
  const hRear  = (hRL + hRR) * 0.5;
  const hLeft  = (hFL + hRL) * 0.5;
  const hRight = (hFR + hRR) * 0.5;

  const chassisY = (hFront + hRear) * 0.5;
  const pitch = -Math.atan2(hFront - hRear, 2.90);
  const roll  = Math.atan2(hRight - hLeft, 2.04);

  return { chassisY, pitch, roll, isRampSupported: onRamp };
}

// ── STATIC OBSTACLES & PERIMETER COLLISION ─────────────────
export function resolveVehicleVsStaticObstacles(
  v: VehicleState,
  colliders: ObstacleCollider[],
  nowTime: number,
  lastImpactPairMap: Map<string, number>,
  onImpact?: (speed: number, colId: string) => void
): void {
  const vehOBB = getVehicleOBB(v);
  const fwd = getVehicleForward(v.rotationY);
  const rgt = getVehicleRight(v.rotationY);

  for (const col of colliders) {
    if (col.type === 'ramp') continue; // Driveable surface

    if (col.type === 'box' || col.type === 'wall') {
      const boxOBB: OrientedBoundingBox2D = {
        x: col.x,
        z: col.z,
        halfWidth: col.halfWidth || 1.2,
        halfLength: col.halfLength || 0.6,
        rotation: col.rotation || 0,
      };

      const sat = satOBB2D(boxOBB, vehOBB);
      if (sat && sat.colliding) {
        const { normal, penetration } = sat;
        v.x += normal.x * penetration;
        v.z += normal.z * penetration;

        const vn = v.vx * normal.x + v.vz * normal.z;
        if (vn < 0) {
          const restitution = 0.20;
          const friction = 0.88;
          const tangentX = -normal.z;
          const tangentZ = normal.x;
          const vt = v.vx * tangentX + v.vz * tangentZ;

          v.vx = normal.x * (-vn * restitution) + tangentX * (vt * friction);
          v.vz = normal.z * (-vn * restitution) + tangentZ * (vt * friction);

          const impactSpeed = Math.abs(vn);
          const impactKey = `${v.id}_${col.id}`;
          const lastTime = lastImpactPairMap.get(impactKey) || 0;
          if (nowTime - lastTime > 300 && impactSpeed > 3.0) {
            lastImpactPairMap.set(impactKey, nowTime);
            if (onImpact) onImpact(impactSpeed, col.id);
          }
        }
      }
    } else if (col.type === 'cylinder') {
      const cylR = col.radius || 1.2;
      const dx = col.x - v.x;
      const dz = col.z - v.z;

      const lx = dx * rgt.x + dz * rgt.z;
      const lz = -(dx * fwd.x + dz * fwd.z);

      const clx = Math.max(-vehOBB.halfWidth, Math.min(vehOBB.halfWidth, lx));
      const clz = Math.max(-vehOBB.halfLength, Math.min(vehOBB.halfLength, lz));

      const diffX = lx - clx;
      const diffZ = lz - clz;
      const distSq = diffX * diffX + diffZ * diffZ;

      if (distSq < cylR * cylR) {
        let locNx = 0, locNz = 0, pen = 0;
        if (distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          locNx = -diffX / dist;
          locNz = -diffZ / dist;
          pen = cylR - dist;
        } else {
          const penX = vehOBB.halfWidth + cylR - Math.abs(lx);
          const penZ = vehOBB.halfLength + cylR - Math.abs(lz);
          if (penX < penZ) {
            locNx = -Math.sign(lx || 1);
            pen = penX;
          } else {
            locNz = -Math.sign(lz || 1);
            pen = penZ;
          }
        }

        const worldNx = locNx * rgt.x - locNz * fwd.x;
        const worldNz = locNx * rgt.z - locNz * fwd.z;

        v.x += worldNx * pen;
        v.z += worldNz * pen;

        const vn = v.vx * worldNx + v.vz * worldNz;
        if (vn < 0) {
          const restitution = col.id.includes('tires') ? 0.45 : col.id.includes('barrel') ? 0.35 : 0.20;
          const friction = 0.85;
          const tangentX = -worldNz;
          const tangentZ = worldNx;
          const vt = v.vx * tangentX + v.vz * tangentZ;

          v.vx = worldNx * (-vn * restitution) + tangentX * (vt * friction);
          v.vz = worldNz * (-vn * restitution) + tangentZ * (vt * friction);

          const impactSpeed = Math.abs(vn);
          const impactKey = `${v.id}_${col.id}`;
          const lastTime = lastImpactPairMap.get(impactKey) || 0;
          if (nowTime - lastTime > 300 && impactSpeed > 3.0) {
            lastImpactPairMap.set(impactKey, nowTime);
            if (onImpact) onImpact(impactSpeed, col.id);
          }
        }
      }
    }
  }
}

export function resolveVehicleVsPerimeter(
  v: VehicleState,
  arena: ArenaDefinition | number,
  nowTime: number = Date.now(),
  lastImpactPairMap?: Map<string, number>,
  onImpact?: (speed: number, colId: string) => void
): void {
  let boundType: ArenaBoundaryType = 'oval';
  let a = 44.0;
  let b = 32.0;

  if (typeof arena === 'number') {
    const scale = (arena || 42) / 42;
    a = 44.0 * scale - 0.2;
    b = 32.0 * scale - 0.2;
  } else if (arena) {
    boundType = arena.boundaryType || 'oval';
    a = (arena.boundaryHalfA || 44.0) - 0.2;
    b = (arena.boundaryHalfB || 32.0) - 0.2;
  }

  const corners = getOBBCorners(getVehicleOBB(v));
  const points = [...corners, { x: v.x, z: v.z }];
  let hitWall = false;
  let maxImpactSpeed = 0;

  if (boundType === 'box') {
    for (const pt of points) {
      if (Math.abs(pt.x) > a) {
        const pen = Math.abs(pt.x) - a;
        const sign = Math.sign(pt.x);
        v.x -= sign * pen;
        if (v.vx * sign > 0) {
          maxImpactSpeed = Math.max(maxImpactSpeed, Math.abs(v.vx));
          v.vx *= -0.25;
          hitWall = true;
        }
      }
      if (Math.abs(pt.z) > b) {
        const pen = Math.abs(pt.z) - b;
        const sign = Math.sign(pt.z);
        v.z -= sign * pen;
        if (v.vz * sign > 0) {
          maxImpactSpeed = Math.max(maxImpactSpeed, Math.abs(v.vz));
          v.vz *= -0.25;
          hitWall = true;
        }
      }
    }
  } else if (boundType === 'circle') {
    const maxR = a;
    for (const pt of points) {
      const dist = Math.hypot(pt.x, pt.z);
      if (dist > maxR && dist > 0.0001) {
        const enx = pt.x / dist;
        const enz = pt.z / dist;
        const pen = dist - maxR;
        v.x -= enx * pen;
        v.z -= enz * pen;
        const vn = v.vx * enx + v.vz * enz;
        if (vn > 0) {
          maxImpactSpeed = Math.max(maxImpactSpeed, vn);
          v.vx -= 1.35 * vn * enx;
          v.vz -= 1.35 * vn * enz;
          hitWall = true;
        }
      }
    }
  } else {
    // Oval (Elliptical) boundary
    for (const pt of points) {
      const normDist = Math.sqrt((pt.x / a) * (pt.x / a) + (pt.z / b) * (pt.z / b));
      if (normDist > 0.985 && normDist > 0.0001) {
        const nxRaw = pt.x / (a * a);
        const nzRaw = pt.z / (b * b);
        const len = Math.sqrt(nxRaw * nxRaw + nzRaw * nzRaw);
        const enx = nxRaw / (len || 1);
        const enz = nzRaw / (len || 1);

        const bx = pt.x / normDist;
        const bz = pt.z / normDist;
        const overlap = Math.sqrt((pt.x - bx) * (pt.x - bx) + (pt.z - bz) * (pt.z - bz));

        v.x -= enx * overlap;
        v.z -= enz * overlap;

        const vn = v.vx * enx + v.vz * enz;
        if (vn > 0) {
          maxImpactSpeed = Math.max(maxImpactSpeed, vn);
          v.vx -= 1.35 * vn * enx;
          v.vz -= 1.35 * vn * enz;
          hitWall = true;
        }
      }
    }
  }

  if (hitWall && maxImpactSpeed > 2.0) {
    const impactKey = `${v.id}_perimeter_wall`;
    const lastTime = lastImpactPairMap ? lastImpactPairMap.get(impactKey) || 0 : 0;
    if (nowTime - lastTime > 300) {
      if (lastImpactPairMap) lastImpactPairMap.set(impactKey, nowTime);
      if (onImpact) onImpact(maxImpactSpeed, 'perimeter_wall');
    }
  }
}

// ── PERSISTENT CONTACT MANIFOLD & DISCRETE IMPACT EVENT SYSTEM ─────────
export interface VehicleContactRecord {
  isColliding: boolean;
  lastImpactTime: number;
  lastImpactSpeed: number;
  damageAppliedForCurrentImpact: boolean;
}

export interface CollisionResult {
  hasCollision: boolean;
  isNewImpactEvent: boolean;
  damageA: number;
  damageB: number;
  impactX: number;
  impactY: number;
  impactZ: number;
  relativeVelocity: number;
  impactSeverity: 'NORMAL' | 'HEAVY' | 'CRITICAL';
  normal: { x: number; z: number };
}

/**
 * Calculates deterministic bounded damage tiers based on normal impact speed.
 * Tuned strictly for the 100 HP vehicle durability model.
 */
export function calculateImpactDamage(
  impactSpeed: number,
  attackerRam: number,
  defenderArmor: number
): number {
  if (impactSpeed < 1.5) return 0; // Resting contact / minor nudge -> 0 damage

  let tierBaseDamage = 0;
  if (impactSpeed >= 16.0) {
    // Severe high-speed head-on ram
    tierBaseDamage = 25 + Math.min(7, (impactSpeed - 16.0) * 1.0); // 25 - 32 HP
  } else if (impactSpeed >= 11.0) {
    // Heavy ram
    tierBaseDamage = 16 + (impactSpeed - 11.0) * 1.6; // 16 - 24 HP
  } else if (impactSpeed >= 7.0) {
    // Moderate impact
    tierBaseDamage = 9 + (impactSpeed - 7.0) * 1.5; // 9 - 15 HP
  } else if (impactSpeed >= 4.0) {
    // Light hit
    tierBaseDamage = 4 + (impactSpeed - 4.0) * 1.2; // 4 - 8 HP
  } else {
    // Low-speed strike (1.5 - 4.0 m/s)
    tierBaseDamage = 2 + (impactSpeed - 1.5) * 0.8; // 2 - 4 HP
  }

  const statMultiplier = (attackerRam / 60) / (defenderArmor / 60);
  const finalDamage = Math.round(tierBaseDamage * statMultiplier);
  return Math.max(1, Math.min(34, finalDamage)); // Hard-capped at 34 HP per single collision event
}

/**
 * Authoritative SAT OBB Vehicle-vs-Vehicle Collision & Contact Tracker.
 * 1. Resolves penetration immediately (MTV).
 * 2. Exchanges impulse momentum if vehicles are approaching.
 * 3. Emits a discrete damage event ONCE per distinct collision impact (preventing 10x damage amplification).
 */
export function checkVehicleCollision(
  a: VehicleState,
  b: VehicleState,
  nowTime: number = Date.now(),
  contactTrackerMap?: Map<string, VehicleContactRecord>
): CollisionResult | null {
  const obbA = getVehicleOBB(a);
  const obbB = getVehicleOBB(b);

  const sat = satOBB2D(obbA, obbB);
  const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
  let contact = contactTrackerMap ? contactTrackerMap.get(pairKey) : undefined;

  if (!sat || !sat.colliding) {
    // Vehicles are not touching -> reset contact state so next collision re-arms
    if (contact) {
      contact.isColliding = false;
      contact.damageAppliedForCurrentImpact = false;
    }
    return null;
  }

  if (!contact && contactTrackerMap) {
    contact = {
      isColliding: true,
      lastImpactTime: 0,
      lastImpactSpeed: 0,
      damageAppliedForCurrentImpact: false,
    };
    contactTrackerMap.set(pairKey, contact);
  }

  const { normal, penetration, contactX, contactZ } = sat;

  const aAlive = !a.isDestroyed && a.hp > 0;
  const bAlive = !b.isDestroyed && b.hp > 0;

  const massTotal = (a.weight || 1500) + (b.weight || 1500);
  let pushA = (b.weight || 1500) / massTotal;
  let pushB = (a.weight || 1500) / massTotal;

  // Wrecked cars behave as stationary obstacles (0% push on wrecked, 100% on active)
  if (!aAlive && bAlive) { pushA = 0.0; pushB = 1.0; }
  else if (aAlive && !bAlive) { pushA = 1.0; pushB = 0.0; }

  // 1. Stage 1: Immediate MTV Penetration Separation (Position Correction)
  a.x -= normal.x * penetration * pushA;
  a.z -= normal.z * penetration * pushA;
  b.x += normal.x * penetration * pushB;
  b.z += normal.z * penetration * pushB;

  // 2. Stage 2: Relative Velocity & Approach Speed Calculation along Normal
  // normal points from A toward B
  // When A moves toward B: (vA - vB) . normal > 0
  const rvx = a.vx - b.vx;
  const rvz = a.vz - b.vz;
  const approachSpeed = rvx * normal.x + rvz * normal.z;

  // 3. Stage 3: Collision Impulse (Exchanging Momentum)
  // Only applied when vehicles are actually approaching (approachSpeed > 0.1 m/s)
  if (approachSpeed > 0.1) {
    const relSpeed = approachSpeed;
    const restitution = 0.40;
    const reducedMass = ((a.weight || 1500) * (b.weight || 1500)) / massTotal;
    const impulse = relSpeed * (1 + restitution) * (reducedMass / 1400);

    if (aAlive) {
      a.vx -= normal.x * impulse * pushA;
      a.vz -= normal.z * impulse * pushA;
      a.speed = Math.sqrt(a.vx * a.vx + a.vz * a.vz);
    }
    if (bAlive) {
      b.vx += normal.x * impulse * pushB;
      b.vz += normal.z * impulse * pushB;
      b.speed = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    }

    // 4. Stage 4: Discrete Damage Event Emission (Single Event per Physical Strike)
    let isNewImpactEvent = false;
    let damageA = 0;
    let damageB = 0;

    const timeSinceLastImpact = contact ? nowTime - contact.lastImpactTime : 1000;
    const isFirstContact = contact ? !contact.isColliding || !contact.damageAppliedForCurrentImpact : true;
    const isSuddenSpeedSpike = contact ? relSpeed > (contact.lastImpactSpeed + 3.0) : false;

    if (relSpeed >= 1.5 && (isFirstContact || isSuddenSpeedSpike || timeSinceLastImpact > 350)) {
      isNewImpactEvent = true;

      if (contact) {
        contact.isColliding = true;
        contact.lastImpactTime = nowTime;
        contact.lastImpactSpeed = relSpeed;
        contact.damageAppliedForCurrentImpact = true;
      }

      // Determine attacker vs defender based on forward approach speed into collision
      const aForwardSpeed = a.vx * normal.x + a.vz * normal.z;
      const bForwardSpeed = -(b.vx * normal.x + b.vz * normal.z);

      if (aForwardSpeed > 2.0 && bForwardSpeed > 2.0) {
        // Head-on crash: both cars moving forward into collision
        damageB = bAlive ? calculateImpactDamage(relSpeed * 0.8, a.ramStat || 60, b.armor || 60) : 0;
        damageA = aAlive ? calculateImpactDamage(relSpeed * 0.8, b.ramStat || 60, a.armor || 60) : 0;
      } else if (aForwardSpeed >= bForwardSpeed) {
        // A is primary rammer into B: B takes damage, A takes minimal recoil at extreme speeds
        damageB = bAlive ? calculateImpactDamage(relSpeed, a.ramStat || 60, b.armor || 60) : 0;
        damageA = (aAlive && relSpeed > 12.0) ? Math.max(1, Math.round(damageB * 0.15)) : 0;
      } else {
        // B is primary rammer into A: A takes damage, B takes minimal recoil at extreme speeds
        damageA = aAlive ? calculateImpactDamage(relSpeed, b.ramStat || 60, a.armor || 60) : 0;
        damageB = (bAlive && relSpeed > 12.0) ? Math.max(1, Math.round(damageA * 0.15)) : 0;
      }
      // Note: HP is authoritative from server (derby_collision_effect) — never mutated directly here
    } else if (contact) {
      contact.isColliding = true;
    }

    const severity = relSpeed > 14 ? 'CRITICAL' : relSpeed > 7 ? 'HEAVY' : 'NORMAL';

    return {
      hasCollision: true,
      isNewImpactEvent,
      damageA,
      damageB,
      impactX: contactX,
      impactY: ((a.y || 0) + (b.y || 0)) * 0.5 + 0.6,
      impactZ: contactZ,
      relativeVelocity: relSpeed,
      impactSeverity: severity,
      normal,
    };
  }

  // Vehicles touching but separating or resting (approachSpeed <= 0.1) -> 0 damage, penetration only
  if (contact) {
    contact.isColliding = true;
  }

  return {
    hasCollision: true,
    isNewImpactEvent: false,
    damageA: 0,
    damageB: 0,
    impactX: contactX,
    impactY: ((a.y || 0) + (b.y || 0)) * 0.5 + 0.6,
    impactZ: contactZ,
    relativeVelocity: Math.max(0, approachSpeed),
    impactSeverity: 'NORMAL',
    normal,
  };
}

// ── AUTHORITATIVE VEHICLE INTEGRATION WITH SUBSTEPS & CCD ───
export function updateVehiclePhysics(
  v: VehicleState,
  input: DriverInput,
  arena: ArenaDefinition,
  colliders: ObstacleCollider[] = [],
  dt: number = 0.016,
  nowTime: number = Date.now(),
  lastImpactPairMap: Map<string, number> = new Map(),
  onObstacleImpact?: (speed: number, colId: string) => void
): PhysicsUpdateResult {
  let justJumped = false;
  let justLanded = false;
  let landingSpeed = 0;
  let obstacleHit: string | undefined;

  const friction = arena.surfaceFriction || 1.0;
  const maxForwardSpeed = (v.topSpeed / 100) * 22.0; // ~79.2 KM/H
  const maxReverseSpeed = (v.topSpeed / 100) * 8.0;  // ~28.8 KM/H
  const accelPower = (v.accelPower / 100) * 14.0 * friction;
  const brakeDecel = 22.0;
  const dragRate = 2.4;

  if (v.jumpCooldown > 0) {
    v.jumpCooldown -= dt;
  }

  // Wrecked vehicle coasting with drag and physical collision presence
  if (v.isDestroyed || v.hp <= 0) {
    v.vx *= Math.max(0, 1 - dragRate * 2.5 * dt);
    v.vz *= Math.max(0, 1 - dragRate * 2.5 * dt);
    v.speed = Math.sqrt(v.vx * v.vx + v.vz * v.vz);
    v.x += v.vx * dt;
    v.z += v.vz * dt;
    resolveVehicleVsStaticObstacles(v, colliders, nowTime, lastImpactPairMap);
    resolveVehicleVsPerimeter(v, arena, nowTime, lastImpactPairMap);

    const groundQuery = queryVehicleWheelSupport(v, colliders);
    v.y = groundQuery.chassisY;
    v.pitch = groundQuery.pitch;
    v.roll = groundQuery.roll;
    return { justJumped: false, justLanded: false, landingSpeed: 0 };
  }

  const fwd = getVehicleForward(v.rotationY);
  const rgt = getVehicleRight(v.rotationY);

  let forwardSpeed = v.vx * fwd.x + v.vz * fwd.z;
  let lateralSpeed = v.vx * rgt.x + v.vz * rgt.z;

  // 1. Throttle / Braking / Drag
  if (input.throttle > 0) {
    if (forwardSpeed < -0.5) {
      forwardSpeed += brakeDecel * dt;
    } else {
      forwardSpeed += input.throttle * accelPower * dt;
    }
  } else if (input.throttle < 0) {
    if (forwardSpeed > 0.5) {
      forwardSpeed -= brakeDecel * dt;
    } else {
      forwardSpeed += input.throttle * (accelPower * 0.65) * dt;
    }
  } else {
    const decay = Math.max(0, 1 - dragRate * dt);
    forwardSpeed *= decay;
    lateralSpeed *= decay;
  }

  forwardSpeed = Math.max(-maxReverseSpeed, Math.min(maxForwardSpeed, forwardSpeed));

  // 2. Speed-Sensitive Progressive Steering
  // Left (input = -1): yaw INCREASES -> turns to -X
  // Right (input = +1): yaw DECREASES -> turns to +X
  if (Math.abs(forwardSpeed) > 0.25) {
    const speedRatio = Math.min(1.0, Math.abs(forwardSpeed) / maxForwardSpeed);
    const turnSensitivity = (v.turnPower / 100) * 3.2 * (1.15 - speedRatio * 0.40) * (input.handbrake ? 1.35 : 1.0);
    const steerDir = forwardSpeed >= 0 ? 1 : -1;
    v.rotationY -= input.steering * turnSensitivity * steerDir * dt;
  }

  // 3. Lateral Tire Grip & Handbrake Drift
  if (input.handbrake) {
    lateralSpeed *= Math.pow(0.92, dt * 60);
    v.isDrifting = Math.abs(forwardSpeed) > 3.0;
  } else {
    const gripFactor = 0.60 + (1 - friction) * 0.25;
    lateralSpeed *= Math.pow(gripFactor, dt * 60);
    v.isDrifting = friction < 0.65 && Math.abs(input.steering) > 0.35 && Math.abs(forwardSpeed) > 6.0;
  }

  // Re-orient velocity along updated facing vector
  const newFwd = getVehicleForward(v.rotationY);
  const newRgt = getVehicleRight(v.rotationY);

  v.vx = newFwd.x * forwardSpeed + newRgt.x * lateralSpeed;
  v.vz = newFwd.z * forwardSpeed + newRgt.z * lateralSpeed;
  v.speed = Math.sqrt(v.vx * v.vx + v.vz * v.vz);

  // 4. CCD Substep Integration (travel <= 0.08m per substep)
  const travelDist = Math.max(v.speed * dt, 0.001);
  const numSubsteps = Math.min(16, Math.max(1, Math.ceil(travelDist / 0.08)));
  const subDt = dt / numSubsteps;

  for (let s = 0; s < numSubsteps; s++) {
    v.x += v.vx * subDt;
    v.z += v.vz * subDt;

    resolveVehicleVsStaticObstacles(v, colliders, nowTime, lastImpactPairMap, (speed, colId) => {
      obstacleHit = colId;
      if (onObstacleImpact) onObstacleImpact(speed, colId);
    });
    resolveVehicleVsPerimeter(v, arena, nowTime, lastImpactPairMap, (speed, colId) => {
      obstacleHit = colId;
      if (onObstacleImpact) onObstacleImpact(speed, colId);
    });
  }

  // 5. Four-Wheel Surface Support & Ramp Climbing / Jumping
  const wheelSupport = queryVehicleWheelSupport(v, colliders);

  if (v.isAirborne || v.y > wheelSupport.chassisY + 0.08) {
    v.vy -= 18.0 * dt; // Gravity
    v.y += v.vy * dt;

    if (v.y <= wheelSupport.chassisY) {
      v.y = wheelSupport.chassisY;
      v.vy = 0;
      v.isAirborne = false;
      justLanded = true;
      landingSpeed = v.speed;
    }
  } else {
    v.y = wheelSupport.chassisY;
    v.vy = 0;
    v.isAirborne = false;

    if (wheelSupport.isRampSupported && v.jumpCooldown <= 0 && forwardSpeed > 7.5) {
      for (const ob of colliders) {
        if (ob.type === 'ramp') {
          const dx = v.x - ob.x;
          const dz = v.z - ob.z;
          if (dz < -1.5 && Math.abs(dx) < 3.8) {
            v.isAirborne = true;
            v.vy = 6.0 + (forwardSpeed / maxForwardSpeed) * 6.5;
            v.jumpCooldown = 1.8;
            justJumped = true;
          }
        }
      }
    }
  }

  const accelInertiaPitch = -((forwardSpeed - (v.speed || 0)) / dt) * 0.002;
  v.pitch = wheelSupport.pitch + Math.max(-0.12, Math.min(0.12, accelInertiaPitch));
  v.roll = wheelSupport.roll + (-input.steering * (v.speed / 18) * 0.10);

  return { justJumped, justLanded, landingSpeed, obstacleHit };
}
