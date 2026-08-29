const BaseGameEngine = require('../engine/BaseGameEngine');

/**
 * Ano Demolition Derby — Backend Real-Time Multiplayer Engine
 * Synchronizes 2–8 human players, tracks vehicle collisions, health,
 * eliminations, damage, dynamic match scoring, and survival rankings.
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
      matchTimeLimit: 300, // 5 minutes max
    };
    this.startTime = null;
    this.countdownTimer = null;
    this.matchTimer = null;
    this.playerStates = new Map();
    this.results = null;
    this.eliminatedCount = 0;
  }

  startGame() {
    this.seed = Math.floor(Math.random() * 2147483647);
    this.status = 'PLAYING';
    this.startTime = Date.now();
    this.results = null;
    this.eliminatedCount = 0;

    const totalPlayers = this.players.size;
    let index = 0;

    // Fixed spawn positions around circle
    for (const [userId, player] of this.players) {
      const angle = (index / totalPlayers) * Math.PI * 2;
      const radius = 25 + Math.random() * 5;
      const spawnX = Math.cos(angle) * radius;
      const spawnZ = Math.sin(angle) * radius;
      const rotationY = angle + Math.PI; // Face towards center

      this.playerStates.set(userId, {
        userId,
        nickname: player.nickname,
        avatar: player.avatar,
        vehicleId: 'starter',
        x: spawnX,
        y: 0.5,
        z: spawnZ,
        rotationY,
        vx: 0,
        vy: 0,
        vz: 0,
        hp: 100,
        maxHp: 100,
        damageDealt: 0,
        hits: 0,
        eliminations: 0,
        score: 0,
        combo: 0,
        lastHitTime: 0,
        isDestroyed: false,
        rank: 0,
        status: 'PLAYING',
      });
      index++;
    }

    // Broadcast 3-2-1 Countdown
    let count = 3;
    this.emit('game_countdown', { countdownValue: count, seed: this.seed });

    this.countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        this.emit('game_countdown', { countdownValue: count, seed: this.seed });
      } else {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;

        // Match Start
        this.emit('game_started', {
          gameId: this.gameId,
          status: 'PLAYING',
          seed: this.seed,
          startTime: this.startTime,
          settings: this.settings,
          playerStates: Array.from(this.playerStates.values()),
        });

        // Set match timeout
        if (this.settings.matchTimeLimit > 0) {
          this.matchTimer = setTimeout(() => {
            this.endMatch();
          }, this.settings.matchTimeLimit * 1000);
        }
      }
    }, 1000);
  }

  handlePlayerAction(playerId, action, data) {
    const state = this.playerStates.get(playerId);
    if (!state && action !== 'return_to_lobby') return { success: false, error: 'Player state not found' };

    switch (action) {
      case 'transform_update': {
        if (state.isDestroyed) return { success: true };

        state.x = data.x ?? state.x;
        state.y = data.y ?? state.y;
        state.z = data.z ?? state.z;
        state.rotationY = data.rotationY ?? state.rotationY;
        state.vx = data.vx ?? state.vx;
        state.vy = data.vy ?? state.vy;
        state.vz = data.vz ?? state.vz;
        if (data.vehicleId) state.vehicleId = data.vehicleId;

        // Broadcast player sync
        this.emit('derby_player_sync', {
          userId: playerId,
          x: state.x,
          y: state.y,
          z: state.z,
          rotationY: state.rotationY,
          vx: state.vx,
          vy: state.vy,
          vz: state.vz,
          hp: state.hp,
        });
        return { success: true };
      }

      case 'hit_impact': {
        if (!data || !data.targetId) return { success: false, error: 'Invalid hit data' };

        const targetState = this.playerStates.get(data.targetId);
        if (!targetState || targetState.isDestroyed) return { success: true };

        const attackerState = state;
        const damage = Math.min(targetState.hp, Math.max(5, Math.round(data.damage || 15)));

        // Update target HP
        targetState.hp = Math.max(0, targetState.hp - damage);

        // Update attacker score & combos
        const now = Date.now();
        if (now - attackerState.lastHitTime < 4000) {
          attackerState.combo = Math.min(10, attackerState.combo + 1);
        } else {
          attackerState.combo = 1;
        }
        attackerState.lastHitTime = now;

        const comboMultiplier = 1 + (attackerState.combo - 1) * 0.2;
        let points = Math.round(damage * 2 * comboMultiplier);
        if (damage >= 40) points += 100; // Critical hit bonus

        attackerState.score += points;
        attackerState.damageDealt += damage;
        attackerState.hits += 1;

        // Broadcast collision effect event to all
        this.emit('derby_collision_effect', {
          attackerId: playerId,
          targetId: data.targetId,
          damage,
          points,
          combo: attackerState.combo,
          hitX: data.hitX || targetState.x,
          hitY: data.hitY || targetState.y,
          hitZ: data.hitZ || targetState.z,
          impactType: damage >= 40 ? 'CRITICAL' : damage >= 20 ? 'HEAVY' : 'NORMAL',
          targetHp: targetState.hp,
        });

        // Check target destruction
        if (targetState.hp <= 0 && !targetState.isDestroyed) {
          this.handleVehicleElimination(data.targetId, playerId);
        }

        return { success: true };
      }

      case 'finished':
      case 'return_to_lobby': {
        if (state) {
          state.status = 'FINISHED';
        }
        this.checkAllFinished();
        return { success: true };
      }

      default:
        return { success: true };
    }
  }

  handleVehicleElimination(eliminatedUserId, attackerUserId) {
    const victim = this.playerStates.get(eliminatedUserId);
    if (!victim || victim.isDestroyed) return;

    victim.isDestroyed = true;
    victim.hp = 0;
    victim.status = 'FINISHED';
    this.eliminatedCount++;

    const remainingCount = this.playerStates.size - this.eliminatedCount;
    victim.rank = remainingCount + 1; // e.g. 8th, 7th, 2nd

    // Award attacker
    if (attackerUserId && attackerUserId !== eliminatedUserId) {
      const attacker = this.playerStates.get(attackerUserId);
      if (attacker) {
        attacker.eliminations += 1;
        attacker.score += 250; // Elimination bonus
      }
    }

    // Broadcast elimination
    this.emit('derby_vehicle_eliminated', {
      eliminatedId: eliminatedUserId,
      attackerId: attackerUserId || null,
      rank: victim.rank,
      remainingPlayers: remainingCount,
      x: victim.x,
      y: victim.y,
      z: victim.z,
    });

    // Check if match should end
    if (remainingCount <= 1) {
      // Find winner
      for (const [, ps] of this.playerStates) {
        if (!ps.isDestroyed) {
          ps.rank = 1;
          ps.score += 1000; // Winner bonus
          break;
        }
      }
      this.endMatch();
    }
  }

  checkAllFinished() {
    let aliveCount = 0;
    for (const [, ps] of this.playerStates) {
      if (!ps.isDestroyed && ps.status === 'PLAYING') {
        aliveCount++;
      }
    }
    if (aliveCount <= 1) {
      this.endMatch();
    }
  }

  endMatch() {
    if (this.status === 'FINISHED') return;
    this.status = 'FINISHED';

    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    if (this.matchTimer) { clearTimeout(this.matchTimer); this.matchTimer = null; }

    const durationSeconds = Math.round((Date.now() - (this.startTime || Date.now())) / 1000);

    const results = [];
    for (const [userId, state] of this.playerStates) {
      results.push({
        userId: state.userId,
        nickname: state.nickname,
        avatar: state.avatar,
        rank: state.rank || (state.isDestroyed ? 8 : 1),
        score: state.score,
        eliminations: state.eliminations,
        damageDealt: state.damageDealt,
        hits: state.hits,
        survivalTime: durationSeconds,
        vehicleId: state.vehicleId,
      });
    }

    // Sort rankings: rank asc (1st to 8th), then score desc
    results.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return b.score - a.score;
    });

    // Final rank assignment
    results.forEach((r, i) => { r.rank = i + 1; });

    this.results = results;
    this.emit('game_over', { gameId: this.gameId, results });
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
    this.endMatch();
  }

  handlePlayerDisconnect(userId) {
    this.removePlayer(userId);
  }

  removePlayer(userId) {
    if (this.players.has(userId)) {
      this.players.delete(userId);
      if (this.status === 'PLAYING') {
        const state = this.playerStates.get(userId);
        if (state && !state.isDestroyed) {
          this.handleVehicleElimination(userId, null);
        }
      }
      return true;
    }
    return false;
  }

  serializeState(privatePlayerId) {
    const players = [];
    for (const [userId, player] of this.players) {
      const pState = this.playerStates.get(userId);
      players.push({
        userId,
        nickname: player.nickname,
        avatar: player.avatar,
        isReady: player.isReady,
        role: player.role,
        isHost: player.isHost,
        status: pState?.status || 'WAITING',
        score: pState?.score ?? 0,
        hp: pState?.hp ?? 100,
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
      players,
      results: this.results,
    };
  }

  restoreState(state) {
    this.status = state.status;
    this.seed = state.seed;
    this.startTime = state.startTime;
    if (state.settings) this.settings = state.settings;
    if (state.results) this.results = state.results;
  }
}

module.exports = DemolitionDerbyEngine;
