export type GameMode = 'SOLO' | 'MULTIPLAYER';
export type AIDifficulty = 'EASY' | 'MEDIUM' | 'DIFFICULT';
export type MatchState = 'MENU' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'FINISHED';

export type AIState =
  | 'IDLE'
  | 'SEARCH_TARGET'
  | 'CHASE'
  | 'ATTACK'
  | 'EVADE'
  | 'RECOVER'
  | 'LOW_HEALTH'
  | 'TARGET_WEAK_PLAYER'
  | 'DESTROYED';

export type VehicleId =
  | 'road_crusher'
  | 'iron_tanker'
  | 'apex_phantom'
  | 'armored_juggernaut'
  | 'starter'
  | 'muscle'
  | 'heavy'
  | 'rally'
  | 'armored';

export interface VehicleStats {
  speed: number;        // 1-100
  acceleration: number; // 1-100
  handling: number;     // 1-100
  armor: number;        // 1-100
  ram: number;          // 1-100
  weight: number;       // kg modifier (1000 - 3400)
}

export interface VehicleUpgrades {
  engine: number;   // Level 0-5
  armor: number;    // Level 0-5
  ram: number;      // Level 0-5
  handling: number; // Level 0-5
  brakes: number;   // Level 0-5
}

export interface VehicleDefinition {
  id: VehicleId;
  name: string;
  tagline: string;
  description: string;
  price: number;
  unlockedByDefault: boolean;
  color: string;
  accentColor: string;
  baseStats: VehicleStats;
  width: number;
  length: number;
  height: number;
}

export type ArenaId =
  | 'arena_1'
  | 'arena_2'
  | 'arena_3'
  | 'arena_4'
  | 'arena_5'
  | 'arena_6'
  | 'arena_7';

export interface ArenaSpawnPoint {
  x: number;
  z: number;
  rotationY: number;
}

export type ArenaBoundaryType = 'oval' | 'box' | 'circle';

export interface ArenaDefinition {
  id: ArenaId;
  index: number;
  name: string;
  environment: string;
  difficultyTag: 'Easy' | 'Easy / Medium' | 'Medium' | 'Medium / Difficult' | 'Difficult';
  description: string;
  features?: string[];
  surfaceFriction: number; // 1.0 standard, 0.45 ice
  radius: number;          // World radius units
  boundaryType: ArenaBoundaryType;
  boundaryHalfA: number;   // X half-extent (e.g. 44m)
  boundaryHalfB: number;   // Z half-extent (e.g. 32m)
  obstacleType: 'open' | 'tight' | 'ramp' | 'slippery' | 'obstacles';
  groundColor: string;
  skyColor: string;
  wallColor: string;
  fogColor: string;
  hasRamps: boolean;
  hasObstacles: boolean;
  spawnPoints: ArenaSpawnPoint[];
  lighting: {
    ambientColor: number;
    ambientIntensity: number;
    dirColor: number;
    dirIntensity: number;
    dirPos: [number, number, number];
    spotColor: number;
    spotIntensity: number;
  };
}

export interface ArenaObstacle {
  id: string;
  type: 'ramp' | 'mound' | 'tire_stack' | 'concrete_block' | 'metal_barrel' | 'scrap_wreck';
  x: number;
  z: number;
  radius: number;
  width?: number;
  length?: number;
  rotation?: number;
  height?: number;
}

export interface ObstacleCollider {
  id: string;
  type: 'cylinder' | 'box' | 'ramp' | 'wall';
  x: number;
  y: number;
  z: number;
  radius?: number;       // For cylinder colliders (pillars, tire stacks, barrels)
  halfWidth?: number;    // For box colliders (K-rails, concrete blocks, walls)
  halfLength?: number;   // For box colliders
  halfHeight?: number;
  rotation?: number;     // Yaw angle (radians)
  rampHeight?: number;   // Ramp slope apex height
}

export type AIPersonality = 'AGGRESSIVE' | 'OPPORTUNIST' | 'BRAWLER' | 'FLANKER';

export interface VehicleState {
  id: string;
  name: string;
  isPlayer: boolean;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
  aiState?: AIState;
  personality?: AIPersonality;
  decisionTimer?: number;
  vehicleId: VehicleId;
  color: string;
  accentColor: string;
  carNumber?: string;
  carTitle?: string;
  
  // World Space Coordinates & Motion
  x: number;          // World X
  y: number;          // World Y height (airborne elevation or ramp support)
  z: number;          // World Z
  rotationY: number;  // Facing angle in radians
  pitch?: number;     // Visual/ramp pitch angle (radians)
  roll?: number;      // Visual roll angle (radians)
  speed: number;      // Scalar speed
  vx: number;         // Velocity X
  vy: number;         // Velocity Y (jump vertical speed)
  vz: number;         // Velocity Z
  isDrifting: boolean;
  isAirborne: boolean;
  jumpCooldown: number;

  // Stats & Health
  hp: number;
  maxHp: number;
  armor: number;
  ramStat: number;
  weight: number;
  topSpeed: number;
  accelPower: number;
  turnPower: number;
  
  // Combat & Scoring
  damageDealt: number;
  hits: number;
  eliminations: number;
  score: number;
  combo: number;
  lastHitTime: number;
  isDestroyed: boolean;
  rank: number;
  connected?: boolean;  // false when remote player disconnects during a multiplayer match
  
  // AI Recovery Timer
  stuckTimer: number;
  reverseTimer: number;
  targetId?: string | null;
}

export interface HitNotification {
  id: string;
  text: string;
  type: 'NORMAL' | 'HEAVY' | 'CRITICAL' | 'ELIMINATION' | 'RAMP_JUMP';
  points: number;
  timestamp: number;
}

export interface MatchResult {
  rank: number;
  score: number;
  eliminations: number;
  damageDealt: number;
  survivalTime: number;
  isWin: boolean;
  coinsEarned: number;
  xpEarned: number;
  newArenaUnlocked: ArenaId | null;
}

export interface PlayerResult {
  userId: string;
  nickname: string;
  avatar?: string;
  rank: number;
  score: number;
  eliminations: number;
  damageDealt: number;
  hits: number;
  survivalTime: number;
  vehicleId: VehicleId;
  isLocalPlayer?: boolean;
}

export interface DerbyLobbyPlayer {
  userId: string;
  nickname: string;
  avatar?: string;
  isReady: boolean;
  role: 'HOST' | 'PLAYER';
  selectedCarId?: VehicleId;
  vehicleId?: VehicleId;
  assetReady?: boolean;
}

export interface DerbyRoomState {
  id: string;
  hostId: string;
  gameType: string;
  players: DerbyLobbyPlayer[];
  status: 'WAITING' | 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'FINISHED';
  seed?: number;
  startTime?: number;
  countdownValue?: number;
  settings?: {
    arenaId?: ArenaId;
    arenaIndex?: number;
    normalizedStats?: boolean;
    maxPlayers?: number;
  };
}

export type DamageLevel = 'CLEAN' | 'SCRATCHED' | 'DENTED' | 'CRUMPLED' | 'WRECKED';

export interface DebrisPiece {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  vRotX: number;
  vRotY: number;
  vRotZ: number;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
  type: 'bumper' | 'hood' | 'door' | 'wheel' | 'panel' | 'shard';
}

export interface CameraShake {
  intensity: number;
  duration: number;
  timeRemaining: number;
}

