import * as THREE from 'three';
import { DebrisPiece } from './types';

export interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  growth: number;
  rotSpeed: number;
  type: 'dust' | 'spark' | 'smoke' | 'fire';
}

export class DerbyParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private debrisMeshes: Map<string, THREE.Mesh> = new Map();
  private maxParticles: number = 300;

  // Shared Geometries & Materials
  private particleGeo = new THREE.SphereGeometry(1, 8, 8);
  private boxDebrisGeo = new THREE.BoxGeometry(0.4, 0.2, 0.4);

  // SOFT REALISTIC DUST MATERIAL (NOT GIANT ORANGE SPHERES!)
  private dustMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#78350f'),
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });

  private sparkMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#fef08a'),
    transparent: true,
    opacity: 0.85,
  });

  private smokeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#1e293b'),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });

  private fireMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ef4444'),
    transparent: true,
    opacity: 0.7,
  });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // ── EMIT SMALL SOFT DIRT DUST ──────────────────────────────
  public emitDust(x: number, y: number, z: number, intensity: number = 1.0) {
    if (this.particles.length >= this.maxParticles) return;

    const count = Math.min(3, Math.floor(2 * intensity));
    for (let i = 0; i < count; i++) {
      const pMesh = new THREE.Mesh(this.particleGeo, this.dustMat.clone());
      const scale = 0.2 + Math.random() * 0.35 * Math.min(1.5, intensity);
      pMesh.scale.set(scale, scale, scale);
      pMesh.position.set(x + (Math.random() - 0.5) * 0.4, y + 0.1, z + (Math.random() - 0.5) * 0.4);

      this.scene.add(pMesh);

      this.particles.push({
        mesh: pMesh,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 0.3 + Math.random() * 0.8,
        vz: (Math.random() - 0.5) * 1.2,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25, // Short lived so camera is never blocked
        size: scale,
        growth: 1.4,
        rotSpeed: (Math.random() - 0.5) * 2,
        type: 'dust',
      });
    }
  }

  // ── EMIT COLLISION SPARKS ──────────────────────────────────
  public emitSparks(x: number, y: number, z: number, count: number = 12) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const pMesh = new THREE.Mesh(this.particleGeo, this.sparkMat);
      const scale = 0.08 + Math.random() * 0.12;
      pMesh.scale.set(scale, scale, scale);
      pMesh.position.set(x, y, z);

      this.scene.add(pMesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;

      this.particles.push({
        mesh: pMesh,
        vx: Math.cos(angle) * speed,
        vy: 1.5 + Math.random() * 4,
        vz: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.2 + Math.random() * 0.15,
        size: scale,
        growth: -0.8,
        rotSpeed: 0,
        type: 'spark',
      });
    }
  }

  // ── EMIT SUBTLE ENGINE SMOKE & FLAMES ─────────────────────
  public emitSmokeAndFire(x: number, y: number, z: number, isCritical: boolean = false) {
    if (this.particles.length >= this.maxParticles) return;

    const smokeMesh = new THREE.Mesh(this.particleGeo, this.smokeMat.clone());
    const scale = 0.3 + Math.random() * 0.3;
    smokeMesh.scale.set(scale, scale, scale);
    smokeMesh.position.set(x, y, z);
    this.scene.add(smokeMesh);

    this.particles.push({
      mesh: smokeMesh,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 1.5 + Math.random() * 1.2,
      vz: (Math.random() - 0.5) * 0.6,
      life: 0,
      maxLife: 0.7 + Math.random() * 0.4,
      size: scale,
      growth: 1.8,
      rotSpeed: (Math.random() - 0.5) * 2,
      type: 'smoke',
    });

    if (isCritical && Math.random() > 0.5) {
      const fireMesh = new THREE.Mesh(this.particleGeo, this.fireMat.clone());
      const fScale = 0.2 + Math.random() * 0.25;
      fireMesh.scale.set(fScale, fScale, fScale);
      fireMesh.position.set(x, y, z);
      this.scene.add(fireMesh);

      this.particles.push({
        mesh: fireMesh,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 1.0 + Math.random() * 0.8,
        vz: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.15,
        size: fScale,
        growth: 1.0,
        rotSpeed: 0,
        type: 'fire',
      });
    }
  }

  // ── UPDATE PHYSICAL DEBRIS MESHES ─────────────────────────
  public updateDebris(debrisList: DebrisPiece[], dt: number = 0.016) {
    for (let i = debrisList.length - 1; i >= 0; i--) {
      const d = debrisList[i];
      d.life += dt;

      if (d.life >= d.maxLife) {
        const mesh = this.debrisMeshes.get(d.id);
        if (mesh) {
          this.scene.remove(mesh);
          this.debrisMeshes.delete(d.id);
        }
        debrisList.splice(i, 1);
        continue;
      }

      if (d.y > 0.15) {
        d.vy -= 12 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        d.rotX += d.vRotX * dt;
        d.rotY += d.vRotY * dt;
        d.rotZ += d.vRotZ * dt;
      } else {
        d.y = 0.15;
        d.vx *= 0.8;
        d.vz *= 0.8;
        d.vy = 0;
      }

      let mesh = this.debrisMeshes.get(d.id);
      if (!mesh) {
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(d.color),
          roughness: 0.6,
          metalness: 0.6,
        });
        mesh = new THREE.Mesh(this.boxDebrisGeo, mat);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.debrisMeshes.set(d.id, mesh);
      }

      mesh.position.set(d.x, d.y, d.z);
      mesh.rotation.set(d.rotX, d.rotY, d.rotZ);
      mesh.scale.set(d.scale, d.scale, d.scale);
    }
  }

  // ── UPDATE PARTICLES ──────────────────────────────────────
  public update(dt: number = 0.016) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      const lifeRatio = p.life / p.maxLife;
      const currentScale = Math.max(0.01, p.size + p.growth * p.life);
      p.mesh.scale.set(currentScale, currentScale, currentScale);

      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      if (mat) {
        const maxOp = p.type === 'dust' ? 0.2 : p.type === 'smoke' ? 0.35 : 0.8;
        mat.opacity = Math.max(0, maxOp * (1.0 - lifeRatio));
      }
    }
  }

  public clear() {
    this.particles.forEach((p) => this.scene.remove(p.mesh));
    this.particles = [];

    this.debrisMeshes.forEach((mesh) => this.scene.remove(mesh));
    this.debrisMeshes.clear();
  }
}
