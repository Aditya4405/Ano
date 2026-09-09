import * as CANNON from 'cannon-es';
import { ArenaDefinition, VehicleState } from './types';
import { getArenaObstacles } from './DerbyPhysicsEngine';

export interface CannonVehicleBody {
  chassisBody: CANNON.Body;
  vehicleStateId: string;
  steerAngle: number;
  engineForce: number;
  brakeForce: number;
  handbrake: boolean;
  currentSpeedKmh: number;
  headingAngle: number;
}

export interface ImpulseCollisionData {
  bodyAId: string;
  bodyBId: string;
  impulse: number;
  relativeVelocity: number;
  impactPoint: CANNON.Vec3;
  impactNormal: CANNON.Vec3;
  isSideHit: boolean;
}

export class DerbyCannonPhysics {
  public world: CANNON.World;
  public groundBody!: CANNON.Body;
  public vehicleBodies: Map<string, CannonVehicleBody> = new Map();
  public obstacleBodies: Map<string, CANNON.Body> = new Map();
  public debrisBodies: CANNON.Body[] = [];

  private defaultMaterial: CANNON.Material;
  private groundMaterial: CANNON.Material;

  public collisionEvents: ImpulseCollisionData[] = [];

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -18, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations = 10;

    // Contact Materials: Low chassis-ground friction so vehicle body slides smoothly without static friction lockup!
    this.defaultMaterial = new CANNON.Material('default');
    this.groundMaterial = new CANNON.Material('ground');

    const groundDefaultContact = new CANNON.ContactMaterial(
      this.groundMaterial,
      this.defaultMaterial,
      {
        friction: 0.02, // Friction set low so chassis doesn't get glued to ground
        restitution: 0.1,
      }
    );
    this.world.addContactMaterial(groundDefaultContact);

