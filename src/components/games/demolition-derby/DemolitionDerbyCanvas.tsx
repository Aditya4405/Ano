'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  AIDifficulty,
  ArenaDefinition,
  ArenaId,
  CameraShake,
  DebrisPiece,
  HitNotification,
  MatchState,
  ObstacleCollider,
  VehicleId,
  VehicleState,
} from './types';
import {
  ARENAS,
  computeEffectiveStats,
  VEHICLES,
} from './DerbyPhysicsEngine';
import { derbyAIController } from './DerbyAIController';
import { derbySoundSystem } from './DerbySoundSystem';
import { build3DArena, Derby3DArena } from './Derby3DArenaBuilder';
import { create3DVehicle, preloadDerbyVehicleGLB, spawnImpactDebrisParts, update3DVehicleObject, Vehicle3DObject } from './Derby3DVehicleBuilder';
import { DerbyParticleSystem } from './DerbyParticleSystem';

interface DemolitionDerbyCanvasProps {
  arenaId: ArenaId;
  difficulty: AIDifficulty;
  playerVehicleId: VehicleId;
  playerUpgrades: any;
  isMultiplayer: boolean;
  localUserId: string;
  localNickname: string;
  onMatchComplete: (
    playerRank: number,
    playerScore: number,
    eliminations: number,
    damageDealt: number,
    survivalTime: number,
    isWin: boolean
  ) => void;
  onHudUpdate?: (playerHp: number, score: number, combo: number, opponentsAlive: number, timerSeconds: number) => void;
  onTransformSync?: (data: any) => void;
}

