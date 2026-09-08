'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  AIDifficulty,
  AIPersonality,
  ArenaDefinition,
  ArenaId,
  CameraShake,
  DebrisPiece,
  DerbyLobbyPlayer,
  HitNotification,
  MatchState,
  ObstacleCollider,
  VehicleId,
  VehicleState,
} from './types';
import {
  ARENAS,
  checkVehicleCollision,
  CollisionResult,
  computeEffectiveStats,
  DriverInput,
  updateVehiclePhysics,
  VEH_HEIGHT,
  VEH_LENGTH,
  VEH_WIDTH,
  VehicleContactRecord,
  VEHICLES,
} from './DerbyPhysicsEngine';
import { derbyAIController } from './DerbyAIController';
import { derbySoundSystem } from './DerbySoundSystem';
import { build3DArena, Derby3DArena } from './Derby3DArenaBuilder';
import {
  create3DVehicle,
  preloadDerbyVehicleGLB,
  resetVehicleVisualState,
  spawnImpactDebrisParts,
  update3DVehicleObject,
  Vehicle3DObject,
} from './Derby3DVehicleBuilder';
import { DerbyParticleSystem } from './DerbyParticleSystem';
import { socketService } from '@/lib/socket';

const MULTIPLAYER_CAR_PALETTES = [
  { color: '#dc2626', accent: '#2563eb', number: '23' }, // Player 1
  { color: '#0284c7', accent: '#38bdf8', number: '07' }, // Player 2
  { color: '#16a34a', accent: '#22c55e', number: '48' }, // Player 3
  { color: '#ea580c', accent: '#f97316', number: '99' }, // Player 4
  { color: '#9333ea', accent: '#a855f7', number: '33' }, // Player 5
  { color: '#eab308', accent: '#fde047', number: '19' }, // Player 6
  { color: '#db2777', accent: '#f472b6', number: '77' }, // Player 7
  { color: '#475569', accent: '#94a3b8', number: '00' }, // Player 8
];

export interface DemolitionDerbyCanvasProps {
  gameId?: string;
  arenaId: ArenaId;
  difficulty: AIDifficulty;
  playerVehicleId: VehicleId;
  playerUpgrades: any;
  isMultiplayer: boolean;
  localUserId: string;
  localNickname: string;
  roomPlayers?: DerbyLobbyPlayer[];
  /** Server-authoritative alive count (numerator). In multiplayer only. */
  serverAliveCount?: number;
  /** Server-authoritative total player count (denominator). In multiplayer only. */
  serverTotalPlayers?: number;
  onMatchComplete: (
    playerRank: number,
    playerScore: number,
    eliminations: number,
    damageDealt: number,
    survivalTime: number,
    isWin: boolean
  ) => void;
  onHudUpdate?: (playerHp: number, score: number, combo: number, opponentsAlive: number, timerSeconds: number, totalCombatants?: number) => void;
  onTransformSync?: (data: any) => void;
}

