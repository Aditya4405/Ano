import { AIDifficulty, AIPersonality, VehicleState } from './types';
import { DriverInput, getVehicleForward } from './DerbyPhysicsEngine';

/**
 * AAA Demolition Derby AI System
 * - Independent asynchronous per-bot decision timers (0.8s - 1.6s)
 * - True 8-car multi-target selection (AI vs AI and AI vs Player)
 * - Distinct personality archetypes: AGGRESSIVE, OPPORTUNIST, BRAWLER, FLANKER
 * - Crowd aversion penalty preventing dogpiling on the player or any single car
 * - Lead target interception geometry and reverse unstuck recovery
 */
export class DerbyAIController {
  public updateAI(
    bot: VehicleState,
    allVehicles: VehicleState[],
    difficulty: AIDifficulty,
    dt: number = 0.016
  ): DriverInput {
    if (bot.isDestroyed || bot.hp <= 0) {
      bot.aiState = 'DESTROYED';
      bot.targetId = null;
      return { throttle: 0, steering: 0, handbrake: false };
    }

    // 1. Stuck Detection & Reverse Recovery
    if (bot.reverseTimer > 0) {
      bot.reverseTimer -= dt;
      bot.aiState = 'RECOVER';
      return {
        throttle: -1.0,
        steering: Math.sin(Date.now() * 0.005 + (bot.id.charCodeAt(bot.id.length - 1) || 0)) > 0 ? 1.0 : -1.0,
        handbrake: false,
      };
    }

    if (Math.abs(bot.speed) < 0.9) {
      bot.stuckTimer = (bot.stuckTimer || 0) + dt;
      const stuckThreshold = difficulty === 'DIFFICULT' ? 0.9 : difficulty === 'MEDIUM' ? 1.3 : 2.0;
      if (bot.stuckTimer > stuckThreshold) {
        bot.stuckTimer = 0;
        bot.reverseTimer = 1.15;
        bot.targetId = null; // Invalidate target to break stuck state
        bot.aiState = 'RECOVER';
        return { throttle: -1.0, steering: 1.0, handbrake: false };
      }
    } else {
      bot.stuckTimer = Math.max(0, (bot.stuckTimer || 0) - dt * 2);
    }

    // 2. Target Decision Timer & Re-evaluation
    bot.decisionTimer = (bot.decisionTimer !== undefined ? bot.decisionTimer : (0.5 + Math.random() * 0.8)) - dt;

    let currentTarget: VehicleState | null = null;
    if (bot.targetId) {
      currentTarget = allVehicles.find((v) => v.id === bot.targetId && !v.isDestroyed && v.hp > 0) || null;
    }

    // Reselect if decision timer expired, current target died, or no target
    if (bot.decisionTimer <= 0 || !currentTarget) {
      bot.decisionTimer = 0.8 + Math.random() * 0.8; // Asynchronous interval (0.8s - 1.6s)
      currentTarget = this.selectTarget(bot, allVehicles, difficulty);
      bot.targetId = currentTarget ? currentTarget.id : null;
    }

    if (!currentTarget) {
      bot.aiState = 'SEARCH_TARGET';
      return { throttle: 0.5, steering: Math.sin(Date.now() * 0.002) * 0.4, handbrake: false };
    }

    // 3. Dynamic Lead Interception Calculation
    const target = currentTarget;
    const dxDirect = target.x - bot.x;
    const dzDirect = target.z - bot.z;
    const directDist = Math.sqrt(dxDirect * dxDirect + dzDirect * dzDirect);

    const leadTime = Math.min(1.2, Math.max(0.12, directDist / (16.0 + bot.speed * 0.4)));
    const targetVx = target.vx || 0;
    const targetVz = target.vz || 0;

    const interceptX = target.x + targetVx * leadTime;
    const interceptZ = target.z + targetVz * leadTime;

    const dx = interceptX - bot.x;
    const dz = interceptZ - bot.z;
    const targetAngle = Math.atan2(-dx, -dz);

    // 4. Heading Difference (Wrapped to [-PI, PI])
    let angleDiff = targetAngle - bot.rotationY;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // 5. Steering (Left = -1, Right = +1)
    let steeringInaccuracy = 0;
    if (difficulty === 'EASY') {
      steeringInaccuracy = Math.sin(Date.now() * 0.003 + (bot.id.charCodeAt(bot.id.length - 1) || 0)) * 0.28;
    } else if (difficulty === 'MEDIUM') {
      steeringInaccuracy = Math.sin(Date.now() * 0.005) * 0.08;
    }

    // Angle diff > 0 -> target is to the left -> steer Left (-1)
    // Angle diff < 0 -> target is to the right -> steer Right (+1)
    const rawSteer = -angleDiff * 2.3 + steeringInaccuracy;
    const steeringInput = Math.max(-1, Math.min(1, rawSteer));

    // 6. Throttle & Attack Logic
    const speedCap = difficulty === 'EASY' ? 0.75 : difficulty === 'MEDIUM' ? 0.88 : 1.0;
    let throttleInput = 1.0 * speedCap;

    let useHandbrake = false;
    if (Math.abs(angleDiff) > 1.2 && directDist < 14 && difficulty !== 'EASY') {
      useHandbrake = true;
      bot.aiState = 'ATTACK';
    } else if (directDist < 9) {
      bot.aiState = 'ATTACK';
      throttleInput = 1.0; // Full throttle into collision impact
    } else {
      bot.aiState = 'CHASE';
    }

    return {
      throttle: throttleInput,
      steering: steeringInput,
      handbrake: useHandbrake,
    };
  }