export function DemolitionDerbyCanvas({
  arenaId,
  difficulty,
  playerVehicleId,
  playerUpgrades,
  isMultiplayer,
  localUserId,
  localNickname,
  onMatchComplete,
  onHudUpdate,
  onTransformSync,
}: DemolitionDerbyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

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
  const [opponentsAliveCount, setOpponentsAliveCount] = useState<number>(8);
  const [matchTimeSec, setMatchTimeSec] = useState<number>(0);
  const [speedKmhDisplay, setSpeedKmhDisplay] = useState<number>(0);
  const [activeNotifications, setActiveNotifications] = useState<HitNotification[]>([]);

  // Development Debug Panel & Wireframe Visualizer (Hidden by default, F3 toggles)
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(false);
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
  });

  const onMatchCompleteRef = useRef(onMatchComplete);
  onMatchCompleteRef.current = onMatchComplete;

  const onHudUpdateRef = useRef(onHudUpdate);
  onHudUpdateRef.current = onHudUpdate;

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

    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, width / height, 0.4, 350);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mountNode.appendChild(renderer.domElement);

    // 2. PBR Lighting & Atmosphere Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    dirLight.position.set(40, 65, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 160;
    dirLight.shadow.camera.left = -55;
    dirLight.shadow.camera.right = 55;
    dirLight.shadow.camera.top = 55;
    dirLight.shadow.camera.bottom = -55;
    scene.add(dirLight);

    // 3. Static Arena Stadium Construction & Colliders
    const arenaDef = ARENAS[arenaId] || ARENAS.arena_1;
    const arena3D: Derby3DArena = build3DArena(arenaDef, scene);

    // 4. Particle Engine & Debris Parts
    const particleSystem = new DerbyParticleSystem(scene);
    const activeDebrisList: DebrisPiece[] = [];

    // Collision Cooldown Timestamp Map (Prevents multi-frame damage spam!)
    const lastImpactPairMap = new Map<string, number>();

    // 5. Player & AI Vehicle Mechanics
    const vehiclesStateMap = new Map<string, VehicleState>();
    const vehicle3DMeshesMap = new Map<string, Vehicle3DObject>();
    const vehicleVelocitiesMap = new Map<string, THREE.Vector3>();

    const playerStats = computeEffectiveStats(playerVehicleId, playerUpgrades, isMultiplayer);

    // Local Player Vehicle Initialization
    const playerState: VehicleState = {
      id: localUserId,
      name: localNickname || 'ADITYA',
      isPlayer: true,
      isAI: false,
      vehicleId: playerVehicleId,
      color: '#dc2626',
      accentColor: '#2563eb',
      carNumber: '23',
      carTitle: 'ADITYA',
      x: 0,
      y: 0,
      z: 14,
      rotationY: 0,
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

    const player3DObj = create3DVehicle(playerVehicleId, '#dc2626', '#2563eb', '23', 'ADITYA');
    player3DObj.root.position.set(0, 0, 14);
    player3DObj.root.rotation.y = 0;
    scene.add(player3DObj.root);
    vehicle3DMeshesMap.set(localUserId, player3DObj);
    vehicleVelocitiesMap.set(localUserId, new THREE.Vector3(0, 0, 0));

    // Spawn 7 AI Bot Opponents
    if (!isMultiplayer) {
      const botConfigs: { id: VehicleId; name: string; number: string; color: string; accent: string; title: string }[] = [
        { id: 'muscle', name: 'BLAZE', number: '48', color: '#ea580c', accent: '#fbbf24', title: 'FIREBALL' },
        { id: 'heavy', name: 'CRUSHER', number: '7', color: '#16a34a', accent: '#15803d', title: 'BRUTE' },
        { id: 'starter', name: 'HAVOC', number: '19', color: '#eab308', accent: '#18181b', title: 'RAGE' },
        { id: 'rally', name: 'VIPER', number: '99', color: '#9333ea', accent: '#06b6d4', title: 'VIPER' },
        { id: 'rally', name: 'DRIFTER', number: '33', color: '#2563eb', accent: '#ffffff', title: 'DRIFT' },
        { id: 'armored', name: 'IRONHIDE', number: '66', color: '#b91c1c', accent: '#78350f', title: 'IRON' },
        { id: 'heavy', name: 'TITAN', number: '00', color: '#334155', accent: '#dc2626', title: 'TITAN' },
      ];

      for (let i = 0; i < 7; i++) {
        const botId = `bot_${i + 1}`;
        const cfg = botConfigs[i];
        const botStats = computeEffectiveStats(cfg.id);

        const angle = ((i + 1) / 8) * Math.PI * 2;
        const radius = 22;
        const spawnX = Math.sin(angle) * radius;
        const spawnZ = Math.cos(angle) * radius;
        const spawnRot = angle + Math.PI;

        const botState: VehicleState = {
          id: botId,
          name: cfg.name,
          isPlayer: false,
          isAI: true,
          aiDifficulty: difficulty,
          aiState: 'IDLE',
          vehicleId: cfg.id,
          color: cfg.color,
          accentColor: cfg.accent,
          carNumber: cfg.number,
          carTitle: cfg.title,
          x: spawnX,
          y: 0,
          z: spawnZ,
          rotationY: spawnRot,
          speed: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          isDrifting: false,
          isAirborne: false,
          jumpCooldown: 0,
          hp: 100,
          maxHp: 100,
          armor: botStats.armor,
          ramStat: botStats.ram,
          weight: botStats.weight,
          topSpeed: botStats.speed,
          accelPower: botStats.acceleration,
          turnPower: botStats.handling,
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
        vehiclesStateMap.set(botId, botState);

        const bot3DObj = create3DVehicle(cfg.id, cfg.color, cfg.accent, cfg.number, cfg.title);
        bot3DObj.root.position.set(spawnX, 0, spawnZ);
        bot3DObj.root.rotation.y = spawnRot;
        scene.add(bot3DObj.root);
        vehicle3DMeshesMap.set(botId, bot3DObj);
        vehicleVelocitiesMap.set(botId, new THREE.Vector3(0, 0, 0));
      }
    }

    // 6. Match State Machine & Countdown Sequence
    let currentMatchState: MatchState = 'COUNTDOWN';
    setMatchState('COUNTDOWN');
    setCountdownNum('3');
    derbySoundSystem.playCountdownBeep(false);

    const timer1 = setTimeout(() => {
      setCountdownNum('2');
      derbySoundSystem.playCountdownBeep(false);
    }, 1000);

    const timer2 = setTimeout(() => {
      setCountdownNum('1');
      derbySoundSystem.playCountdownBeep(false);
    }, 2000);

    const timer3 = setTimeout(() => {
      setCountdownNum('GO!');
      currentMatchState = 'PLAYING';
      setMatchState('PLAYING');
      derbySoundSystem.playCountdownBeep(true);
      derbySoundSystem.startEngineSound();
    }, 3000);

    const timer4 = setTimeout(() => {
      setCountdownNum('');
    }, 4000);

    // 7. Authoritative Arcade Physics Constants
    const MAX_FORWARD_SPEED = 22; // m/s (~79.2 KM/H)
    const MAX_REVERSE_SPEED = 8; // m/s (~28.8 KM/H)
    const FORWARD_ACCELERATION = 14; // m/s^2
    const REVERSE_ACCELERATION = 8; // m/s^2
    const BRAKE_DECELERATION = 22; // m/s^2
    const DRAG = 3.5;
    const STEERING_SPEED = 2.2; // Rad/s

    // Helper method for general vehicle movement physics
    // Helper method for general vehicle movement physics with sub-step CCD continuous collision detection
    const updateVehiclePhysics = (
      v3D: Vehicle3DObject,
      vVel: THREE.Vector3,
      vState: VehicleState,
      throttleInput: number,
      steeringInput: number,
      handbrakeInput: boolean,
      dt: number
    ) => {
      if (vState.isDestroyed || vState.hp <= 0) {
        vVel.multiplyScalar(Math.max(0, 1 - DRAG * dt));
        v3D.root.position.addScaledVector(vVel, dt);
        return;
      }

      // Local Forward Vector (0, 0, -1)
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(v3D.root.quaternion).normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(v3D.root.quaternion).normalize();

      const forwardSpeed = vVel.dot(forward);

      // Acceleration & Braking
      if (throttleInput > 0) {
        if (forwardSpeed < 0) {
          // Braking while reversing
          vVel.multiplyScalar(Math.max(0, 1 - BRAKE_DECELERATION * dt));
        } else {
          vVel.addScaledVector(forward, FORWARD_ACCELERATION * dt);
        }
      } else if (throttleInput < 0) {
        if (forwardSpeed > 0) {
          // S behaves as brake first when moving forward
          vVel.multiplyScalar(Math.max(0, 1 - BRAKE_DECELERATION * dt));
        } else {
          vVel.addScaledVector(forward, -REVERSE_ACCELERATION * dt);
        }
      } else {
        // Friction / Coasting when throttle is 0
        vVel.multiplyScalar(Math.max(0, 1 - DRAG * dt));
      }

      // Speed Limit Cap
      const currentForwardSpeed = vVel.dot(forward);
      if (currentForwardSpeed > MAX_FORWARD_SPEED) {
        const excess = currentForwardSpeed - MAX_FORWARD_SPEED;
        vVel.addScaledVector(forward, -excess);
      } else if (currentForwardSpeed < -MAX_REVERSE_SPEED) {
        const excess = currentForwardSpeed - (-MAX_REVERSE_SPEED);
        vVel.addScaledVector(forward, -excess);
      }

      // Steering (rotates vehicle itself)
      if (Math.abs(currentForwardSpeed) > 0.4) {
        const speedFactor = Math.min(Math.abs(currentForwardSpeed) / MAX_FORWARD_SPEED, 1.0);
        let steerDir = steeringInput;
        if (handbrakeInput) steerDir *= 1.35; // Responsive handbrake turn

        const steeringAmount = STEERING_SPEED * speedFactor * dt;
        v3D.root.rotation.y += steerDir * steeringAmount * Math.sign(currentForwardSpeed);
      }

      // Realistic Lateral Grip & Drift
      const forwardVelocity = forward.clone().multiplyScalar(vVel.dot(forward));
      const sidewaysVelocity = right.clone().multiplyScalar(vVel.dot(right));

      if (handbrakeInput) {
        // Handbrake drift reduces lateral grip significantly
        sidewaysVelocity.multiplyScalar(0.96);
        forwardVelocity.multiplyScalar(0.985);
        vState.isDrifting = true;
      } else {
        // Normal driving lateral tire grip
        sidewaysVelocity.multiplyScalar(0.82);
        vState.isDrifting = false;
      }

      vVel.copy(forwardVelocity).add(sidewaysVelocity);

      if (vVel.length() < 0.05) {
        vVel.set(0, 0, 0);
      }

      // ── SUB-STEPPING CONTINUOUS COLLISION MOVEMENT (ANTI-TUNNELING) ──
      const stepDist = vVel.length() * dt;
      const numSubsteps = Math.max(1, Math.min(8, Math.ceil(stepDist / 0.20)));
      const subDt = dt / numSubsteps;
      const vehRadius = 1.35;
      const nowTime = Date.now();
      const maxPlayableRadius = arenaDef.radius - 0.8;

      for (let s = 0; s < numSubsteps; s++) {
        v3D.root.position.addScaledVector(vVel, subDt);

        // Static Arena Obstacle Collisions
        if (arena3D && arena3D.colliders) {
          arena3D.colliders.forEach((col) => {
            if (col.type === 'cylinder') {
              const cylRadius = col.radius || 1.2;
              const dx = v3D.root.position.x - col.x;
              const dz = v3D.root.position.z - col.z;
              const dist = Math.sqrt(dx * dx + dz * dz);
              const minDist = cylRadius + vehRadius;

              if (dist < minDist && dist > 0.001) {
                const nx = dx / dist;
                const nz = dz / dist;
                const overlap = minDist - dist;

                v3D.root.position.x += nx * overlap;
                v3D.root.position.z += nz * overlap;

                const dot = vVel.x * nx + vVel.z * nz;
                if (dot < 0) {
                  vVel.x -= 1.35 * dot * nx;
                  vVel.z -= 1.35 * dot * nz;
                }

                const impactKey = `${vState.id}_${col.id}`;
                const lastImpact = lastImpactPairMap.get(impactKey) || 0;
                const impactSpeed = Math.abs(dot);

                if (nowTime - lastImpact > 200 && impactSpeed > 3.2) {
                  lastImpactPairMap.set(impactKey, nowTime);
                  const dmg = Math.round(impactSpeed * 2.8);
                  vState.hp = Math.max(0, vState.hp - dmg);

                  if (vState.isPlayer) {
                    derbySoundSystem.playImpact(impactSpeed > 12 ? 'CRITICAL' : 'HEAVY');
                    particleSystem.emitSparks(v3D.root.position.x, 1.0, v3D.root.position.z, 16);
                  }
                }
              }
            } else if (col.type === 'box' || col.type === 'wall') {
              const rot = col.rotation || 0;
              const dx = v3D.root.position.x - col.x;
              const dz = v3D.root.position.z - col.z;

              const localX = dx * Math.cos(-rot) - dz * Math.sin(-rot);
              const localZ = dx * Math.sin(-rot) + dz * Math.cos(-rot);

              const hw = col.halfWidth || 2.0;
              const hl = col.halfLength || 0.5;

              const closestX = Math.max(-hw, Math.min(hw, localX));
              const closestZ = Math.max(-hl, Math.min(hl, localZ));

              const distLocalX = localX - closestX;
              const distLocalZ = localZ - closestZ;
              const localDist = Math.sqrt(distLocalX * distLocalX + distLocalZ * distLocalZ);

              if (localDist < vehRadius) {
                let pushLx = 0;
                let pushLz = 0;

                if (localDist > 0.001) {
                  const overlap = vehRadius - localDist;
                  pushLx = (distLocalX / localDist) * overlap;
                  pushLz = (distLocalZ / localDist) * overlap;
                } else {
                  const overlapX = hw + vehRadius - Math.abs(localX);
                  const overlapZ = hl + vehRadius - Math.abs(localZ);
                  if (overlapX < overlapZ) {
                    pushLx = Math.sign(localX) * overlapX;
                  } else {
                    pushLz = Math.sign(localZ) * overlapZ;
                  }
                }

                const pushWx = pushLx * Math.cos(rot) - pushLz * Math.sin(rot);
                const pushWz = pushLx * Math.sin(rot) + pushLz * Math.cos(rot);

                v3D.root.position.x += pushWx;
                v3D.root.position.z += pushWz;

                const normLen = Math.sqrt(pushWx * pushWx + pushWz * pushWz);
                if (normLen > 0.001) {
                  const nx = pushWx / normLen;
                  const nz = pushWz / normLen;
                  const dot = vVel.x * nx + vVel.z * nz;
                  if (dot < 0) {
                    vVel.x -= 1.35 * dot * nx;
                    vVel.z -= 1.35 * dot * nz;
                  }

                  const impactKey = `${vState.id}_${col.id}`;
                  const lastImpact = lastImpactPairMap.get(impactKey) || 0;
                  const impactSpeed = Math.abs(dot);

                  if (nowTime - lastImpact > 200 && impactSpeed > 3.2) {
                    lastImpactPairMap.set(impactKey, nowTime);
                    const dmg = Math.round(impactSpeed * 2.8);
                    vState.hp = Math.max(0, vState.hp - dmg);

                    if (vState.isPlayer) {
                      derbySoundSystem.playImpact('HEAVY');
                      particleSystem.emitSparks(v3D.root.position.x, 1.0, v3D.root.position.z, 14);
                    }
                  }
                }
              }
            } else if (col.type === 'ramp') {
              const rot = col.rotation || 0;
              const dx = v3D.root.position.x - col.x;
              const dz = v3D.root.position.z - col.z;

              const localX = dx * Math.cos(-rot) - dz * Math.sin(-rot);
              const localZ = dx * Math.sin(-rot) + dz * Math.cos(-rot);

              const hw = col.halfWidth || 4.0;
              const hl = col.halfLength || 3.5;

              if (Math.abs(localX) <= hw && Math.abs(localZ) <= hl) {
                const rampHeightApex = col.rampHeight || 2.2;
                const slopeRatio = 0.5 - localZ / (hl * 2);
                const targetY = Math.max(0, rampHeightApex * slopeRatio);

                v3D.root.position.y = Math.max(v3D.root.position.y, targetY);

                if (localZ <= -hl + 0.5 && vState.speed > 5.0) {
                  vVel.y = vState.speed * 0.35;
                  vState.isAirborne = true;
                }
              }
            }
          });
        }

        // Hard Outer Circular Perimeter Fallback Safeguard
        const distFromCenter = Math.sqrt(v3D.root.position.x * v3D.root.position.x + v3D.root.position.z * v3D.root.position.z);
        if (distFromCenter > maxPlayableRadius && distFromCenter > 0.001) {
          const nx = v3D.root.position.x / distFromCenter;
          const nz = v3D.root.position.z / distFromCenter;

          v3D.root.position.x = nx * maxPlayableRadius;
          v3D.root.position.z = nz * maxPlayableRadius;

          const dot = vVel.x * nx + vVel.z * nz;
          if (dot > 0) {
            vVel.x -= 1.35 * dot * nx;
            vVel.z -= 1.35 * dot * nz;
          }
        }
      }

      // Sync transform back to state object
      vState.x = v3D.root.position.x;
      vState.y = v3D.root.position.y;
      vState.z = v3D.root.position.z;
      vState.rotationY = v3D.root.rotation.y;
      vState.vx = vVel.x;
      vState.vy = vVel.y;
      vState.vz = vVel.z;
      vState.speed = vVel.length();

      // Update 3D car mesh wheels, suspension pitch/roll, and visual damage
      update3DVehicleObject(v3D, vState, steeringInput, dt);
    };

    // 8. Main Authoritative Loop
    let animFrameId: number;
    const clock = new THREE.Clock();
    let matchStartTime = Date.now();
    let lastHudUpdateTime = 0;

    const gameLoop = () => {
      animFrameId = requestAnimationFrame(gameLoop);

      const dt = Math.min(clock.getDelta(), 0.05);

      const player3D = vehicle3DMeshesMap.get(localUserId);
      const playerVel = vehicleVelocitiesMap.get(localUserId);
      const playerState = vehiclesStateMap.get(localUserId);

      // Synchronize Wireframe Debug Visualizer Visibility with F3 State
      arena3D.debugGizmoGroup.visible = showDebugOverlay;

      if (currentMatchState === 'PLAYING' && player3D && playerVel && playerState) {
        // --- 1. PROCESS PLAYER INPUT ---
        let pThrottle = 0;
        let pSteering = 0;
        let pHandbrake = false;

        const k = inputKeys.current;
        if (k.forward) pThrottle += 1;
        if (k.backward) pThrottle -= 1;
        if (k.left) pSteering += 1;
        if (k.right) pSteering -= 1;
        if (k.handbrake) pHandbrake = true;

        if (mobileControlsRef.current.throttle !== 0) pThrottle = mobileControlsRef.current.throttle;
        if (mobileControlsRef.current.steering !== 0) pSteering = mobileControlsRef.current.steering;
        if (mobileControlsRef.current.handbrake) pHandbrake = true;

        // Execute Player Vehicle Physics Update
        updateVehiclePhysics(player3D, playerVel, playerState, pThrottle, pSteering, pHandbrake, dt);

        // --- 2. PROCESS AI BOT VEHICLE PHYSICS ---
        vehiclesStateMap.forEach((botState, botId) => {
          if (botState.isAI) {
            const bot3D = vehicle3DMeshesMap.get(botId);
            const botVel = vehicleVelocitiesMap.get(botId);
            if (bot3D && botVel) {
              const opponents = Array.from(vehiclesStateMap.values());
              const aiInput = derbyAIController.updateAI(botState, opponents, difficulty, dt);
              updateVehiclePhysics(bot3D, botVel, botState, aiInput.throttle, aiInput.steering, aiInput.handbrake, dt);
            }
          }
        });

        const allVehiclesList = Array.from(vehiclesStateMap.values());
        const nowTime = Date.now();

        // --- 4. INTER-VEHICLE COLLISION PHYSICS & DETACHABLE DEBRIS ---
        for (let i = 0; i < allVehiclesList.length; i++) {
          for (let j = i + 1; j < allVehiclesList.length; j++) {
            const vA = allVehiclesList[i];
            const vB = allVehiclesList[j];
            if (vA.isDestroyed || vB.isDestroyed) continue;

            const meshA = vehicle3DMeshesMap.get(vA.id);
            const meshB = vehicle3DMeshesMap.get(vB.id);
            const velA = vehicleVelocitiesMap.get(vA.id);
            const velB = vehicleVelocitiesMap.get(vB.id);
            if (!meshA || !meshB || !velA || !velB) continue;

            const dx = meshB.root.position.x - meshA.root.position.x;
            const dz = meshB.root.position.z - meshA.root.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const minDist = 3.6; // Bounding vehicle diameter

            if (dist < minDist && dist > 0.001) {
              const nx = dx / dist;
              const nz = dz / dist;

              // Separate overlapping vehicle meshes
              const overlap = minDist - dist;
              meshA.root.position.x -= nx * overlap * 0.5;
              meshA.root.position.z -= nz * overlap * 0.5;
              meshB.root.position.x += nx * overlap * 0.5;
              meshB.root.position.z += nz * overlap * 0.5;

              // Calculate local impact direction for directional mesh deformation
              const impactWorldDir = new THREE.Vector3(nx, 0, nz);
              meshA.lastImpactLocalDir = impactWorldDir.clone().applyQuaternion(meshA.root.quaternion.clone().invert());
              meshB.lastImpactLocalDir = impactWorldDir.clone().negate().applyQuaternion(meshB.root.quaternion.clone().invert());

              // Calculate relative impact velocity
              const relVx = velA.x - velB.x;
              const relVz = velA.z - velB.z;
              const relativeSpeed = Math.sqrt(relVx * relVx + relVz * relVz);

              const pairKey = `veh_${vA.id}_${vB.id}`;
              const lastImpact = lastImpactPairMap.get(pairKey) || 0;

              if (relativeSpeed > 3.0 && nowTime - lastImpact > 200) {
                lastImpactPairMap.set(pairKey, nowTime);

                // Apply knockback impulse
                const impulse = relativeSpeed * 0.45;
                velA.x -= nx * impulse;
                velA.z -= nz * impulse;
                velB.x += nx * impulse;
                velB.z += nz * impulse;

                // Calculate damage from impact speed
                const dmg = Math.round(relativeSpeed * 3.5);
                vA.hp = Math.max(0, vA.hp - dmg);
                vB.hp = Math.max(0, vB.hp - dmg);

                const severity = relativeSpeed > 15 ? 'CRITICAL' : relativeSpeed > 8 ? 'HEAVY' : 'NORMAL';
                derbySoundSystem.playImpact(severity);

                // Emit sparks at exact collision midpoint
                const midX = (meshA.root.position.x + meshB.root.position.x) * 0.5;
                const midZ = (meshA.root.position.z + meshB.root.position.z) * 0.5;
                const sparkCount = Math.min(36, Math.max(8, Math.floor(relativeSpeed * 2.0)));
                particleSystem.emitSparks(midX, 1.0, midZ, sparkCount);

                // Trigger subtle camera shake on heavy impact for player
                if (vA.isPlayer || vB.isPlayer) {
                  const shakeAmount = Math.min(0.5, Math.max(0, (relativeSpeed - 8.0) * 0.04));
                  if (shakeAmount > 0) {
                    camera.position.x += (Math.random() - 0.5) * shakeAmount;
                    camera.position.y += (Math.random() - 0.5) * shakeAmount;
                  }
                }

                if (relativeSpeed > 10) {
                  const debris = spawnImpactDebrisParts(midX, 1.0, midZ, relativeSpeed, vA.color);
                  activeDebrisList.push(...debris);
                }

                // Score & Elimination Check
                const attacker = velA.length() >= velB.length() ? vA : vB;
                const defender = attacker === vA ? vB : vA;

                if (attacker.isPlayer) {
                  const pts = Math.round(relativeSpeed * 18);
                  attacker.score += pts;
                  attacker.damageDealt += dmg;
                  pushNotification(severity === 'CRITICAL' ? `CRITICAL HIT! +${pts}` : severity === 'HEAVY' ? `HEAVY HIT! +${pts}` : `IMPACT +${pts}`, pts, severity);
                }

                if (defender.hp <= 0 && !defender.isDestroyed) {
                  defender.isDestroyed = true;
                  derbySoundSystem.playExplosion();
                  if (attacker.isPlayer) {
                    attacker.eliminations += 1;
                    attacker.score += 250;
                    pushNotification(`TAKEDOWN! +250`, 250, 'ELIMINATION');
                  }
                }
              }
            }
          }
        }

        // --- 5. PARTICLES & DUST UPDATES ---
        particleSystem.update(dt);
        particleSystem.updateDebris(activeDebrisList, dt);

        allVehiclesList.forEach((vState) => {
          if (vState.speed > 3.0 && !vState.isAirborne) {
            particleSystem.emitDust(vState.x, vState.y, vState.z, vState.isDrifting ? 2.2 : 0.7);
          }
        });

        // --- 6. THIRD-PERSON CHASE CAMERA SYSTEM ---
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player3D.root.quaternion).normalize();
        const cameraOffset = new THREE.Vector3(0, 5, 9).applyQuaternion(player3D.root.quaternion);
        const desiredCameraPosition = player3D.root.position.clone().add(cameraOffset);

        // Smoothly chase desired position
        camera.position.lerp(desiredCameraPosition, 1 - Math.pow(0.001, dt));

        // Look 5 meters ahead of player car
        const cameraLookTarget = player3D.root.position.clone().add(forward.clone().multiplyScalar(5));
        camera.lookAt(cameraLookTarget);

        // --- 7. REAL-TIME SPEED & HUD METRICS UPDATES ---
        const actualKmh = Math.round(playerVel.length() * 3.6);
        const forwardSpeedVal = Math.round(playerVel.dot(forward) * 10) / 10;
        setSpeedKmhDisplay(actualKmh);
        setPlayerHp(Math.round(playerState.hp));
        setPlayerScore(playerState.score);

        const aliveCount = allVehiclesList.filter((v) => !v.isDestroyed && v.hp > 0).length;
        setOpponentsAliveCount(aliveCount);
        const elapsedSec = Math.floor((Date.now() - matchStartTime) / 1000);
        setMatchTimeSec(elapsedSec);

        setDebugMetrics({
          inputW: inputKeys.current.forward,
          inputA: inputKeys.current.left,
          inputS: inputKeys.current.backward,
          inputD: inputKeys.current.right,
          inputSpace: inputKeys.current.handbrake,
          posX: Math.round(player3D.root.position.x * 10) / 10,
          posY: Math.round(player3D.root.position.y * 10) / 10,
          posZ: Math.round(player3D.root.position.z * 10) / 10,
          velX: Math.round(playerVel.x * 10) / 10,
          velY: Math.round(playerVel.y * 10) / 10,
          velZ: Math.round(playerVel.z * 10) / 10,
          speedKmh: actualKmh,
          forwardSpeed: forwardSpeedVal,
          colliderCount: arena3D.colliders.length,
          gameLoopActive: true,
        });

        // --- 8. MATCH END CHECK ---
        const aliveVehicles = allVehiclesList.filter((v) => !v.isDestroyed && v.hp > 0);
        if (playerState.isDestroyed || playerState.hp <= 0 || aliveVehicles.length <= 1) {
          currentMatchState = 'FINISHED';
          setMatchState('FINISHED');
          derbySoundSystem.stopEngineSound();

          const rank = aliveVehicles.length <= 1 && !playerState.isDestroyed ? 1 : aliveVehicles.length + 1;
          const isWin = rank === 1;
          const survivalTime = Math.round((Date.now() - matchStartTime) / 1000);

          derbySoundSystem.playFanfare(isWin);
          setTimeout(() => {
            onMatchCompleteRef.current(rank, playerState.score, playerState.eliminations, playerState.damageDealt, survivalTime, isWin);
          }, 1200);
        }

        // --- 9. SYNC HUD & MINIMAP AT ~10FPS ---
        if (performance.now() - lastHudUpdateTime > 100) {
          lastHudUpdateTime = performance.now();
          if (onHudUpdateRef.current) {
            onHudUpdateRef.current(
              Math.round(playerState.hp),
              playerState.score,
              playerState.combo,
              aliveVehicles.length,
              elapsedSec
            );
          }
          renderMinimap(vehiclesStateMap, arenaDef);
        }
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(gameLoop);

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
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      derbySoundSystem.stopEngineSound();
      particleSystem.clear();
      if (mountNode.contains(renderer.domElement)) {
        mountNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [arenaId, difficulty, playerVehicleId, playerUpgrades, isMultiplayer, localUserId, localNickname]);

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
            <div className="text-xs font-black text-white uppercase tracking-wider">DIRT STADIUM</div>
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
          <div className="text-lg font-black text-amber-400 tabular-nums">{opponentsAliveCount} / 8</div>
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
