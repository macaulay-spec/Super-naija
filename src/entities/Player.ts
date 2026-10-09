import * as THREE from 'three';
import { WORLD } from '../core/types';
import { SKIN_TONES, HAIR_STYLES } from '../data/gamedata';
import type { Collider } from '../world/City';

// ============================================================
// Character rig — shared by player and NPCs/remote players
// ============================================================

export interface Rig {
  group: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  hair: THREE.Mesh;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  setSkin: (i: number) => void;
  setOutfit: (c: string) => void;
  setHair: (i: number) => void;
  materials: THREE.Material[];
}

function limb(color: THREE.ColorRepresentation, w: number, h: number, d: number) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.y = -h / 2;
  g.add(m);
  return { g, m };
}

export function buildCharacter(skinIdx = 2, outfit = '#e8b923', hairIdx = 0): Rig {
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const skin = new THREE.Color(SKIN_TONES[skinIdx] || SKIN_TONES[2]);

  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const outfitMat = new THREE.MeshLambertMaterial({ color: outfit });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x140f0a });
  materials.push(skinMat, outfitMat, pantsMat, hairMat);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), outfitMat);
  torso.position.y = 1.25;
  group.add(torso);

  // Hips
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.28), pantsMat);
  hips.position.y = 0.9;
  group.add(hips);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skinMat);
  head.position.y = 1.78;
  group.add(head);

  // Hair
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.36), hairMat);
  hair.position.y = 1.96;
  group.add(hair);

  // Arms
  const armL = limb(skin, 0.16, 0.62, 0.18);
  armL.g.position.set(-0.36, 1.5, 0);
  group.add(armL.g);
  const armR = limb(skin, 0.16, 0.62, 0.18);
  armR.g.position.set(0.36, 1.5, 0);
  group.add(armR.g);
  // sleeves
  const sleeveL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.24, 0.21), outfitMat);
  sleeveL.position.y = -0.12; armL.g.add(sleeveL);
  const sleeveR = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.24, 0.21), outfitMat);
  sleeveR.position.y = -0.12; armR.g.add(sleeveR);

  // Legs
  const legL = limb(0x2b3a55, 0.2, 0.82, 0.22);
  legL.g.position.set(-0.15, 0.86, 0);
  group.add(legL.g);
  const legR = limb(0x2b3a55, 0.2, 0.82, 0.22);
  legR.g.position.set(0.15, 0.86, 0);
  group.add(legR.g);

  const setSkin = (i: number) => { skinMat.color.set(SKIN_TONES[i] || SKIN_TONES[2]); };
  const setOutfit = (c: string) => { outfitMat.color.set(c); };
  const setHair = (i: number) => {
    if (i === 1) { hair.scale.set(1.35, 1.9, 1.35); hair.position.y = 2.02; }
    else if (i === 2) { hair.scale.set(1.2, 3.2, 1.2); hair.position.y = 2.05; }
    else if (i === 3) { hair.scale.set(1.25, 0.7, 1.3); hair.position.y = 1.99; hairMat.color.set(0x8b1a1a); }
    else { hair.scale.set(1, 1, 1); hair.position.y = 1.96; hairMat.color.set(0x140f0a); }
  };
  setHair(hairIdx);

  return { group, torso, head, hair, armL: armL.g, armR: armR.g, legL: legL.g, legR: legR.g, setSkin, setOutfit, setHair, materials };
}

// ============================================================
// Player — third-person controllable character
// ============================================================

export class Player {
  rig: Rig;
  group: THREE.Group;
  position = new THREE.Vector3();
  velocity = new THREE.Vector3();
  yaw = 0;
  grounded = true;
  speed = 0;
  animPhase = 0;
  animState: 'idle' | 'walk' | 'run' | 'jump' = 'idle';
  inVehicle = false;
  name: string;
  onFootstep?: () => void;

  private radius = 0.42;
  private height = 1.9;

  constructor(name = 'Player', skin = 2, outfit = '#e8b923', hair = 0) {
    this.name = name;
    this.rig = buildCharacter(skin, outfit, hair);
    this.group = this.rig.group;
  }

  setAppearance(skin: number, outfit: string, hair: number) {
    this.rig.setSkin(skin); this.rig.setOutfit(outfit); this.rig.setHair(hair);
  }

  setPosition(x: number, y: number, z: number) { this.position.set(x, y, z); this.group.position.copy(this.position); }