  private selectTarget(
    bot: VehicleState,
    allVehicles: VehicleState[],
    difficulty: AIDifficulty
  ): VehicleState | null {
    // 1. Filter all alive candidate opponents (excludes self, excludes wrecked)
    const validEnemies = allVehicles.filter(
      (v) => v.id !== bot.id && !v.isDestroyed && v.hp > 0
    );

    if (validEnemies.length === 0) return null;
    if (validEnemies.length === 1) return validEnemies[0]; // Only 1 opponent remains (e.g. Player or last bot)

    // 2. Calculate current target claims across all bots to prevent dogpiling
    const targetClaims = new Map<string, number>();
    for (const v of allVehicles) {
      if (v.isAI && v.id !== bot.id && v.targetId) {
        targetClaims.set(v.targetId, (targetClaims.get(v.targetId) || 0) + 1);
      }
    }

    const personality: AIPersonality = bot.personality || 'AGGRESSIVE';
    const fwd = getVehicleForward(bot.rotationY);

    let bestTarget: VehicleState | null = null;
    let bestScore = -Infinity;

    for (const enemy of validEnemies) {
      const dx = enemy.x - bot.x;
      const dz = enemy.z - bot.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // A. Base Proximity Score (Closer = Higher)
      let score = 100 - dist * 1.4;

      // B. Forward Alignment Bonus (Prefer vehicles already in front of bot's bumper)
      if (dist > 0.001) {
        const toEnemyX = dx / dist;
        const toEnemyZ = dz / dist;
        const dotFront = toEnemyX * fwd.x + toEnemyZ * fwd.z;
        if (dotFront > 0.2) {
          score += dotFront * 32;
        }
      }

      // C. Personality Archetype Biases
      if (personality === 'AGGRESSIVE') {
        // Rams closest and most direct targets
        score += (40 - Math.min(40, dist)) * 0.5;
      } else if (personality === 'OPPORTUNIST') {
        // Seeks weak, low-HP vehicles
        if (enemy.hp < 45) {
          score += (1 - enemy.hp / 100) * 45;
        }
      } else if (personality === 'BRAWLER') {
        // Prefers targets in the central melee arena zone
        const centerDist = Math.sqrt(enemy.x * enemy.x + enemy.z * enemy.z);
        if (centerDist < 16) {
          score += 24;
        }
      } else if (personality === 'FLANKER') {
        // Prefers targets moving across its line of sight
        const targetSpeed = enemy.speed || 0;
        if (targetSpeed > 3.0) {
          score += 18;
        }
      }

      // D. Target Persistence Hysteresis (Stick to attack run)
      if (bot.targetId === enemy.id) {
        score += 28;
      }

      // E. Crowd Aversion Penalty (Deters all bots from attacking the exact same car)
      const currentChasers = targetClaims.get(enemy.id) || 0;
      if (currentChasers >= 2) {
        score -= currentChasers * 22; // Heavy penalty if 2+ other bots are already chasing
      }

      // F. Small Individual Variation
      score += Math.random() * 6.0;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }

    return bestTarget;
  }
}

export const derbyAIController = new DerbyAIController();
