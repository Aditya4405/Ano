const BaseGameEngine = require('../engine/BaseGameEngine');

// ── 7 ARENAS SPAWN TABLE (Mirroring client physics engine spawn layout) ──
const ARENA_SPAWNS = {
  arena_1: [
    { x: 0, z: 24, rotationY: 0 },
    { x: 22, z: 16, rotationY: -2.4 },
    { x: 30, z: -4, rotationY: -Math.PI / 2 },
    { x: 18, z: -22, rotationY: -Math.PI },
    { x: -4, z: -26, rotationY: -Math.PI },
    { x: -24, z: -18, rotationY: 2.4 },
    { x: -30, z: 2, rotationY: Math.PI / 2 },
    { x: -20, z: 20, rotationY: 0.8 },
  ],
  arena_2: [
    { x: 0, z: 18, rotationY: 0 },
    { x: 26, z: 14, rotationY: -Math.PI / 2 },
    { x: 26, z: -14, rotationY: -Math.PI / 2 },
    { x: 8, z: -18, rotationY: -Math.PI },
    { x: -10, z: -18, rotationY: -Math.PI },
    { x: -26, z: -14, rotationY: Math.PI / 2 },
    { x: -26, z: 14, rotationY: Math.PI / 2 },
    { x: -10, z: 18, rotationY: 0 },
  ],
  arena_3: [
    { x: 0, z: 28, rotationY: 0 },
    { x: 30, z: 18, rotationY: -2.5 },
    { x: 36, z: -6, rotationY: -Math.PI / 2 },
    { x: 22, z: -26, rotationY: -Math.PI },
    { x: -6, z: -30, rotationY: -Math.PI },
    { x: -28, z: -22, rotationY: 2.5 },
    { x: -36, z: -4, rotationY: Math.PI / 2 },
    { x: -24, z: 22, rotationY: 0.9 },
  ],
  arena_4: [
    { x: 0, z: 22, rotationY: 0 },
    { x: 24, z: 16, rotationY: -2.3 },
    { x: 32, z: -2, rotationY: -Math.PI / 2 },
    { x: 16, z: -22, rotationY: -Math.PI },
    { x: -6, z: -24, rotationY: -Math.PI },
    { x: -26, z: -14, rotationY: 2.3 },
    { x: -30, z: 4, rotationY: Math.PI / 2 },
    { x: -18, z: 18, rotationY: 0.7 },
  ],
  arena_5: [
    { x: 0, z: 22, rotationY: 0 },
    { x: 12, z: 20, rotationY: 0 },
    { x: -12, z: 20, rotationY: 0 },
    { x: 24, z: 16, rotationY: -0.4 },
    { x: -24, z: 16, rotationY: 0.4 },
    { x: 32, z: -8, rotationY: -Math.PI / 2 },
    { x: -32, z: -8, rotationY: Math.PI / 2 },
    { x: 0, z: -26, rotationY: -Math.PI },
  ],
  arena_6: [
    { x: 0, z: 25, rotationY: 0 },
    { x: 26, z: 18, rotationY: -2.4 },
    { x: 34, z: -4, rotationY: -Math.PI / 2 },
    { x: 20, z: -25, rotationY: -Math.PI },
    { x: -4, z: -28, rotationY: -Math.PI },
    { x: -26, z: -20, rotationY: 2.4 },
    { x: -34, z: -2, rotationY: Math.PI / 2 },
    { x: -22, z: 22, rotationY: 0.8 },
  ],
  arena_7: [
    { x: 0, z: 24, rotationY: 0 },
    { x: 17, z: 17, rotationY: -2.35 },
    { x: 24, z: 0, rotationY: -Math.PI / 2 },
    { x: 17, z: -17, rotationY: -2.35 - Math.PI / 2 },
    { x: 0, z: -24, rotationY: -Math.PI },
    { x: -17, z: -17, rotationY: 2.35 },
    { x: -24, z: 0, rotationY: Math.PI / 2 },
    { x: -17, z: 17, rotationY: 0.8 },
  ],
};