  update(dt: number, input: { moveX: number; moveY: number; sprint: boolean; jump: boolean }, camYaw: number, colliders: Collider[], canJump = true) {
    if (this.inVehicle) return;

    // Desired direction relative to camera
    const mag = Math.hypot(input.moveX, input.moveY);
    let dirX = 0, dirZ = 0;
    if (mag > 0.08) {
      const nx = input.moveX / mag, nz = input.moveY / mag;
      // camera forward = (sin(camYaw), cos(camYaw)) mapped; moveY forward is -Z in local
      const forwardX = -Math.sin(camYaw);
      const forwardZ = -Math.cos(camYaw);
      const rightX = Math.cos(camYaw);
      const rightZ = -Math.sin(camYaw);
      dirX = forwardX * -nz + rightX * nx;
      dirZ = forwardZ * -nz + rightZ * nx;
      const dl = Math.hypot(dirX, dirZ) || 1;
      dirX /= dl; dirZ /= dl;
    }

    const running = input.sprint && mag > 0.08;
    const targetSpeed = mag > 0.08 ? (running ? 8.2 : 4.4) : 0;
    const accel = this.grounded ? 26 : 8;

    const desiredVX = dirX * targetSpeed;
    const desiredVZ = dirZ * targetSpeed;
    this.velocity.x += (desiredVX - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (desiredVZ - this.velocity.z) * Math.min(1, accel * dt);

    // Gravity & jump
    if (canJump && input.jump && this.grounded) {
      this.velocity.y = 8.2;
      this.grounded = false;
    }
    this.velocity.y += WORLD.GRAVITY * dt;

    // Integrate with collision (axis separated)
    const nx = this.position.x + this.velocity.x * dt;
    if (!this.hit(nx, this.position.z, colliders)) this.position.x = nx;
    else this.velocity.x = 0;

    const nz = this.position.z + this.velocity.z * dt;
    if (!this.hit(this.position.x, nz, colliders)) this.position.z = nz;
    else this.velocity.z = 0;

    this.position.y += this.velocity.y * dt;
    if (this.position.y <= 0) { this.position.y = 0; this.velocity.y = 0; this.grounded = true; }

    // Keep in bounds
    const lim = WORLD.SIZE / 2 + 40;
    this.position.x = Math.max(-lim, Math.min(lim, this.position.x));
    this.position.z = Math.max(-lim, Math.min(lim, this.position.z));

    // Orientation
    const spd = Math.hypot(this.velocity.x, this.velocity.z);
    this.speed = spd;
    if (spd > 0.4) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      let d = targetYaw - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, 14 * dt);
    }

    // Animation
    if (!this.grounded) this.animState = 'jump';
    else if (spd > 5.5) this.animState = 'run';
    else if (spd > 0.4) this.animState = 'walk';
    else this.animState = 'idle';

    const freq = this.animState === 'run' ? 12 : 8;
    if (this.animState !== 'idle') {
      this.animPhase += dt * freq;
      const prevStep = Math.floor((this.animPhase - dt * freq) / Math.PI);
      const step = Math.floor(this.animPhase / Math.PI);
      if (step !== prevStep && this.grounded) this.onFootstep?.();
    } else {
      this.animPhase += dt * 2;
    }
    this.applyAnim();

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }

  private applyAnim() {
    const swing = this.animState === 'idle' ? Math.sin(this.animPhase) * 0.05 : Math.sin(this.animPhase) * (this.animState === 'run' ? 0.9 : 0.6);
    const bob = this.animState === 'idle' ? Math.sin(this.animPhase) * 0.01 : Math.abs(Math.sin(this.animPhase)) * 0.05;
    this.rig.legL.rotation.x = swing;
    this.rig.legR.rotation.x = -swing;
    this.rig.armL.rotation.x = -swing * 0.8;
    this.rig.armR.rotation.x = swing * 0.8;
    if (this.animState === 'jump') {
      this.rig.legL.rotation.x = -0.5; this.rig.legR.rotation.x = 0.3;
      this.rig.armL.rotation.x = -1.2; this.rig.armR.rotation.x = -1.2;
    }
    this.rig.torso.position.y = 1.25 + bob;
    this.rig.head.position.y = 1.78 + bob;
    this.rig.hair.position.y = (this.rig.hair.scale.y > 1.5 ? 2.05 : this.rig.hair.scale.y > 1.2 ? 2.02 : 1.96) + bob;
  }

  private hit(x: number, z: number, colliders: Collider[]): boolean {
    const y = this.position.y;
    for (const c of colliders) {
      if (y + this.height < c.minY || y > c.maxY) continue;
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < this.radius * this.radius) return true;
    }
    return false;
  }

  // Find a safe position near (x,z) — used when exiting interiors/vehicles
  placeSafe(x: number, z: number, colliders: Collider[]) {
    if (!this.hit(x, z, colliders)) { this.position.set(x, 0, z); return; }
    for (let r = 1; r < 8; r += 1) {
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const tx = x + Math.cos(ang) * r;
        const tz = z + Math.sin(ang) * r;
        if (!this.hit(tx, tz, colliders)) { this.position.set(tx, 0, tz); return; }
      }
    }
    this.position.set(x, 0, z);
  }

  getAnimName() { return this.animState; }
}