    // Setup Ground Plane
    this.createGround();
  }

  // ── 1. GROUND PLANE SETUP ─────────────────────────────────
  private createGround() {
    const groundShape = new CANNON.Plane();
    this.groundBody = new CANNON.Body({
      mass: 0,
      material: this.groundMaterial,
    });
    this.groundBody.addShape(groundShape);
    this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(this.groundBody);
  }

  // ── 2. CREATE ARENA STADIUM BOUNDARIES & OBSTACLES ────────
  public buildArenaPhysics(arena: ArenaDefinition) {
    this.obstacleBodies.forEach((body) => this.world.removeBody(body));
    this.obstacleBodies.clear();

    const radius = arena.radius || 42;

    // Outer Stadium Boundary Wall Colliders
    const wallSegments = 32;
    for (let i = 0; i < wallSegments; i++) {
      const angle = (i / wallSegments) * Math.PI * 2;
      const wallX = Math.sin(angle) * radius;
      const wallZ = Math.cos(angle) * radius;

      const wallBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(4.5, 4, 1)),
        material: this.defaultMaterial,
      });
      wallBody.position.set(wallX, 2, wallZ);
      wallBody.quaternion.setFromEuler(0, angle + Math.PI / 2, 0);
      this.world.addBody(wallBody);
      this.obstacleBodies.set(`wall_${i}`, wallBody);
    }

    // Add Physical Obstacles
    if (arena.hasObstacles) {
      getArenaObstacles(arena.id).forEach((ob) => {
        let shape: CANNON.Shape;
        const height = ob.height || 1.2;

        if (ob.type === 'ramp') {
          shape = new CANNON.Box(new CANNON.Vec3((ob.width || 8.5) / 2, height / 2, (ob.length || 7.0) / 2));
        } else if (ob.type === 'concrete_block') {
          shape = new CANNON.Box(new CANNON.Vec3(1.2, 0.6, 0.6));
        } else if (ob.type === 'tire_stack') {
          shape = new CANNON.Cylinder(ob.radius * 0.8, ob.radius * 0.8, 1.6, 12);
        } else if (ob.type === 'metal_barrel') {
          shape = new CANNON.Cylinder(0.5, 0.5, 1.3, 12);
        } else {
          shape = new CANNON.Sphere(ob.radius || 2.0);
        }

        const obBody = new CANNON.Body({
          mass: ob.type === 'metal_barrel' ? 80 : 0,
          shape,
          material: this.defaultMaterial,
        });
        obBody.position.set(ob.x, height / 2, ob.z);
        if (ob.rotation) {
          obBody.quaternion.setFromEuler(0, ob.rotation, 0);
        }
        this.world.addBody(obBody);
        this.obstacleBodies.set(ob.id, obBody);
      });
    }
  }

  // ── 3. ADD PHYSICAL VEHICLE RIGID BODY ───────────────────
  public addVehicleBody(vState: VehicleState): CannonVehicleBody {
    // Proportions: ~4.6m length, ~2.0m width, ~1.45m height
    const chassisWidth = 2.0;
    const chassisHeight = 1.45;
    const chassisLength = 4.6;

    const chassisShape = new CANNON.Box(new CANNON.Vec3(chassisWidth / 2, chassisHeight / 2, chassisLength / 2));
    const chassisBody = new CANNON.Body({
      mass: vState.weight || 1600,
      material: this.defaultMaterial,
      linearDamping: 0.12,
      angularDamping: 0.25,
    });

    chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0, 0));
    chassisBody.position.set(vState.x, 1.0, vState.z);
    chassisBody.quaternion.setFromEuler(0, vState.rotationY, 0);

    // Collision listener for impact force & side hit spinout
    chassisBody.addEventListener('collide', (e: any) => {
      const targetBody = e.body as CANNON.Body;
      const contact = e.contact;
      if (!contact) return;

      const relVelocity = contact.getImpactVelocityAlongNormal ? contact.getImpactVelocityAlongNormal() : 5.0;
      if (relVelocity > 2.5) {
        const otherId = Array.from(this.vehicleBodies.entries()).find(([, veh]) => veh.chassisBody === targetBody)?.[0];
        if (otherId) {
          const normal = contact.ni || new CANNON.Vec3(0, 0, 1);
          const impactPt = contact.bj ? contact.bj.position : chassisBody.position;
          const localNormal = chassisBody.vectorToLocalFrame(normal);
          const isSideHit = Math.abs(localNormal.x) > 0.6;

          this.collisionEvents.push({
            bodyAId: vState.id,
            bodyBId: otherId,
            impulse: relVelocity * (vState.weight / 1000),
            relativeVelocity: relVelocity,
            impactPoint: impactPt,
            impactNormal: normal,
            isSideHit,
          });

          if (isSideHit) {
            chassisBody.applyImpulse(
              new CANNON.Vec3(normal.x * 2500, 0, normal.z * 2500),
              new CANNON.Vec3(0, 0, 1.5)
            );
          }
        }
      }
    });

    this.world.addBody(chassisBody);

    const vehObj: CannonVehicleBody = {
      chassisBody,
      vehicleStateId: vState.id,
      steerAngle: 0,
      engineForce: 0,
      brakeForce: 0,
      handbrake: false,
      currentSpeedKmh: 0,
      headingAngle: vState.rotationY,
    };

    this.vehicleBodies.set(vState.id, vehObj);
    return vehObj;
  }

  // ── 4. STEP CANNON-ES PHYSICS SIMULATION ─────────────────
  public update(dt: number, vStateMap: Map<string, VehicleState>) {
    this.collisionEvents = [];
    this.world.step(1 / 60, dt, 3);

    // Sync Cannon-es rigid body position & orientation back to VehicleState
    this.vehicleBodies.forEach((veh, id) => {
      const vState = vStateMap.get(id);
      if (!vState) return;

      const pos = veh.chassisBody.position;

      // Restrain roll/pitch to prevent car flipping over upside down
      const euler = new CANNON.Vec3();
      veh.chassisBody.quaternion.toEuler(euler);
      euler.x = Math.max(-0.25, Math.min(0.25, euler.x));
      euler.z = Math.max(-0.25, Math.min(0.25, euler.z));
      veh.chassisBody.quaternion.setFromEuler(euler.x, euler.y, euler.z);

      veh.headingAngle = euler.y;

      vState.x = pos.x;
      vState.y = Math.max(0, pos.y - 0.725);
      vState.z = pos.z;
      vState.rotationY = euler.y;

      const vel = veh.chassisBody.velocity;
      vState.vx = vel.x;
      vState.vy = vel.y;
      vState.vz = vel.z;

      vState.speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      veh.currentSpeedKmh = Math.round(vState.speed * 3.6);

      vState.isAirborne = pos.y > 1.5;
    });
  }

  // ── 5. APPLY ACCELERATION, BRAKING & STEERING INPUTS ─────
  public applyDriverInput(id: string, throttle: number, steeringInput: number, handbrake: boolean, dt: number) {
    const veh = this.vehicleBodies.get(id);
    if (!veh) return;

    const body = veh.chassisBody;
    const maxSteerAngle = 0.55; // Radians (~31.5 deg)
    const accelRate = 22.0; // m/s^2 forward acceleration
    const topSpeedMs = 25.0; // ~90 KM/H top speed

    // 1. Progressive Steering
    const targetSteer = -steeringInput * maxSteerAngle;
    veh.steerAngle += (targetSteer - veh.steerAngle) * Math.min(1.0, 14 * dt);

    // Apply Yaw Steering Rotation to Body Quaternion
    if (Math.abs(veh.steerAngle) > 0.01) {
      const currentSpeed = body.velocity.length();
      // Allow turning when stationary or moving
      const speedTurnFactor = Math.max(0.4, Math.min(1.0, currentSpeed / 8.0));
      const yawRate = veh.steerAngle * 2.2 * speedTurnFactor;

      veh.headingAngle += yawRate * dt;
      body.quaternion.setFromEuler(0, veh.headingAngle, 0);
    }

    // 2. Forward Direction Vector \vec{f} = (sin(theta), 0, -cos(theta))
    const forwardX = Math.sin(veh.headingAngle);
    const forwardZ = -Math.cos(veh.headingAngle);

    // 3. Throttle Acceleration & Reverse
    if (throttle !== 0) {
      const currentVelMag = body.velocity.length();

      if (currentVelMag < topSpeedMs || (throttle < 0 && body.velocity.dot(new CANNON.Vec3(forwardX, 0, forwardZ)) > 0)) {
        const dv = throttle * accelRate * dt;
        body.velocity.x += forwardX * dv;
        body.velocity.z += forwardZ * dv;
      }
    } else {
      // Natural rolling friction dampening when throttle is released
      body.velocity.x *= 0.96;
      body.velocity.z *= 0.96;
    }

    // 4. Handbrake / Drift Traction Slip
    if (handbrake) {
      veh.handbrake = true;
      body.angularDamping = 0.05;
      body.linearDamping = 0.05;
    } else {
      veh.handbrake = false;
      body.angularDamping = 0.3;
      body.linearDamping = 0.12;

      // Re-align velocity vector with vehicle forward direction (Lateral tire grip)
      const curSpeed = Math.sqrt(body.velocity.x * body.velocity.x + body.velocity.z * body.velocity.z);
      if (curSpeed > 0.5) {
        const velDirX = body.velocity.x / curSpeed;
        const velDirZ = body.velocity.z / curSpeed;

        // Blend velocity towards forward vector
        body.velocity.x = (velDirX * 0.7 + forwardX * 0.3) * curSpeed;
        body.velocity.z = (velDirZ * 0.7 + forwardZ * 0.3) * curSpeed;
      }
    }
  }

  // ── 6. RESET VEHICLE POSITION ─────────────────────────────
  public resetVehiclePosition(id: string, x: number, z: number) {
    const veh = this.vehicleBodies.get(id);
    if (!veh) return;

    veh.chassisBody.position.set(x, 1.2, z);
    veh.chassisBody.velocity.set(0, 0, 0);
    veh.chassisBody.angularVelocity.set(0, 0, 0);
    veh.chassisBody.quaternion.setFromEuler(0, 0, 0);
    veh.headingAngle = 0;
  }

  // ── 7. CLEANUP WORLD ──────────────────────────────────────
  public dispose() {
    this.vehicleBodies.forEach((veh) => this.world.removeBody(veh.chassisBody));
    this.vehicleBodies.clear();

    this.obstacleBodies.forEach((body) => this.world.removeBody(body));
    this.obstacleBodies.clear();
  }
}