export function DemolitionDerbyCanvas({
  gameId,
  arenaId,
  difficulty,
  playerVehicleId,
  playerUpgrades,
  isMultiplayer,
  localUserId,
  localNickname,
  roomPlayers,
  serverAliveCount,
  serverTotalPlayers,
  onMatchComplete,
  onHudUpdate,
  onTransformSync,
}: DemolitionDerbyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

  const gameIdRef = useRef(gameId);
  gameIdRef.current = gameId;

  // Lock arenaId at mount — never change mid-match regardless of prop changes
  const lockedArenaIdRef = useRef(arenaId);
  // (intentionally NOT updating this ref to prevent canvas remount)

  const roomPlayersRef = useRef(roomPlayers);
  roomPlayersRef.current = roomPlayers;

  // Server-authoritative alive/total counts (multiplayer only) — always use refs so game loop reads latest value
  const serverAliveCountRef = useRef(serverAliveCount);
  serverAliveCountRef.current = serverAliveCount;
  const serverTotalPlayersRef = useRef(serverTotalPlayers);
  serverTotalPlayersRef.current = serverTotalPlayers;

  // In multiplayer the alive count denominator is the actual # of human players in the match (server-sent).
  // In solo mode we use the fixed 8-car grid.
  const totalCombatants = isMultiplayer
    ? Math.max(2, (serverTotalPlayers ?? roomPlayers?.length ?? 2))
    : 8;

  // Match State Machine (COUNTDOWN -> PLAYING -> FINISHED)
  const [matchState, setMatchState] = useState<MatchState>('COUNTDOWN');
  const [countdownNum, setCountdownNum] = useState<string>('3');

  // Input State Controller (MUTABLE REF — NEVER BLOCKS REACT RENDERS)
  const inputKeys = useRef<{ forward: boolean; backward: boolean; left: boolean; right: boolean; handbrake: boolean }>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
  });

  // Mobile Touch Controls Overlay Support
  const mobileControlsRef = useRef<{ throttle: number; steering: number; handbrake: boolean }>({
    throttle: 0,
    steering: 0,
    handbrake: false,
  });

  // Polished HUD Metrics State
  const [playerHp, setPlayerHp] = useState<number>(100);
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [opponentsAliveCount, setOpponentsAliveCount] = useState<number>(totalCombatants);
  const [totalCombatantsCount, setTotalCombatantsCount] = useState<number>(totalCombatants);
  const [matchTimeSec, setMatchTimeSec] = useState<number>(0);
  const [speedKmhDisplay, setSpeedKmhDisplay] = useState<number>(0);
  const [activeNotifications, setActiveNotifications] = useState<HitNotification[]>([]);
  const [floatingHealthBars, setFloatingHealthBars] = useState<{
    id: string;
    name: string;
    carNumber?: string;
    isPlayer: boolean;
    hp: number;
    maxHp: number;
    screenX: number;
    screenY: number;
  }[]>([]);

  // Development Debug Panel & Wireframe Visualizer (Hidden by default, F3 toggles)
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(false);
  const [serverStateVersion, setServerStateVersion] = useState<number>(0);
  const [serverMatchId, setServerMatchId] = useState<string>('');
  const lastStateVersionRef = useRef<number>(-1);
  const [debugMetrics, setDebugMetrics] = useState<{
    inputW: boolean;
    inputA: boolean;
    inputS: boolean;
    inputD: boolean;
    inputSpace: boolean;
    posX: number;
    posY: number;
    posZ: number;
    velX: number;
    velY: number;
    velZ: number;
    speedKmh: number;
    forwardSpeed: number;
    colliderCount: number;
    gameLoopActive: boolean;
    aiTargets: string[];
  }>({
    inputW: false,
    inputA: false,
    inputS: false,
    inputD: false,
    inputSpace: false,
    posX: 0,
    posY: 0,
    posZ: 14,
    velX: 0,
    velY: 0,
    velZ: 0,
    speedKmh: 0,
    forwardSpeed: 0,
    colliderCount: 0,
    gameLoopActive: true,
    aiTargets: [],
  });

  const onMatchCompleteRef = useRef(onMatchComplete);
  onMatchCompleteRef.current = onMatchComplete;

  const onHudUpdateRef = useRef(onHudUpdate);
  onHudUpdateRef.current = onHudUpdate;

  const onTransformSyncRef = useRef(onTransformSync);
  onTransformSyncRef.current = onTransformSync;

  const playerUpgradesRef = useRef(playerUpgrades);
  playerUpgradesRef.current = playerUpgrades;

  const difficultyRef = useRef(difficulty);
  difficultyRef.current = difficulty;

  const isMultiplayerRef = useRef(isMultiplayer);
  isMultiplayerRef.current = isMultiplayer;

  const localUserIdRef = useRef(localUserId);
  localUserIdRef.current = localUserId;

  const localNicknameRef = useRef(localNickname);
  localNicknameRef.current = localNickname;

  // ── 1. GLOBAL KEYBOARD INPUT LISTENERS ────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      // Forward
      if (['KeyW', 'w', 'W', 'ArrowUp'].includes(e.code) || ['w', 'W', 'ArrowUp'].includes(e.key)) {
        inputKeys.current.forward = true;
      }
      // Backward / Reverse
      if (['KeyS', 's', 'S', 'ArrowDown'].includes(e.code) || ['s', 'S', 'ArrowDown'].includes(e.key)) {
        inputKeys.current.backward = true;
      }
      // Left
      if (['KeyA', 'a', 'A', 'ArrowLeft'].includes(e.code) || ['a', 'A', 'ArrowLeft'].includes(e.key)) {
        inputKeys.current.left = true;
      }
      // Right
      if (['KeyD', 'd', 'D', 'ArrowRight'].includes(e.code) || ['d', 'D', 'ArrowRight'].includes(e.key)) {
        inputKeys.current.right = true;
      }
      // Handbrake
      if (e.code === 'Space' || e.key === ' ') {
        inputKeys.current.handbrake = true;
      }

      // F3 Toggle Debug Panel & Wireframe Colliders
      if (e.code === 'F3') {
        setShowDebugOverlay((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['KeyW', 'w', 'W', 'ArrowUp'].includes(e.code) || ['w', 'W', 'ArrowUp'].includes(e.key)) {
        inputKeys.current.forward = false;
      }
      if (['KeyS', 's', 'S', 'ArrowDown'].includes(e.code) || ['s', 'S', 'ArrowDown'].includes(e.key)) {
        inputKeys.current.backward = false;
      }
      if (['KeyA', 'a', 'A', 'ArrowLeft'].includes(e.code) || ['a', 'A', 'ArrowLeft'].includes(e.key)) {
        inputKeys.current.left = false;
      }
      if (['KeyD', 'd', 'D', 'ArrowRight'].includes(e.code) || ['d', 'D', 'ArrowRight'].includes(e.key)) {
        inputKeys.current.right = false;
      }
      if (e.code === 'Space' || e.key === ' ') {
        inputKeys.current.handbrake = false;
      }
    };

    const handleBlur = () => {
      inputKeys.current.forward = false;
      inputKeys.current.backward = false;
      inputKeys.current.left = false;
      inputKeys.current.right = false;
      inputKeys.current.handbrake = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // ── 2. AUTHORITATIVE THREE.JS ARCADE GAME LOOP ────────────
  useEffect(() => {
    if (!mountRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const mountNode = mountRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Use the locked arena ID captured at mount — never re-derive from props
    const stableArenaId = lockedArenaIdRef.current;

    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, width / height, 0.4, 350);
    // Use stable locked arena definition — never changes mid-match
    const arenaDef = ARENAS[stableArenaId] || ARENAS.arena_1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mountNode.appendChild(renderer.domElement);

    // 2. Static Arena Stadium Construction & Colliders
    const arena3D: Derby3DArena = build3DArena(arenaDef, scene);

    // 3. PBR Lighting & Atmospheric Environment Setup
    const ambientLight = new THREE.AmbientLight(
      arenaDef.lighting.ambientColor,
      arenaDef.lighting.ambientIntensity
    );
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x27170e, 0.85);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(
      arenaDef.lighting.dirColor,
      arenaDef.lighting.dirIntensity
    );
    dirLight.position.set(...arenaDef.lighting.dirPos);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 180;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    scene.add(dirLight);

    // 4. Particle Engine & Debris Parts
    const particleSystem = new DerbyParticleSystem(scene);
    const activeDebrisList: DebrisPiece[] = [];

    // Collision Cooldown & Persistent Contact Manifold Tracker
    const lastObstacleImpactMap = new Map<string, number>();
    const vehicleContactTrackerMap = new Map<string, VehicleContactRecord>();

    // Visual camera shake intensity and decay
    let cameraShakeIntensity = 0;

    // 5. Player & AI Vehicle Mechanics
    const vehiclesStateMap = new Map<string, VehicleState>();
    const vehicle3DMeshesMap = new Map<string, Vehicle3DObject>();
    const vehicleInputsMap = new Map<string, DriverInput>();

    const localPlayerInRoom = roomPlayersRef.current?.find((p) => p.userId === localUserIdRef.current);
    const effectiveLocalVehicleId: VehicleId = (localPlayerInRoom?.selectedCarId as VehicleId) || playerVehicleId || 'road_crusher';
    const playerStats = computeEffectiveStats(effectiveLocalVehicleId, playerUpgrades, isMultiplayer);

    const localPlayerIndex = isMultiplayer && roomPlayersRef.current
      ? roomPlayersRef.current.findIndex((p) => p.userId === localUserIdRef.current)
      : 0;
    const localSpawnIndex = localPlayerIndex >= 0 ? localPlayerIndex : 0;
    const playerSpawn = arenaDef.spawnPoints[localSpawnIndex] || { x: (localSpawnIndex - 3) * 8, z: 20, rotationY: 0 };
    const localPalette = isMultiplayer
      ? MULTIPLAYER_CAR_PALETTES[localSpawnIndex % MULTIPLAYER_CAR_PALETTES.length]
      : { color: '#dc2626', accent: '#2563eb', number: '23' };

    // Local Player Vehicle Initialization
    const playerState: VehicleState = {
      id: localUserId,
      name: localNickname || 'ADITYA',
      isPlayer: true,
      isAI: false,
      vehicleId: effectiveLocalVehicleId,
      color: localPalette.color,
      accentColor: localPalette.accent,
      carNumber: localPalette.number,
      carTitle: localNickname || 'ADITYA',
      x: playerSpawn.x,
      y: 0,
      z: playerSpawn.z,
      rotationY: playerSpawn.rotationY,
      pitch: 0,
      roll: 0,
      speed: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      isDrifting: false,
      isAirborne: false,
      jumpCooldown: 0,
      hp: 100,
      maxHp: 100,
      armor: playerStats.armor,
      ramStat: playerStats.ram,
      weight: playerStats.weight,
      topSpeed: playerStats.speed,
      accelPower: playerStats.acceleration,
      turnPower: playerStats.handling,
      damageDealt: 0,
      hits: 0,
      eliminations: 0,
      score: 0,
      combo: 0,
      lastHitTime: 0,
      isDestroyed: false,
      rank: 0,
      stuckTimer: 0,
      reverseTimer: 0,
    };
    vehiclesStateMap.set(localUserId, playerState);

    const localDef = VEHICLES[effectiveLocalVehicleId] || VEHICLES.road_crusher;
    const player3DObj = create3DVehicle(
      effectiveLocalVehicleId,
      localDef.color,
      localDef.accentColor,
      localPalette.number,
      localNicknameRef.current || 'YOU'
    );
    player3DObj.root.position.set(playerSpawn.x, 0, playerSpawn.z);
    player3DObj.root.rotation.y = playerSpawn.rotationY;
    scene.add(player3DObj.root);
    vehicle3DMeshesMap.set(localUserId, player3DObj);
    vehicleInputsMap.set(localUserId, { throttle: 0, steering: 0, handbrake: false });

    // Spawn Remote Human Players from Authoritative Room Roster
    const playersList = roomPlayersRef.current || [];
    playersList.forEach((p, idx) => {
      if (p.userId === localUserIdRef.current) return;

      const pSpawn = arenaDef.spawnPoints[idx] || { x: (idx - 3) * 8, z: -15, rotationY: -Math.PI };
      const palette = MULTIPLAYER_CAR_PALETTES[idx % MULTIPLAYER_CAR_PALETTES.length];
      const remoteCarId = (p.selectedCarId || (p as any).vehicleId || 'road_crusher') as VehicleId;
      const remoteDef = VEHICLES[remoteCarId] || VEHICLES.road_crusher;
      const remoteStats = computeEffectiveStats(remoteCarId);

      const remotePlayerState: VehicleState = {
        id: p.userId,
        name: p.nickname || `Racer ${idx + 1}`,
        isPlayer: false,
        isAI: false,
        aiDifficulty: difficultyRef.current,
        aiState: 'IDLE',
        personality: undefined,
        decisionTimer: 1.0,
        vehicleId: remoteCarId,
        color: remoteDef.color,
        accentColor: remoteDef.accentColor,
        carNumber: palette.number,
        carTitle: p.nickname || `Racer ${idx + 1}`,
        x: pSpawn.x,
        y: 0,
        z: pSpawn.z,
        rotationY: pSpawn.rotationY,
        pitch: 0,
        roll: 0,
        speed: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        isDrifting: false,
        isAirborne: false,
        jumpCooldown: 0,
        hp: 100,
        maxHp: 100,
        armor: remoteStats.armor,
        ramStat: remoteStats.ram,
        weight: remoteStats.weight,
        topSpeed: remoteStats.speed,
        accelPower: remoteStats.acceleration,
        turnPower: remoteStats.handling,
        damageDealt: 0,
        hits: 0,
        eliminations: 0,
        score: 0,
        combo: 0,
        lastHitTime: 0,
        isDestroyed: false,
        rank: 0,
        stuckTimer: 0,
        reverseTimer: 0,
      };
      vehiclesStateMap.set(p.userId, remotePlayerState);

      const remote3DObj = create3DVehicle(
        remoteCarId,
        remoteDef.color,
        remoteDef.accentColor,
        palette.number,
        p.nickname
      );
      remote3DObj.root.position.set(pSpawn.x, 0, pSpawn.z);
      remote3DObj.root.rotation.y = pSpawn.rotationY;
      scene.add(remote3DObj.root);
      vehicle3DMeshesMap.set(p.userId, remote3DObj);
      vehicleInputsMap.set(p.userId, { throttle: 0, steering: 0, handbrake: false });
    });

    // 6. Match State Machine & Countdown Sequence (Server-Driven)
    let currentMatchState: MatchState = 'COUNTDOWN';
    let matchStartTime = 0;

    setMatchState('COUNTDOWN');
    setCountdownNum('3');

    // 7. Main Authoritative Fixed-Step Physics Loop
    let animFrameId: number;
    const clock = new THREE.Clock();
    let lastHudUpdateTime = 0;
    let lastNetworkSyncTime = 0;
    let physicsAccumulator = 0;
    const FIXED_DT = 1 / 60; // 60Hz deterministic physics tick

    const vehDebugWireframeMap = new Map<string, THREE.LineSegments>();
    const vehBoxGeo = new THREE.WireframeGeometry(new THREE.BoxGeometry(VEH_WIDTH, VEH_HEIGHT, VEH_LENGTH));
    const vehWireMatPlayer = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
    const vehWireMatAI = new THREE.LineBasicMaterial({ color: 0xef4444 });

    const gameLoop = () => {
      animFrameId = requestAnimationFrame(gameLoop);

      const frameDt = Math.min(clock.getDelta(), 0.05);
      const nowTime = Date.now();
      const elapsedSec = currentMatchState === 'PLAYING' && matchStartTime > 0
        ? Math.floor((nowTime - matchStartTime) / 1000)
        : 0;

      const player3D = vehicle3DMeshesMap.get(localUserIdRef.current);
      const playerState = vehiclesStateMap.get(localUserIdRef.current);

      // Synchronize Wireframe Debug Visualizer Visibility with F3 State
      if (arena3D && arena3D.debugGizmoGroup) {
        arena3D.debugGizmoGroup.visible = showDebugOverlay;
        if (showDebugOverlay) {
          vehiclesStateMap.forEach((vState, vId) => {
            let wire = vehDebugWireframeMap.get(vId);
            if (!wire) {
              wire = new THREE.LineSegments(vehBoxGeo, vState.isPlayer ? vehWireMatPlayer : vehWireMatAI);
              arena3D.debugGizmoGroup.add(wire);
              vehDebugWireframeMap.set(vId, wire);
            }
            wire.position.set(vState.x, (vState.y || 0) + VEH_HEIGHT / 2, vState.z);
            wire.rotation.y = vState.rotationY;
            wire.visible = !vState.isDestroyed;
          });
        }
      }

      if (currentMatchState === 'PLAYING' && player3D && playerState) {
        // --- 1. PROCESS PLAYER INPUT ---
        let pThrottle = 0;
        let pSteering = 0;
        let pHandbrake = false;

        const k = inputKeys.current;
        if (k.forward && k.backward) {
          pThrottle = -1; // Brake takes precedence
        } else if (k.forward) {
          pThrottle = 1;
        } else if (k.backward) {
          pThrottle = -1;
        }

        if (k.left && k.right) {
          pSteering = 0;
        } else if (k.left) {
          pSteering = -1; // Steer Left
        } else if (k.right) {
          pSteering = 1;  // Steer Right
        }

        if (k.handbrake) pHandbrake = true;

        if (mobileControlsRef.current.throttle !== 0) pThrottle = mobileControlsRef.current.throttle;
        if (mobileControlsRef.current.steering !== 0) pSteering = mobileControlsRef.current.steering;
        if (mobileControlsRef.current.handbrake) pHandbrake = true;

        vehicleInputsMap.set(localUserId, { throttle: pThrottle, steering: pSteering, handbrake: pHandbrake });

        // --- 2. FIXED-TIMESTEP SIMULATION ACCUMULATOR ---
        physicsAccumulator += frameDt;
        const allVehicleStates = Array.from(vehiclesStateMap.values());

        while (physicsAccumulator >= FIXED_DT) {
          // A. Process AI Bot Inputs
          vehiclesStateMap.forEach((botState, botId) => {
            if (botState.isAI) {
              const aiInput = derbyAIController.updateAI(botState, allVehicleStates, difficulty, FIXED_DT);
              vehicleInputsMap.set(botId, aiInput);
            }
          });

          // B. Integrate Authoritative Vehicle Physics (Substeps + CCD + Obstacles)
          vehiclesStateMap.forEach((vState, vId) => {
            const input = vehicleInputsMap.get(vId) || { throttle: 0, steering: 0, handbrake: false };
            const res = updateVehiclePhysics(
              vState,
              input,
              arenaDef,
              arena3D.colliders,
              FIXED_DT,
              nowTime,
              lastObstacleImpactMap,
              (speed, colId) => {
                if (vState.hp <= 0 || vState.isDestroyed) return;

                const armorMitigation = 100 / (100 + (vState.armor || 60) * 0.7);
                let baseDmg = 4;
                if (speed >= 14.0) baseDmg = Math.round(14 + (speed - 14) * 1.2);
                else if (speed >= 8.0) baseDmg = Math.round(8 + (speed - 8) * 1.0);
                else baseDmg = Math.round(3 + (speed - 2.0) * 0.8);
                const envDamage = Math.max(2, Math.min(45, Math.round(baseDmg * armorMitigation * 1.3)));

                particleSystem.emitSparks(vState.x, (vState.y || 0) + 0.6, vState.z, 14);

                if (vState.isPlayer) {
                  derbySoundSystem.playImpact(speed > 10 ? 'CRITICAL' : 'HEAVY');
                  cameraShakeIntensity = Math.min(0.45, Math.max(cameraShakeIntensity, (speed - 3.0) * 0.035));

                  const socket = socketService.getSocket();
                  if (socket && gameIdRef.current) {
                    const collisionId = `env_${gameIdRef.current}_${localUserIdRef.current}_${Date.now()}`;
                    socket.emit('derby_env_impact', {
                      gameId: gameIdRef.current,
                      userId: localUserIdRef.current,
                      playerId: localUserIdRef.current,
                      impactSpeed: speed,
                      collisionId,
                      hitX: vState.x,
                      hitY: (vState.y || 0) + 0.6,
                      hitZ: vState.z,
                    });
                  }

                  if (!isMultiplayer || !gameIdRef.current) {
                    // Local HP deduction strictly in solo / offline mode
                    vState.hp = Math.max(0, vState.hp - envDamage);
                    setPlayerHp(Math.round(vState.hp));

                    if (vState.hp <= 0 && !vState.isDestroyed) {
                      vState.isDestroyed = true;
                      particleSystem.emitSparks(vState.x, 1.0, vState.z, 25);
                      particleSystem.emitSmokeAndFire(vState.x, 1.0, vState.z, true);
                      derbySoundSystem.playExplosion();
                      pushNotification('VEHICLE TOTALED!', 0, 'ELIMINATION');
                    }
                  }
                } else if (!isMultiplayer || !gameIdRef.current) {
                  // Non-player cars in solo mode
                  vState.hp = Math.max(0, vState.hp - envDamage);
                  if (vState.hp <= 0 && !vState.isDestroyed) {
                    vState.isDestroyed = true;
                    particleSystem.emitSparks(vState.x, 1.0, vState.z, 25);
                    particleSystem.emitSmokeAndFire(vState.x, 1.0, vState.z, true);
                    derbySoundSystem.playExplosion();
                  }
                }
              }
            );

            if (res.justJumped && vState.isPlayer) {
              derbySoundSystem.playImpact('HEAVY');
              pushNotification('RAMP JUMP! +50', 50, 'RAMP_JUMP');
              vState.score += 50;
            }
          });

          // C. Multi-Iteration Vehicle-vs-Vehicle OBB SAT Relaxation Solver (4 iterations)
          for (let iter = 0; iter < 4; iter++) {
            for (let i = 0; i < allVehicleStates.length; i++) {
              for (let j = i + 1; j < allVehicleStates.length; j++) {
                const vA = allVehicleStates[i];
                const vB = allVehicleStates[j];

                const colRes: CollisionResult | null = checkVehicleCollision(vA, vB, nowTime, vehicleContactTrackerMap);
                if (colRes && colRes.hasCollision) {
                  const meshA = vehicle3DMeshesMap.get(vA.id);
                  const meshB = vehicle3DMeshesMap.get(vB.id);

                  if (meshA && colRes.normal) {
                    const impactWorldDir = new THREE.Vector3(colRes.normal.x, 0, colRes.normal.z);
                    meshA.lastImpactLocalDir = impactWorldDir.clone().applyQuaternion(meshA.root.quaternion.clone().invert());
                  }
                  if (meshB && colRes.normal) {
                    const impactWorldDir = new THREE.Vector3(colRes.normal.x, 0, colRes.normal.z);
                    meshB.lastImpactLocalDir = impactWorldDir.clone().negate().applyQuaternion(meshB.root.quaternion.clone().invert());
                  }

                  // Only trigger impact event effects once per physical impact
                  if (colRes.isNewImpactEvent && colRes.relativeVelocity >= 1.5 && (colRes.damageA > 0 || colRes.damageB > 0)) {
                    derbySoundSystem.playImpact(colRes.impactSeverity);
                    particleSystem.emitSparks(
                      colRes.impactX,
                      colRes.impactY,
                      colRes.impactZ,
                      Math.min(36, Math.max(8, Math.floor(colRes.relativeVelocity * 2.0)))
                    );

                    if (vA.isPlayer || vB.isPlayer) {
                      cameraShakeIntensity = Math.min(0.45, Math.max(cameraShakeIntensity, (colRes.relativeVelocity - 3.0) * 0.035));
                    }

                    if (colRes.relativeVelocity > 8.0) {
                      const debris = spawnImpactDebrisParts(colRes.impactX, colRes.impactY, colRes.impactZ, colRes.relativeVelocity, vA.color);
                      activeDebrisList.push(...debris);
                    }

                    // Determine attacker/defender
                    const aForwardSpeed = vA.vx * colRes.normal.x + vA.vz * colRes.normal.z;
                    const bForwardSpeed = -(vB.vx * colRes.normal.x + vB.vz * colRes.normal.z);
                    const attacker = aForwardSpeed >= bForwardSpeed ? vA : vB;
                    const defender = attacker === vA ? vB : vA;

                    // If local player is involved in the collision, emit hit impact to server
                    const localId = localUserIdRef.current;
                    const localInvolved = vA.id === localId || vB.id === localId;

                    if (localInvolved) {
                      const socket = socketService.getSocket();
                      if (socket && gameIdRef.current) {
                        const collisionId = `${gameIdRef.current}_${attacker.id}_${defender.id}_${Date.now()}`;
                        socket.emit('derby_hit_impact', {
                          gameId: gameIdRef.current,
                          userId: localId,
                          attackerId: attacker.id,
                          targetId: defender.id,
                          impactSpeed: colRes.relativeVelocity,
                          collisionId,
                          attackerRam: attacker.ramStat,
                          targetArmor: defender.armor,
                          hitX: colRes.impactX,
                          hitY: colRes.impactY,
                          hitZ: colRes.impactZ,
                        });
                      }
                    }

                    // Local damage application for offline/singleplayer or immediate responsive feedback
                    if (!isMultiplayer || !gameIdRef.current) {
                      if (colRes.damageB > 0 && vB.hp > 0 && !vB.isDestroyed) {
                        vB.hp = Math.max(0, vB.hp - colRes.damageB);
                        vA.damageDealt += colRes.damageB;
                        vA.hits += 1;
                        vA.score += colRes.damageB * 2;

                        if (vA.isPlayer) {
                          setPlayerScore(vA.score);
                          pushNotification(colRes.damageB >= 20 ? `CRITICAL SMASH! +${colRes.damageB * 2}` : `HIT! +${colRes.damageB * 2}`, colRes.damageB * 2, colRes.damageB >= 20 ? 'CRITICAL' : 'NORMAL');
                        }
                        if (vB.isPlayer) {
                          setPlayerHp(Math.round(vB.hp));
                        }

                        if (vB.hp <= 0 && !vB.isDestroyed) {
                          vB.isDestroyed = true;
                          vA.eliminations += 1;
                          vA.score += 300;
                          if (vA.isPlayer) {
                            setPlayerScore(vA.score);
                            pushNotification('WRECKED OPPONENT! +300', 300, 'ELIMINATION');
                          }
                          particleSystem.emitSparks(vB.x, 1.0, vB.z, 25);
                          particleSystem.emitSmokeAndFire(vB.x, 1.0, vB.z, true);
                          derbySoundSystem.playExplosion();
                        }
                      }

                      if (colRes.damageA > 0 && vA.hp > 0 && !vA.isDestroyed) {
                        vA.hp = Math.max(0, vA.hp - colRes.damageA);
                        vB.damageDealt += colRes.damageA;
                        vB.hits += 1;
                        vB.score += colRes.damageA * 2;

                        if (vB.isPlayer) {
                          setPlayerScore(vB.score);
                        }
                        if (vA.isPlayer) {
                          setPlayerHp(Math.round(vA.hp));
                        }

                        if (vA.hp <= 0 && !vA.isDestroyed) {
                          vA.isDestroyed = true;
                          vB.eliminations += 1;
                          vB.score += 300;
                          particleSystem.emitSparks(vA.x, 1.0, vA.z, 25);
                          particleSystem.emitSmokeAndFire(vA.x, 1.0, vA.z, true);
                          derbySoundSystem.playExplosion();
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          physicsAccumulator -= FIXED_DT;
        }

        // --- 3. SYNCHRONIZE 3D VISUAL PRESENTATION ---
        vehiclesStateMap.forEach((vState, vId) => {
          const vMesh = vehicle3DMeshesMap.get(vId);
          const vInput = vehicleInputsMap.get(vId) || { throttle: 0, steering: 0, handbrake: false };
          if (vMesh) {
            update3DVehicleObject(vMesh, vState, vInput.steering, frameDt);
          }
        });

        // --- 4. PARTICLES & DUST UPDATES ---
        particleSystem.update(frameDt);
        particleSystem.updateDebris(activeDebrisList, frameDt);

        allVehicleStates.forEach((vState) => {
          if (vState.speed > 3.0 && !vState.isAirborne) {
            particleSystem.emitDust(vState.x, vState.y || 0, vState.z, vState.isDrifting ? 2.2 : 0.7);
          }
        });

        // --- 5. THIRD-PERSON CHASE CAMERA SYSTEM (Forward = -Z, Camera behind at +Z) ---
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player3D.root.quaternion).normalize();
        const cameraOffset = new THREE.Vector3(0, 4.8, 8.8).applyQuaternion(player3D.root.quaternion);
        const desiredCameraPosition = player3D.root.position.clone().add(cameraOffset);

        camera.position.lerp(desiredCameraPosition, 1 - Math.pow(0.001, frameDt));

        if (cameraShakeIntensity > 0.001) {
          camera.position.x += (Math.random() - 0.5) * cameraShakeIntensity;
          camera.position.y += (Math.random() - 0.5) * cameraShakeIntensity;
          cameraShakeIntensity = Math.max(0, cameraShakeIntensity - frameDt * 0.9);
        }

        // Look 5 meters ahead of player car along canonical forward (-Z)
        const cameraLookTarget = player3D.root.position.clone().add(new THREE.Vector3(0, 0.6, 0)).add(forward.clone().multiplyScalar(5));
        camera.lookAt(cameraLookTarget);

        // --- 6. REAL-TIME SPEED & HUD METRICS UPDATES ---
        const actualKmh = Math.round(playerState.speed * 3.6);
        const fwdSpeedVal = Math.round((playerState.vx * forward.x + playerState.vz * forward.z) * 10) / 10;
        setSpeedKmhDisplay(actualKmh);
        setPlayerHp(Math.round(playerState.hp));
        setPlayerScore(playerState.score);

        // High frequency 25Hz network transform sync
        if (performance.now() - lastNetworkSyncTime > 40) {
          lastNetworkSyncTime = performance.now();
          if (onTransformSyncRef.current) {
            onTransformSyncRef.current({
              x: playerState.x,
              y: playerState.y || 0,
              z: playerState.z,
              rotationY: playerState.rotationY,
              vx: playerState.vx,
              vy: playerState.vy || 0,
              vz: playerState.vz,
            });
          }
        }

        // Alive count: strictly from server-authoritative count
        const aliveCount = serverAliveCountRef.current ?? allVehicleStates.filter((v) => !v.isDestroyed && v.hp > 0).length;
        setOpponentsAliveCount(aliveCount);
        const elapsedSec = matchStartTime > 0 ? Math.floor((Date.now() - matchStartTime) / 1000) : 0;
        setMatchTimeSec(elapsedSec);

        setDebugMetrics({
          inputW: inputKeys.current.forward,
          inputA: inputKeys.current.left,
          inputS: inputKeys.current.backward,
          inputD: inputKeys.current.right,
          inputSpace: inputKeys.current.handbrake,
          posX: Math.round(playerState.x * 10) / 10,
          posY: Math.round((playerState.y || 0) * 10) / 10,
          posZ: Math.round(playerState.z * 10) / 10,
          velX: Math.round(playerState.vx * 10) / 10,
          velY: Math.round(playerState.vy * 10) / 10,
          velZ: Math.round(playerState.vz * 10) / 10,
          speedKmh: actualKmh,
          forwardSpeed: fwdSpeedVal,
          colliderCount: arena3D.colliders.length,
          gameLoopActive: true,
          aiTargets: [],
        });

        // --- 7. CALCULATE 3D PROJECTIONS FOR WORLD-SPACE FLOATING HEALTH BARS ---
        const projVec = new THREE.Vector3();
        const activeBars: {
          id: string;
          name: string;
          carNumber?: string;
          isPlayer: boolean;
          hp: number;
          maxHp: number;
          screenX: number;
          screenY: number;
        }[] = [];

        allVehicleStates.forEach((v) => {
          if (v.isDestroyed || v.hp <= 0) return;

          const heightOffset = (v.vehicleId === 'iron_tanker' || v.vehicleId === 'armored_juggernaut') ? 2.35 : 2.05;
          projVec.set(v.x, (v.y || 0) + heightOffset, v.z);
          projVec.project(camera);

          // Skip if behind camera or far offscreen
          if (projVec.z > 1.0 || projVec.x < -1.2 || projVec.x > 1.2 || projVec.y < -1.2 || projVec.y > 1.2) {
            return;
          }

          const sx = (projVec.x * 0.5 + 0.5) * width;
          const sy = (-(projVec.y * 0.5) + 0.5) * height;

          activeBars.push({
            id: v.id,
            name: v.name,
            carNumber: v.carNumber,
            isPlayer: Boolean(v.isPlayer),
            hp: Math.max(0, Math.round(v.hp)),
            maxHp: v.maxHp,
            screenX: sx,
            screenY: sy,
          });
        });
        setFloatingHealthBars(activeBars);

        // --- 8. SYNC HUD & MINIMAP AT ~10FPS ---
        if (performance.now() - lastHudUpdateTime > 100) {
          lastHudUpdateTime = performance.now();
          if (onHudUpdateRef.current) {
            onHudUpdateRef.current(
              Math.round(playerState.hp),
              playerState.score,
              playerState.combo,
              aliveCount,
              elapsedSec,
              totalCombatants
            );
          }
          renderMinimap(vehiclesStateMap, arenaDef);
        }
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(gameLoop);

    // Multiplayer Socket Synchronization Listeners
    const socket = socketService.getSocket();
    let cleanupSockets = () => {};

    if (socket) {
      const handleServerCountdown = (data: any) => {
        const cv = data.countdownValue;
        if (typeof cv === 'number') {
          setCountdownNum(String(cv));
          if (cv > 1) derbySoundSystem.playCountdownBeep(false);
        }
      };

      const handleServerGameStarted = (data: any) => {
        setCountdownNum('GO!');
        currentMatchState = 'PLAYING';
        matchStartTime = Date.now();
        setMatchState('PLAYING');
        derbySoundSystem.playCountdownBeep(true);
        derbySoundSystem.startEngineSound();
        setTimeout(() => setCountdownNum(''), 1000);

        // Synchronize all vehicles with fresh authoritative server states
        if (data && Array.isArray(data.playerStates)) {
          data.playerStates.forEach((sp: any) => {
            const vState = vehiclesStateMap.get(sp.userId || sp.playerId);
            if (vState) {
              vState.hp = sp.hp ?? 100;
              vState.maxHp = sp.maxHp ?? 100;
              vState.score = sp.score ?? 0;
              vState.eliminations = sp.eliminations ?? 0;
              vState.damageDealt = sp.damageDealt ?? 0;
              vState.isDestroyed = false;
              if (vState.isPlayer) {
                setPlayerHp(Math.round(vState.hp));
                setPlayerScore(vState.score);
              }
            }
          });
          if (typeof data.totalPlayers === 'number') {
            serverAliveCountRef.current = data.totalPlayers;
            setOpponentsAliveCount(data.totalPlayers);
          }
        }
      };

      const handlePlayerSync = ({ userId, x, y, z, rotationY, vx, vy, vz, hp, score }: any) => {
        if (userId === localUserIdRef.current) return;
        const vState = vehiclesStateMap.get(userId);
        const v3D = vehicle3DMeshesMap.get(userId);
        if (vState && v3D) {
          vState.x = x;
          vState.y = y;
          vState.z = z;
          vState.rotationY = rotationY;
          vState.vx = vx;
          vState.vy = vy;
          vState.vz = vz;
          if (typeof hp === 'number') {
            vState.hp = hp;
          }
          if (typeof score === 'number') {
            vState.score = score;
          }
          v3D.root.position.set(x, y, z);
          v3D.root.rotation.y = rotationY;
        }
      };

      const handleCollisionEffect = (data: any) => {
        if (typeof data.stateVersion === 'number') {
          if (data.stateVersion >= lastStateVersionRef.current) {
            lastStateVersionRef.current = data.stateVersion;
            setServerStateVersion(data.stateVersion);
          }
        }
        if (data.targetId) {
          const targetState = vehiclesStateMap.get(data.targetId);
          if (targetState) {
            if (data.targetHp !== undefined) {
              targetState.hp = data.targetHp;
              if (targetState.isPlayer || data.targetId === localUserIdRef.current) {
                setPlayerHp(Math.round(targetState.hp));
              }
            }
            if (data.targetScore !== undefined) {
              targetState.score = data.targetScore;
              if (targetState.isPlayer || data.targetId === localUserIdRef.current) {
                setPlayerScore(targetState.score);
              }
            }
          }
        }
        if (data.attackerId) {
          const attackerState = vehiclesStateMap.get(data.attackerId);
          if (attackerState && data.attackerScore !== undefined) {
            attackerState.score = data.attackerScore;
            if (attackerState.isPlayer || data.attackerId === localUserIdRef.current) {
              setPlayerScore(attackerState.score);
            }
          }
        }
        if (data.hitX != null && data.hitZ != null) {
          particleSystem.emitSparks(data.hitX, (data.hitY || 0.5) + 0.5, data.hitZ, 16);
          particleSystem.emitSmokeAndFire(data.hitX, (data.hitY || 0.5) + 0.5, data.hitZ, data.impactType === 'CRITICAL');
        }
        if (data.impactType === 'CRITICAL' || data.impactType === 'HEAVY') {
          derbySoundSystem.playImpact(data.impactType);
        } else {
          derbySoundSystem.playImpact('NORMAL');
        }
        if (data.attackerId === localUserIdRef.current && data.points > 0) {
          pushNotification(
            data.impactType === 'CRITICAL' ? `CRITICAL SMASH! +${data.points}` : `HIT! +${data.points}`,
            data.points,
            data.impactType
          );
        } else if (data.targetId === localUserIdRef.current && data.damageSource === 'ENVIRONMENT') {
          pushNotification(
            `WALL IMPACT -${data.damage || 5} HP`,
            data.points || -(data.damage || 5),
            'NORMAL'
          );
        }
      };

      // Canonical Game State Update from Server
      const handleGameStateUpdate = (data: any) => {
        if (!data) return;
        if (typeof data.stateVersion === 'number') {
          if (data.stateVersion < lastStateVersionRef.current) {
            console.log(`[CLIENT IGNORE OLD PACKET] version=${data.stateVersion} < current=${lastStateVersionRef.current}`);
            return;
          }
          lastStateVersionRef.current = data.stateVersion;
          setServerStateVersion(data.stateVersion);
        }
        if (data.matchId) {
          setServerMatchId(data.matchId);
        }

        console.log(`[RECEIVED MATCH STATE] match=${data.matchId} version=${data.stateVersion} ${data.players?.map((p: any) => `${p.name || p.userId}=${p.hp}`).join(' ')}`);

        if (data && Array.isArray(data.players)) {
          data.players.forEach((sp: any) => {
            const pId = sp.id || sp.userId || sp.playerId;
            const vState = vehiclesStateMap.get(pId);
            if (vState) {
              vState.hp = sp.hp;
              vState.maxHp = sp.maxHp;
              vState.score = sp.score;
              vState.eliminations = sp.eliminations;
              vState.damageDealt = sp.damageDealt;
              vState.isDestroyed = !sp.alive;
              if (vState.isPlayer || pId === localUserIdRef.current) {
                setPlayerHp(Math.round(vState.hp));
                setPlayerScore(vState.score);
              }
            }
          });
        }
        if (typeof data.aliveCount === 'number') {
          serverAliveCountRef.current = data.aliveCount;
          setOpponentsAliveCount(data.aliveCount);
        }
      };

      const handlePlayerEliminated = (data: any) => {
        const elimId = data.eliminatedId || data.userId;
        const atkId = data.attackerId || data.eliminatedBy;
        const remCount = data.remainingPlayers !== undefined ? data.remainingPlayers : data.aliveCount;

        const vState = vehiclesStateMap.get(elimId);
        const v3D = vehicle3DMeshesMap.get(elimId);
        if (vState) {
          vState.isDestroyed = true;
          vState.hp = 0;
          vState.rank = data.rank || vState.rank;
          if (v3D) {
            particleSystem.emitSparks(vState.x, 1.0, vState.z, 25);
            particleSystem.emitSmokeAndFire(vState.x, 1.0, vState.z, true);
            derbySoundSystem.playExplosion();
          }
        }
        if (remCount !== undefined) {
          serverAliveCountRef.current = remCount;
          setOpponentsAliveCount(remCount);
        }
        if (elimId === localUserIdRef.current) {
          pushNotification('VEHICLE TOTALED!', 0, 'ELIMINATION');
        } else if (atkId === localUserIdRef.current) {
          pushNotification('WRECKED OPPONENT! +300', 300, 'ELIMINATION');
        }
      };

      const handlePlayerDisconnected = (data: any) => {
        const dcId = data.userId;
        const remCount = data.remainingPlayers;

        const vState = vehiclesStateMap.get(dcId);
        const v3D = vehicle3DMeshesMap.get(dcId);
        if (vState) {
          vState.isDestroyed = true;
          vState.hp = 0;
          vState.connected = false;
        }
        if (v3D) {
          scene.remove(v3D.root);
          vehicle3DMeshesMap.delete(dcId);
          vehiclesStateMap.delete(dcId);
        }
        if (remCount !== undefined) {
          serverAliveCountRef.current = remCount;
          setOpponentsAliveCount(remCount);
        }
        if (dcId !== localUserIdRef.current) {
          pushNotification('OPPONENT DISCONNECTED', 0, 'NORMAL');
        }
      };

      const handleGameOver = (data: any) => {
        currentMatchState = 'FINISHED';
        setMatchState('FINISHED');
        derbySoundSystem.stopEngineSound();
        if (data && data.results) {
          const myResult = data.results.find((r: any) => r.userId === localUserIdRef.current || r.playerId === localUserIdRef.current);
          const isWin = myResult ? myResult.rank === 1 : false;
          derbySoundSystem.playFanfare(isWin);
          if (onMatchCompleteRef.current) {
            onMatchCompleteRef.current(
              myResult?.rank || 1,
              myResult?.score || playerState.score,
              myResult?.eliminations || playerState.eliminations,
              myResult?.damageDealt || playerState.damageDealt,
              myResult?.survivalTime || Math.round((Date.now() - matchStartTime) / 1000),
              isWin
            );
          }
        }
      };

      socket.on('game_countdown', handleServerCountdown);
      socket.on('game_started', handleServerGameStarted);
      socket.on('derby_player_sync', handlePlayerSync);
      socket.on('derby_collision_effect', handleCollisionEffect);
      socket.on('derby_game_state_update', handleGameStateUpdate);
      socket.on('derby_player_eliminated', handlePlayerEliminated);
      socket.on('derby_vehicle_eliminated', handlePlayerEliminated);
      socket.on('derby_player_disconnected', handlePlayerDisconnected);
      socket.on('game_over', handleGameOver);

      cleanupSockets = () => {
        socket.off('game_countdown', handleServerCountdown);
        socket.off('game_started', handleServerGameStarted);
        socket.off('derby_player_sync', handlePlayerSync);
        socket.off('derby_collision_effect', handleCollisionEffect);
        socket.off('derby_game_state_update', handleGameStateUpdate);
        socket.off('derby_player_eliminated', handlePlayerEliminated);
        socket.off('derby_vehicle_eliminated', handlePlayerEliminated);
        socket.off('derby_player_disconnected', handlePlayerDisconnected);
        socket.off('game_over', handleGameOver);
      };
    }

    const handleResize = () => {
      if (!containerRef.current) return;
      const nw = containerRef.current.clientWidth;
      const nh = containerRef.current.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cleanupSockets();
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      derbySoundSystem.stopEngineSound();
      particleSystem.clear();
      vehicle3DMeshesMap.forEach((vMesh) => {
        resetVehicleVisualState(vMesh);
      });
      if (mountNode.contains(renderer.domElement)) {
        mountNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerVehicleId]); // arenaId intentionally excluded — locked via lockedArenaIdRef at mount

  // Push Combat Notification Helper
  const pushNotification = (text: string, points: number, type: any) => {
    const notif: HitNotification = {
      id: `notif_${Date.now()}_${Math.random()}`,
      text,
      points,
      type,
      timestamp: Date.now(),
    };
    setActiveNotifications((prev) => [notif, ...prev].slice(0, 3));
    setTimeout(() => {
      setActiveNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    }, 2200);
  };

  // Minimap Radar Renderer
  const renderMinimap = (vehiclesMap: Map<string, VehicleState>, arena: ArenaDefinition) => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const scale = (size * 0.42) / arena.radius;

    ctx.clearRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 2;
    ctx.stroke();

    vehiclesMap.forEach((v) => {
      if (v.isDestroyed || v.hp <= 0) return;

      const mapX = center + v.x * scale;
      const mapY = center + v.z * scale;

      ctx.save();
      ctx.translate(mapX, mapY);
      ctx.rotate(v.rotationY);

      if (v.isPlayer) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 5);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-neutral-950 select-none">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full absolute inset-0" />

      {/* Countdown Overlay */}
      {countdownNum && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
          <div className="text-7xl md:text-9xl font-black italic tracking-tighter text-amber-400 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] animate-bounce">
            {countdownNum}
          </div>
        </div>
      )}

      {/* TOP LEFT: PLAYER VEHICLE STATUS CARD */}
      <div className="absolute top-4 left-4 pointer-events-none z-30 bg-neutral-950/85 border border-white/10 p-3.5 rounded-2xl backdrop-blur-md shadow-2xl w-64">
        <div className="flex justify-between items-center mb-1.5">
          <div className="font-black text-xs text-amber-400 uppercase tracking-wider">
            {localNickname || 'ADITYA'} <span className="text-gray-400 font-normal">#23</span>
          </div>
          <div
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
              playerHp > 70
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : playerHp > 35
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
            }`}
          >
            {playerHp > 70 ? 'HEALTHY' : playerHp > 35 ? 'DAMAGED' : playerHp > 0 ? 'CRITICAL' : 'DESTROYED'}
          </div>
        </div>

        {/* Health Bar Progress */}
        <div className="w-full bg-neutral-800 h-3 rounded-full overflow-hidden border border-white/10 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              playerHp > 70 ? 'bg-emerald-500' : playerHp > 35 ? 'bg-amber-500' : 'bg-red-600'
            }`}
            style={{ width: `${Math.max(0, playerHp)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 font-bold mt-1">
          <span>HP</span>
          <span>{playerHp} / 100</span>
        </div>
      </div>

      {/* TOP CENTER: ARENA & MATCH TIMER HEADER */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-30 flex flex-col items-center">
        <div className="bg-neutral-950/85 border border-white/10 px-5 py-2 rounded-2xl backdrop-blur-md shadow-2xl flex items-center gap-4">
          <div className="text-center">
            <div className="text-[10px] text-amber-500 font-extrabold uppercase tracking-widest">ARENA</div>
            <div className="text-xs font-black text-white uppercase tracking-wider">
              {(ARENAS[arenaId] || ARENAS.arena_1).name.toUpperCase()}
            </div>
          </div>
          <div className="h-6 w-px bg-white/15" />
          <div className="text-center">
            <div className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">TIME</div>
            <div className="text-sm font-black text-amber-400 tabular-nums italic">{formatTimer(matchTimeSec)}</div>
          </div>
        </div>
      </div>

      {/* TOP RIGHT: SCORE & ALIVE VEHICLES */}
      <div className="absolute top-4 right-4 pointer-events-none z-30 bg-neutral-950/85 border border-white/10 px-4 py-3 rounded-2xl backdrop-blur-md shadow-2xl text-right flex items-center gap-4">
        <div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">SCORE</div>
          <div className="text-lg font-black text-emerald-400 tabular-nums">{playerScore}</div>
        </div>
        <div className="h-6 w-px bg-white/15" />
        <div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">ALIVE</div>
          <div className="text-lg font-black text-amber-400 tabular-nums">{opponentsAliveCount} / {totalCombatantsCount}</div>
        </div>
      </div>

      {/* FLOATING COMBAT TEXT NOTIFICATIONS */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none z-30 space-y-2 text-center">
        {activeNotifications.map((n) => (
          <div
            key={n.id}
            className={`px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-xl border backdrop-blur-md animate-bounce ${
              n.type === 'ELIMINATION'
                ? 'bg-red-600/90 text-white border-red-400'
                : n.type === 'CRITICAL'
                ? 'bg-amber-500/90 text-black border-amber-300'
                : 'bg-neutral-900/90 text-emerald-400 border-emerald-500/40'
            }`}
          >
            {n.text}
          </div>
        ))}
      </div>

      {/* 3D WORLD-SPACE FLOATING HEALTH BARS & NAMEPLATES ABOVE VEHICLES */}
      {floatingHealthBars.map((bar) => {
        const hpPercent = Math.max(0, Math.min(100, (bar.hp / bar.maxHp) * 100));
        const barColor = hpPercent > 60 ? 'bg-emerald-500' : hpPercent > 30 ? 'bg-amber-500' : 'bg-red-600 animate-pulse';
        const statusText = hpPercent > 60 ? 'HEALTHY' : hpPercent > 30 ? 'DAMAGED' : hpPercent > 0 ? 'CRITICAL' : 'DESTROYED';
        const statusColor = hpPercent > 60 ? 'text-emerald-400' : hpPercent > 30 ? 'text-amber-400' : 'text-red-400 font-extrabold animate-pulse';

        return (
          <div
            key={bar.id}
            className="absolute top-0 left-0 pointer-events-none z-20 will-change-transform"
            style={{
              transform: `translate3d(${bar.screenX}px, ${bar.screenY}px, 0) translate(-50%, -100%)`,
            }}
          >
            <div
              className={`px-3 py-1.5 rounded-xl backdrop-blur-md shadow-2xl select-none text-center transition-all ${
                bar.isPlayer
                  ? 'bg-neutral-950/95 border-2 border-amber-400/80 shadow-[0_0_16px_rgba(245,158,11,0.35)] min-w-[125px]'
                  : 'bg-neutral-950/90 border border-white/20 min-w-[110px]'
              }`}
            >
              {/* Header: Name & Car Number & YOU badge */}
              <div className="flex justify-between items-center text-[10px] font-black tracking-wider mb-0.5 gap-2">
                <div className="flex items-center gap-1">
                  {bar.isPlayer && (
                    <span className="px-1 py-0.2 bg-amber-500 text-black text-[8px] font-black rounded">
                      YOU
                    </span>
                  )}
                  <span className={`uppercase truncate max-w-[85px] drop-shadow-sm ${bar.isPlayer ? 'text-amber-300 font-extrabold' : 'text-white'}`}>
                    {bar.name} {bar.carNumber ? `#${bar.carNumber}` : ''}
                  </span>
                </div>
                <span className="text-gray-300 font-mono text-[9px] font-bold tabular-nums">
                  {bar.hp}/{bar.maxHp}
                </span>
              </div>

              {/* Health Bar Progress Track */}
              <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden border border-black/80 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-100 ${barColor}`}
                  style={{ width: `${hpPercent}%` }}
                />
              </div>

              {/* Sub-status text for player nameplate */}
              {bar.isPlayer && (
                <div className="flex justify-between items-center text-[8px] font-bold tracking-widest uppercase mt-0.5 px-0.5">
                  <span className="text-gray-400">STATUS</span>
                  <span className={statusColor}>{statusText}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* DEVELOPMENT DEBUG PANEL & WIREFRAME COLLIDERS (F3 KEY TOGGLE) */}
      {showDebugOverlay && (
        <div className="absolute top-20 right-6 pointer-events-none z-40 bg-neutral-950/95 border border-amber-500/50 p-3.5 rounded-2xl backdrop-blur-md text-[11px] font-mono text-amber-300 space-y-2 shadow-2xl w-64">
          <div className="flex justify-between items-center border-b border-amber-500/30 pb-1">
            <span className="font-extrabold text-white uppercase tracking-wider">DEV DEBUG PANEL (F3)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>

          <div className="space-y-0.5">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">INPUT</div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div>W: <span className={debugMetrics.inputW ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>{debugMetrics.inputW ? 'ON' : 'OFF'}</span></div>
              <div>S: <span className={debugMetrics.inputS ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>{debugMetrics.inputS ? 'ON' : 'OFF'}</span></div>
              <div>A: <span className={debugMetrics.inputA ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>{debugMetrics.inputA ? 'ON' : 'OFF'}</span></div>
              <div>D: <span className={debugMetrics.inputD ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>{debugMetrics.inputD ? 'ON' : 'OFF'}</span></div>
              <div className="col-span-2">SPACE: <span className={debugMetrics.inputSpace ? 'text-amber-400 font-bold' : 'text-zinc-500'}>{debugMetrics.inputSpace ? 'ON' : 'OFF'}</span></div>
            </div>
          </div>

          <div className="space-y-0.5 border-t border-white/10 pt-1">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">VEHICLE</div>
            <div>X: {debugMetrics.posX}</div>
            <div>Y: {debugMetrics.posY}</div>
            <div>Z: {debugMetrics.posZ}</div>
          </div>

          <div className="space-y-0.5 border-t border-white/10 pt-1 text-[10px]">
            <div className="text-emerald-400 font-bold">SPEED: {debugMetrics.speedKmh} KM/H</div>
            <div>FORWARD SPEED: {debugMetrics.forwardSpeed}</div>
            <div>ACTIVE COLLIDERS: {debugMetrics.colliderCount}</div>
            <div>GAME LOOP: <span className="text-emerald-400 font-bold">{debugMetrics.gameLoopActive ? 'ACTIVE' : 'INACTIVE'}</span></div>
          </div>

          {isMultiplayer && (
            <div className="space-y-0.5 border-t border-amber-500/30 pt-1 text-[10px]">
              <div className="text-amber-400 font-bold uppercase">MULTIPLAYER SYNC</div>
              <div>MATCH: <span className="text-white truncate block">{serverMatchId || gameId || 'ACTIVE'}</span></div>
              <div>VERSION: <span className="text-emerald-400 font-bold">{serverStateVersion}</span></div>
              <div>LOCAL HP: <span className="text-emerald-400 font-bold">{playerHp} / 100</span></div>
            </div>
          )}

          {debugMetrics.aiTargets.length > 0 && (
            <div className="space-y-0.5 border-t border-white/10 pt-1 text-[9px]">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">AI TARGETS</div>
              {debugMetrics.aiTargets.map((t, idx) => (
                <div key={idx} className="text-amber-200 truncate">{t}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RADAR MINIMAP (BOTTOM LEFT) */}
      <div className="absolute bottom-4 left-4 pointer-events-none z-30 bg-neutral-950/85 border border-white/10 p-1.5 rounded-2xl backdrop-blur-md shadow-2xl">
        <canvas ref={minimapCanvasRef} width={120} height={120} className="w-28 h-28 rounded-xl" />
      </div>

      {/* 3D SPEEDOMETER (BOTTOM RIGHT) */}
      <div className="absolute bottom-4 right-4 pointer-events-none z-30 bg-neutral-950/85 border border-white/10 px-4 py-2 rounded-2xl backdrop-blur-md text-right shadow-2xl flex items-center gap-3">
        <div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">SPEED</div>
          <div className="text-3xl font-black text-amber-400 tabular-nums italic -mt-1">
            {speedKmhDisplay} <span className="text-xs font-normal text-gray-300 not-italic">KM/H</span>
          </div>
        </div>
      </div>
    </div>
  );
}