// ── SERVER-AUTHORITATIVE VEHICLE STATS FOR MULTIPLAYER DAMAGE ────────
const SERVER_VEHICLE_STATS = {
  road_crusher: { ram: 85, armor: 65, weight: 1750 },
  iron_tanker: { ram: 95, armor: 95, weight: 2600 },
  apex_phantom: { ram: 52, armor: 45, weight: 1200 },
  armored_juggernaut: { ram: 100, armor: 100, weight: 3400 },
  // Aliases
  starter: { ram: 85, armor: 65, weight: 1750 },
  muscle: { ram: 85, armor: 65, weight: 1750 },
  heavy: { ram: 95, armor: 95, weight: 2600 },
  rally: { ram: 52, armor: 45, weight: 1200 },
  armored: { ram: 100, armor: 100, weight: 3400 },
};

/**
 * Ano Demolition Derby — Backend Real-Time Multiplayer Engine
 * Synchronizes 2–8 human players, tracks vehicle collisions, health,
 * eliminations, damage, dynamic match scoring, and survival rankings.
 *
 * SERVER IS THE SOURCE OF TRUTH for:
 *   - player list, connection state, alive/dead status, health, damage,
 *     winner, match status, countdown, arena, spawn positions, car selection.
 *
 * Clients send:  position/rotation/velocity (transform), hit_impact intent,
 *                select_car, select_arena
 * Server sends:  authoritative health changes (derby_collision_effect),
 *                elimination (derby_vehicle_eliminated),
 *                disconnect (derby_player_disconnected),
 *                match end (game_over)
 */
class DemolitionDerbyEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'DEMOLITION_DERBY');
    this.seed = Math.floor(Math.random() * 2147483647);
    this.settings = {
      arenaId: 'arena_1',
      arenaIndex: 1,
      normalizedStats: true,
      maxPlayers: 8,
    };
    this.startTime = null;
    this.countdownTimer = null;
    this.playerStates = new Map();
    this.results = null;
    this.eliminatedCount = 0;
    // Total players that actually started the match — used as the fixed denominator for alive display
    this.totalStartedPlayers = 0;
    // Per-pair impact cooldown map
    this.impactCooldowns = new Map();
    // Match ID unique per match
    this.matchId = null;
    // Monotonic state version for ordering
    this.stateVersion = 0;
    // Processed collision event IDs for server-side deduplication
    this.processedCollisions = new Set();
  }

  startGame() {
    // Guard against duplicate startGame calls (countdown loop prevention)
    if (this.status === 'COUNTDOWN' || this.status === 'PLAYING' || this.countdownTimer) {
      console.log(`[DemolitionDerbyEngine] IGNORED duplicate startGame for gameId=${this.gameId} status=${this.status}`);
      return;
    }

    if (this.players.size < 2) {
      console.log(`[DemolitionDerbyEngine] Cannot start match: fewer than 2 players in gameId=${this.gameId}`);
      return;
    }

    this.matchId = `match_${this.gameId}_${Date.now()}`;
    this.status = 'COUNTDOWN';
    this.seed = Math.floor(Math.random() * 2147483647);
    this.startTime = null;
    this.results = null;
    this.eliminatedCount = 0;
    this.impactCooldowns = new Map();
    this.stateVersion = 0;
    this.processedCollisions = new Set();

    const totalPlayers = this.players.size;
    this.totalStartedPlayers = totalPlayers;
    let index = 0;

    // Get arena spawn points array or fallback to circle
    const arenaSpawnList = ARENA_SPAWNS[this.settings.arenaId] || ARENA_SPAWNS.arena_1;

    // Assign server-authoritative unique spawn positions and selected vehicle types
    for (const [userId, player] of this.players) {
      const spawn = arenaSpawnList[index % arenaSpawnList.length] || { x: (index - 3) * 8, z: 20, rotationY: 0 };
      const chosenCar = player.selectedCarId || 'road_crusher';

      this.playerStates.set(userId, {
        userId,
        nickname: player.nickname,
        avatar: player.avatar,
        vehicleId: chosenCar,
        // Position (authoritative server-assigned spawn)
        x: spawn.x,
        y: 0,
        z: spawn.z,
        rotationY: spawn.rotationY,
        vx: 0,
        vy: 0,
        vz: 0,
        // Vitals (Strictly fresh 100 HP)
        hp: 100,
        maxHp: 100,
        // Combat stats
        damageDealt: 0,
        hits: 0,
        eliminations: 0,
        score: 0,
        combo: 0,
        lastHitTime: 0,
        // State
        isDestroyed: false,
        connected: true,   // Track live connection status
        rank: 0,
        status: 'WAITING',
      });
      index++;
    }

    console.log(`\n========================================\n[MATCH]\nmatchId: ${this.matchId}\nphase: COUNTDOWN\narena: ${this.settings.arenaId}\nplayers: ${Array.from(this.playerStates.values()).map(p => `${p.nickname} (${p.userId}) [${p.vehicleId}]`).join(', ')}\naliveCount: ${this.totalStartedPlayers}\n========================================\n`);

    // Broadcast 3-2-1 Countdown to all clients
    let count = 3;
    this.emit('game_countdown', {
      countdownValue: count,
      matchId: this.matchId,
      seed: this.seed,
      arenaId: this.settings.arenaId,
      totalPlayers: this.totalStartedPlayers,
      spawnData: this._buildSpawnData(),
    });

    this.countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        this.emit('game_countdown', {
          countdownValue: count,
          matchId: this.matchId,
          seed: this.seed,
          arenaId: this.settings.arenaId,
          totalPlayers: this.totalStartedPlayers,
        });
      } else {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.status = 'PLAYING';
        this.startTime = Date.now();

        for (const [, pState] of this.playerStates) {
          pState.status = 'PLAYING';
        }

        console.log(`[MATCH] matchId: ${this.matchId} phase: ACTIVE arena: ${this.settings.arenaId} startTime: ${this.startTime}`);

        // Match Start — broadcast authoritative player states with spawn positions
        this.emit('game_started', {
          matchId: this.matchId,
          gameId: this.gameId,
          status: 'PLAYING',
          seed: this.seed,
          startTime: this.startTime,
          settings: this.settings,
          totalPlayers: this.totalStartedPlayers,
          playerStates: Array.from(this.playerStates.values()),
        });
      }
    }, 1000);
  }

  /** Build spawn data array for clients to place vehicles at authoritative positions */
  _buildSpawnData() {
    const data = [];
    for (const [userId, pState] of this.playerStates) {
      data.push({
        userId,
        playerId: userId,
        name: pState.nickname,
        vehicleId: pState.vehicleId,
        selectedCarId: pState.vehicleId,
        hp: pState.hp,
        maxHp: pState.maxHp,
        alive: !pState.isDestroyed && pState.connected !== false,
        x: pState.x,
        y: pState.y,
        z: pState.z,
        rotationY: pState.rotationY,
      });
    }
    return data;
  }

  handlePlayerAction(playerId, action, data) {
    const state = this.playerStates.get(playerId);
    if (!state && action !== 'return_to_lobby') return { success: false, error: 'Player state not found' };

    switch (action) {
      case 'transform_update': {
        // Guard: only accept position updates for alive, connected players during active match
        if (!state || state.isDestroyed || this.status !== 'PLAYING') return { success: true };

        state.x = data.x ?? state.x;
        state.y = data.y ?? state.y;
        state.z = data.z ?? state.z;
        state.rotationY = data.rotationY ?? state.rotationY;
        state.vx = data.vx ?? state.vx;
        state.vy = data.vy ?? state.vy;
        state.vz = data.vz ?? state.vz;
        if (data.vehicleId) state.vehicleId = data.vehicleId;

        // Broadcast position, rotation, velocity, and server-authoritative HP
        this.emit('derby_player_sync', {
          userId: playerId,
          playerId: playerId,
          x: state.x,
          y: state.y,
          z: state.z,
          rotationY: state.rotationY,
          vx: state.vx,
          vy: state.vy,
          vz: state.vz,
          hp: state.hp,
          score: state.score,
        });
        return { success: true };
      }

      case 'select_car': {
        if (this.status !== 'LOBBY' && this.status !== 'WAITING' && this.status !== 'COUNTDOWN') {
          return { success: false, error: 'Cannot change car during active match' };
        }
        const carId = data.carId || 'road_crusher';
        const player = this.players.get(playerId);
        if (player) {
          player.selectedCarId = carId;
        }
        if (state) {
          state.vehicleId = carId;
        }
        this.emit('derby_car_selected', { userId: playerId, selectedCarId: carId });
        return { success: true };
      }

      case 'select_arena': {
        const hostUser = Array.from(this.players.values()).find(p => p.role === 'HOST') || Array.from(this.players.values())[0];
        if (hostUser && hostUser.userId !== playerId) {
          return { success: false, error: 'Only host can change arena' };
        }
        if (this.status === 'PLAYING') {
          return { success: false, error: 'Cannot change arena during active match' };
        }
        const arenaId = data.arenaId || 'arena_1';
        this.settings.arenaId = arenaId;
        this.emit('derby_arena_selected', { arenaId });
        return { success: true };
      }

      case 'hit_impact': {
        // Guard: only process during active match
        if (this.status !== 'PLAYING') return { success: true };
        if (!data || !data.targetId) return { success: false, error: 'Invalid hit data' };

        const targetState = this.playerStates.get(data.targetId);
        if (!targetState || targetState.isDestroyed || targetState.hp <= 0) return { success: true };

        const attackerState = state;
        const now = Date.now();

        // Collision ID deduplication to prevent double-processing identical impacts
        const collisionId = data.collisionId || `${this.matchId}_${playerId}_${data.targetId}_${Math.floor(now / 300)}`;
        if (this.processedCollisions.has(collisionId)) {
          return { success: true };
        }
        this.processedCollisions.add(collisionId);

        // Prevent duplicate damage ticks from physics substeps (300ms debounce per pair)
        const pairKey = `${playerId}_${data.targetId}`;
        const lastImpactTime = this.impactCooldowns.get(pairKey) || 0;
        if (now - lastImpactTime < 300) {
          return { success: true };
        }
        this.impactCooldowns.set(pairKey, now);

        // Vehicle-specific stats lookup for attacker & target
        const attackerVeh = SERVER_VEHICLE_STATS[attackerState?.vehicleId] || SERVER_VEHICLE_STATS.road_crusher;
        const targetVeh = SERVER_VEHICLE_STATS[targetState?.vehicleId] || SERVER_VEHICLE_STATS.road_crusher;

        // Authoritative server-side damage calculation based on speed, attacker ram, target armor
        const speed = Math.max(2.0, data.impactSpeed || 6.0);
        const ramPower = attackerVeh.ram || 60;
        const armorRating = targetVeh.armor || 60;
        const rawDamage = speed * 1.8 * (ramPower / 60);
        const armorMitigation = 100 / (100 + armorRating * 0.7);
        const calculatedDamage = Math.round(rawDamage * armorMitigation);
        const damage = Math.min(targetState.hp, Math.max(5, Math.min(80, calculatedDamage)));

        // Apply damage to TARGET ONLY — attacker takes NO damage from attacking
        const oldTargetHp = targetState.hp;
        targetState.hp = Math.max(0, targetState.hp - damage);
        this.stateVersion++;

        // Update attacker score & combos
        if (attackerState) {
          const oldAttackerScore = attackerState.score;
          if (now - attackerState.lastHitTime < 4000) {
            attackerState.combo = Math.min(10, attackerState.combo + 1);
          } else {
            attackerState.combo = 1;
          }
          attackerState.lastHitTime = now;

          const comboMultiplier = 1 + (attackerState.combo - 1) * 0.2;
          let points = Math.round(damage * 2 * comboMultiplier);
          if (damage >= 35) points += 100; // Critical hit bonus

          attackerState.score += points;
          attackerState.damageDealt += damage;
          attackerState.hits += 1;

          console.log(`[DAMAGE]\nmatchId=${this.matchId}\nsource=PLAYER_COLLISION\nattackerId=${attackerState.nickname}\ntargetId=${targetState.nickname}\ndamage=${damage}\n[HP BEFORE]\ntarget=${targetState.nickname}\nhp=${oldTargetHp}\n[HP AFTER]\ntarget=${targetState.nickname}\nhp=${targetState.hp}\n[SCORE BEFORE]\nattacker=${attackerState.nickname}\nscore=${oldAttackerScore}\n[SCORE AFTER]\nattacker=${attackerState.nickname}\nscore=${attackerState.score}\n[BROADCAST]\nmatchId=${this.matchId}\nstateVersion=${this.stateVersion}\nplayer=${attackerState.nickname} hp=${attackerState.hp} score=${attackerState.score}\nplayer=${targetState.nickname} hp=${targetState.hp} score=${targetState.score}`);

          // Broadcast authoritative collision effect to entire room
          this.emit('derby_collision_effect', {
            attackerId: playerId,
            targetId: data.targetId,
            damage,
            damageSource: 'PLAYER_VS_PLAYER',
            points,
            combo: attackerState.combo,
            hitX: data.hitX || targetState.x,
            hitY: data.hitY || targetState.y,
            hitZ: data.hitZ || targetState.z,
            impactType: damage >= 35 ? 'CRITICAL' : damage >= 18 ? 'HEAVY' : 'NORMAL',
            targetHp: targetState.hp,  // Authoritative HP from server
            targetScore: targetState.score,
            attackerScore: attackerState.score,
            stateVersion: this.stateVersion,
          });

          this.broadcastGameState();
        }

        // Check target destruction
        if (targetState.hp <= 0 && !targetState.isDestroyed) {
          this.handleVehicleElimination(data.targetId, playerId);
        }

        return { success: true };
      }

      case 'env_impact': {
        // Guard: only process during active match
        if (this.status !== 'PLAYING') return { success: true };
        if (!state || state.isDestroyed || state.hp <= 0) return { success: true };

        const now = Date.now();
        const collisionId = data?.collisionId || `env_${this.matchId}_${playerId}_${Math.floor(now / 300)}`;
        if (this.processedCollisions.has(collisionId)) {
          return { success: true };
        }
        this.processedCollisions.add(collisionId);

        const envKey = `env_${playerId}`;
        const lastEnvTime = this.impactCooldowns.get(envKey) || 0;
        if (now - lastEnvTime < 300) {
          return { success: true };
        }
        this.impactCooldowns.set(envKey, now);

        const playerVeh = SERVER_VEHICLE_STATS[state.vehicleId] || SERVER_VEHICLE_STATS.road_crusher;
        const speed = Math.max(2.0, data?.impactSpeed || 4.0);
        let baseDmg = 5;
        if (speed >= 14.0) baseDmg = Math.round(14 + (speed - 14) * 1.2);
        else if (speed >= 8.0) baseDmg = Math.round(8 + (speed - 8) * 1.0);
        else baseDmg = Math.round(4 + (speed - 2.0) * 0.8);

        const armorRating = playerVeh.armor || 60;
        const armorMitigation = 100 / (100 + armorRating * 0.7);
        const damage = Math.min(state.hp, Math.max(3, Math.min(50, Math.round(baseDmg * armorMitigation * 1.4))));

        const oldHp = state.hp;
        const oldScore = state.score;
        state.hp = Math.max(0, state.hp - damage);
        state.score = state.score - damage; // Arena impact score penalty
        this.stateVersion++;

        console.log(`[DAMAGE]\nmatchId=${this.matchId}\nsource=ARENA_OBJECT\nattackerId=ENVIRONMENT\ntargetId=${state.nickname}\ndamage=${damage}\n[HP BEFORE]\ntarget=${state.nickname}\nhp=${oldHp}\n[HP AFTER]\ntarget=${state.nickname}\nhp=${state.hp}\n[SCORE BEFORE]\ntarget=${state.nickname}\nscore=${oldScore}\n[SCORE AFTER]\ntarget=${state.nickname}\nscore=${state.score}\n[BROADCAST]\nmatchId=${this.matchId}\nstateVersion=${this.stateVersion}\nplayer=${state.nickname} hp=${state.hp} score=${state.score}`);

        this.emit('derby_collision_effect', {
          attackerId: null,
          targetId: playerId,
          damage,
          damageSource: 'ENVIRONMENT',
          points: -damage,
          combo: 0,
          hitX: data?.hitX || state.x,
          hitY: data?.hitY || state.y,
          hitZ: data?.hitZ || state.z,
          impactType: damage >= 20 ? 'CRITICAL' : damage >= 10 ? 'HEAVY' : 'NORMAL',
          targetHp: state.hp,
          targetScore: state.score,
          attackerScore: state.score,
          stateVersion: this.stateVersion,
        });

        this.broadcastGameState();

        if (state.hp <= 0 && !state.isDestroyed) {
          this.handleVehicleElimination(playerId, null);
        }

        return { success: true };
      }

      case 'reset_lobby': {
        this.status = 'LOBBY';
        this.startTime = null;
        this.results = null;
        this.eliminatedCount = 0;
        this.impactCooldowns.clear();
        this.processedCollisions.clear();
        this.stateVersion = 0;
        for (const [uid, ps] of this.playerStates) {
          ps.hp = 100;
          ps.maxHp = 100;
          ps.score = 0;
          ps.eliminations = 0;
          ps.damageDealt = 0;
          ps.hits = 0;
          ps.combo = 0;
          ps.isDestroyed = false;
          ps.connected = true;
          ps.status = 'WAITING';
          ps.rank = 0;
        }
        for (const [uid, p] of this.players) {
          if (p.role !== 'HOST') p.isReady = false;
        }
        return { success: true };
      }

      case 'finished':
      case 'return_to_lobby': {
        if (state) {
          state.status = 'FINISHED';
        }
        this.checkMatchEnd();
        return { success: true };
      }

      default:
        return { success: true };
    }
  }

  broadcastGameState() {
    const aliveCount = this._countAlivePlayers();
    this.emit('derby_game_state_update', {
      matchId: this.matchId,
      stateVersion: this.stateVersion,
      aliveCount,
      totalPlayers: this.totalStartedPlayers,
      players: Array.from(this.playerStates.values()).map(p => ({
        id: p.userId,
        userId: p.userId,
        playerId: p.userId,
        name: p.nickname,
        vehicleId: p.vehicleId,
        hp: p.hp,
        maxHp: p.maxHp,
        alive: !p.isDestroyed && p.connected !== false && p.hp > 0,
        connected: p.connected !== false,
        score: p.score,
        eliminations: p.eliminations,
        damageDealt: p.damageDealt,
      })),
    });
  }

  handleVehicleElimination(eliminatedUserId, attackerUserId) {
    const victim = this.playerStates.get(eliminatedUserId);
    if (!victim || victim.isDestroyed) return;

    victim.isDestroyed = true;
    victim.hp = 0;
    victim.status = 'FINISHED';
    this.eliminatedCount++;

    const aliveCount = this._countAlivePlayers();
    victim.rank = aliveCount + 1;

    // Award attacker bonus
    if (attackerUserId && attackerUserId !== eliminatedUserId) {
      const attacker = this.playerStates.get(attackerUserId);
      if (attacker) {
        attacker.eliminations += 1;
        attacker.score += 300; // Elimination bonus
      }
    }

    console.log(`[PLAYER ELIMINATED]\nplayer=${victim.nickname}\nreason=HP_ZERO`);
    console.log(`[ALIVE COUNT]\nalive=${aliveCount}`);

    // Broadcast elimination to all clients
    this.emit('derby_vehicle_eliminated', {
      eliminatedId: eliminatedUserId,
      attackerId: attackerUserId || null,
      rank: victim.rank,
      remainingPlayers: aliveCount,
      totalPlayers: this.totalStartedPlayers,
      x: victim.x,
      y: victim.y,
      z: victim.z,
    });

    this.broadcastGameState();

    // Check match end condition
    this.checkMatchEnd();
  }

  /**
   * Handle player disconnection during a match.
   * Authoritative source for removing a player during active match.
   */
  handlePlayerDisconnect(userId) {
    const pState = this.playerStates.get(userId);

    // Mark as disconnected & destroyed in player state
    if (pState) {
      pState.connected = false;
      pState.isDestroyed = true;
      pState.hp = 0;
    }

    // Remove from players map
    this.players.delete(userId);

    console.log(`[PLAYER DISCONNECTED]\nplayer=${pState?.nickname || userId}`);

    if (this.status === 'PLAYING') {
      const aliveCount = this._countAlivePlayers();
      console.log(`[ALIVE COUNT]\nalive=${aliveCount}`);

      this.emit('derby_player_disconnected', {
        userId,
        remainingPlayers: aliveCount,
        totalPlayers: this.totalStartedPlayers,
        alivePlayers: this._buildAlivePlayerList(),
      });

      this.broadcastGameState();
      this.checkMatchEnd();
    } else if (this.status === 'COUNTDOWN') {
      const aliveCount = this._countAlivePlayers();
      this.emit('derby_player_disconnected', {
        userId,
        remainingPlayers: aliveCount,
        totalPlayers: this.totalStartedPlayers,
        alivePlayers: this._buildAlivePlayerList(),
      });
      if (this.players.size < 2) {
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        this.status = 'WAITING';
      }
    }
  }

  /** Override removePlayer to use authoritative handlePlayerDisconnect */
  removePlayer(userId) {
    if (this.players.has(userId) || this.playerStates.has(userId)) {
      this.handlePlayerDisconnect(userId);
      return true;
    }
    return false;
  }

  /** Count players who are alive AND connected */
  _countAlivePlayers() {
    let count = 0;
    for (const [, pState] of this.playerStates) {
      if (!pState.isDestroyed && pState.connected !== false && pState.hp > 0) {
        count++;
      }
    }
    return count;
  }

  /** Build array of alive player IDs */
  _buildAlivePlayerList() {
    const alive = [];
    for (const [userId, pState] of this.playerStates) {
      if (!pState.isDestroyed && pState.connected !== false && pState.hp > 0) {
        alive.push(userId);
      }
    }
    return alive;
  }

  /** Assign rank=1 to the sole surviving player */
  _assignWinnerRank() {
    for (const [, ps] of this.playerStates) {
      if (!ps.isDestroyed && ps.connected !== false && ps.hp > 0) {
        ps.rank = 1;
        ps.score += 1000; // Winner bonus
        break;
      }
    }
  }

  checkMatchEnd() {
    if (this.status !== 'PLAYING') return;

    const aliveCount = this._countAlivePlayers();
    if (aliveCount === 1) {
      this._assignWinnerRank();
      this.endMatch('LAST_PLAYER_STANDING');
    } else if (aliveCount === 0) {
      this.endMatch('NO_SURVIVOR');
    }
  }

  endMatch(reason = 'LAST_PLAYER_STANDING') {
    // Idempotent guard: prevent double endMatch calls
    if (this.status === 'FINISHED') return;
    this.status = 'FINISHED';

    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }

    const durationSeconds = Math.round((Date.now() - (this.startTime || Date.now())) / 1000);

    const results = [];
    for (const [, state] of this.playerStates) {
      results.push({
        userId: state.userId,
        playerId: state.userId,
        nickname: state.nickname,
        avatar: state.avatar,
        rank: state.rank || (state.isDestroyed ? this.totalStartedPlayers : 1),
        score: state.score,
        eliminations: state.eliminations,
        damageDealt: state.damageDealt,
        hits: state.hits,
        survivalTime: durationSeconds,
        vehicleId: state.vehicleId,
        connected: state.connected !== false,
      });
    }

    // Sort rankings: rank asc (1st to last), then score desc
    results.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return b.score - a.score;
    });

    // Final rank assignment in order
    results.forEach((r, i) => { r.rank = i + 1; });

    this.results = results;

    // Find the winner (rank 1)
    const winner = results.find(r => r.rank === 1) || results[0];

    console.log(`\n========================================\n[MATCH END]\nwinner=${winner?.nickname || 'None'}\nreason=${reason}\n========================================\n`);

    this.emit('game_over', {
      gameId: this.gameId,
      matchId: this.matchId,
      reason,
      winner: {
        userId: winner?.userId || null,
        playerId: winner?.userId || null,
        name: winner?.nickname || null,
        nickname: winner?.nickname || null,
        vehicleId: winner?.vehicleId || null,
      },
      winnerId: winner?.userId || null,
      winnerName: winner?.nickname || null,
      totalPlayers: this.totalStartedPlayers,
      results,
    });
  }

  updateSettings(settings) {
    if (settings.arenaId) this.settings.arenaId = settings.arenaId;
    if (settings.arenaIndex) this.settings.arenaIndex = settings.arenaIndex;
    if (settings.normalizedStats !== undefined) this.settings.normalizedStats = settings.normalizedStats;
    if (settings.maxPlayers) this.settings.maxPlayers = settings.maxPlayers;
  }

  validateAction(playerId, action, data) {
    return this.playerStates.has(playerId) || this.players.has(playerId);
  }

  endGame(winnerId) {
    this.endMatch('FORCE_END');
  }

  serializeState(privatePlayerId) {
    const players = [];
    for (const [userId, player] of this.players) {
      const pState = this.playerStates.get(userId);
      players.push({
        userId,
        playerId: userId,
        name: player.nickname,
        nickname: player.nickname,
        avatar: player.avatar,
        isReady: player.isReady,
        role: player.role,
        isHost: player.isHost,
        selectedCarId: player.selectedCarId || pState?.vehicleId || 'road_crusher',
        vehicleId: pState?.vehicleId || player.selectedCarId || 'road_crusher',
        connected: pState?.connected !== false,
        status: pState?.status || 'WAITING',
        score: pState?.score ?? 0,
        hp: pState?.hp ?? 100,
        maxHp: pState?.maxHp ?? 100,
        alive: pState ? (!pState.isDestroyed && pState.connected !== false && pState.hp > 0) : true,
        eliminations: pState?.eliminations ?? 0,
        isDestroyed: pState?.isDestroyed ?? false,
        rank: pState?.rank ?? 0,
      });
    }

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      seed: this.seed,
      startTime: this.startTime,
      settings: this.settings,
      totalPlayers: this.totalStartedPlayers,
      players,
      results: this.results,
    };
  }

  cleanup() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.impactCooldowns.clear();
    this.processedCollisions.clear();
  }

  restoreState(state) {
    this.status = state.status;
    this.seed = state.seed;
    this.startTime = state.startTime;
    if (state.settings) this.settings = state.settings;
    if (state.results) this.results = state.results;
    if (state.totalPlayers) this.totalStartedPlayers = state.totalPlayers;
  }
}

module.exports = DemolitionDerbyEngine;
