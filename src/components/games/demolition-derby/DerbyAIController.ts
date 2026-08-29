import { AIDifficulty, VehicleState } from './types';
import { DriverInput } from './DerbyPhysicsEngine';

/**
 * Ano Demolition Derby — World Space AI Bot Controller
 * Bot vehicles select target opponents, steer toward their world coordinates,
 * accelerate to ram, and execute reverse recovery maneuvers if stuck.
 */
export class DerbyAIController {
  public updateAI(
    bot: VehicleState,
    opponents: VehicleState[],
    difficulty: AIDifficulty,
    dt: number = 0.016
  ): DriverInput {
    if (bot.isDestroyed || bot.hp <= 0) {
      bot.aiState = 'DESTROYED';
      return { throttle: 0, steering: 0, handbrake: false };
    }

    // 1. Reverse Recovery Handler if stuck against wall/obstacle
    if (bot.reverseTimer > 0) {
      bot.reverseTimer -= dt;
      bot.aiState = 'RECOVER';
      return { throttle: -1, steering: Math.sin(Date.now() * 0.005) > 0 ? 1 : -1, handbrake: false };
    }

    if (Math.abs(bot.speed) < 1.0) {
      bot.stuckTimer += dt;
      if (bot.stuckTimer > (difficulty === 'DIFFICULT' ? 0.8 : difficulty === 'MEDIUM' ? 1.5 : 2.5)) {
        bot.stuckTimer = 0;
        bot.reverseTimer = 1.2; // Reverse for 1.2 seconds
        bot.aiState = 'RECOVER';
        return { throttle: -1, steering: 1, handbrake: false };
      }
    } else {
      bot.stuckTimer = Math.max(0, bot.stuckTimer - dt * 2);
    }

    // 2. Select Target Opponent in World Space
    let target = this.selectTarget(bot, opponents, difficulty);
    bot.targetId = target ? target.id : null;

    if (!target) {
      bot.aiState = 'SEARCH_TARGET';
      return { throttle: 0.5, steering: Math.sin(Date.now() * 0.002) * 0.5, handbrake: false };
    }

    // 3. World Angle Calculation
    const dx = target.x - bot.x;
    const dz = target.z - bot.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const targetAngle = Math.atan2(dx, -dz); // Angle in radians matching forward vector (sin, -cos)

    let angleDiff = targetAngle - bot.rotationY;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // 4. Steering Calculation
    let steeringInaccuracy = 0;
    if (difficulty === 'EASY') {
      steeringInaccuracy = Math.sin(Date.now() * 0.003) * 0.35;
    } else if (difficulty === 'MEDIUM') {
      steeringInaccuracy = Math.sin(Date.now() * 0.005) * 0.12;
    }

    let steeringInput = Math.max(-1, Math.min(1, angleDiff * 2.0 + steeringInaccuracy));

    // 5. Throttle Acceleration
    let speedCap = difficulty === 'EASY' ? 0.70 : difficulty === 'MEDIUM' ? 0.88 : 1.0;
    let throttleInput = 1.0 * speedCap;

    let useHandbrake = false;
    if (Math.abs(angleDiff) > 1.2 && dist < 14 && difficulty !== 'EASY') {
      useHandbrake = true;
      bot.aiState = 'ATTACK';
    } else if (dist < 10) {
      bot.aiState = 'ATTACK';
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
    opponents: VehicleState[],
    difficulty: AIDifficulty
  ): VehicleState | null {
    const validEnemies = opponents.filter(
      (o) => o.id !== bot.id && !o.isDestroyed && o.hp > 0
    );

    if (validEnemies.length === 0) return null;

    let bestTarget: VehicleState | null = null;
    let bestScore = -Infinity;

    for (const enemy of validEnemies) {
      const dx = enemy.x - bot.x;
      const dz = enemy.z - bot.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      let score = 100 - dist;

      if (difficulty === 'DIFFICULT') {
        if (enemy.hp < 35) score += 80;
        if (enemy.isPlayer) score += 40;
      } else if (difficulty === 'MEDIUM') {
        if (enemy.isPlayer && Math.random() < 0.4) score += 25;
        if (enemy.hp < 30) score += 30;
      } else {
        if (!enemy.isPlayer) score += 20;
      }

      if (score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }

    return bestTarget;
  }
}

export const derbyAIController = new DerbyAIController();
