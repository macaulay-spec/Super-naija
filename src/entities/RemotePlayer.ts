import * as THREE from 'three';
import { buildCharacter, type Rig } from './Player';
import type { NetPlayer } from '../core/types';

// ============================================================
// RemotePlayer — other real players rendered in the shared world
// ============================================================

export class RemotePlayer {
  id: string;
  name: string;
  rig: Rig;
  group: THREE.Group;
  target = new THREE.Vector3();
  position = new THREE.Vector3();
  targetYaw = 0;
  yaw = 0;
  anim = 'idle';
  vehicleId: string | null = null;
  label: THREE.Sprite;
  private phase = 0;
  private lastUpdate = performance.now();

  constructor(p: NetPlayer) {
    this.id = p.id;
    this.name = p.name;
    this.rig = buildCharacter(p.skin ?? 2, p.outfit ?? '#e8b923', p.hair ?? 0);
    this.group = this.rig.group;
    this.position.set(p.x, p.y, p.z);
    this.target.copy(this.position);
    this.group.position.copy(this.position);
    this.label = this.makeLabel(p.name);
    this.label.position.y = 2.4;
    this.group.add(this.label);
  }

  private makeLabel(name: string): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.roundRect?.(0, 0, 256, 64, 16);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name.slice(0, 16), 128, 34);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const s = new THREE.Sprite(mat);
    s.scale.set(2.2, 0.55, 1);
    return s;
  }

  setState(x: number, y: number, z: number, ry: number, anim: string, vehicleId: string | null) {
    this.target.set(x, y, z);
    this.targetYaw = ry;
    this.anim = anim;
    this.vehicleId = vehicleId;
    this.lastUpdate = performance.now();
  }

  update(dt: number) {
    // Interpolate toward target
    this.position.lerp(this.target, Math.min(1, 12 * dt));
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, 12 * dt);
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;

    // Animate
    const moving = this.anim === 'walk' || this.anim === 'run';
    const speedMul = this.anim === 'run' ? 12 : 8;
    this.phase += dt * speedMul * (moving ? 1 : 0.25);
    const s = Math.sin(this.phase) * (moving ? (this.anim === 'run' ? 0.9 : 0.6) : 0.05);
    this.rig.legL.rotation.x = s;
    this.rig.legR.rotation.x = -s;
    this.rig.armL.rotation.x = -s * 0.8;
    this.rig.armR.rotation.x = s * 0.8;
    if (this.anim === 'jump') {
      this.rig.legL.rotation.x = -0.5; this.rig.legR.rotation.x = 0.3;
      this.rig.armL.rotation.x = -1.2; this.rig.armR.rotation.x = -1.2;
    }
    // Hide body if in a vehicle
    this.rig.torso.visible = !this.vehicleId;
    this.rig.head.visible = !this.vehicleId;
    this.rig.hair.visible = !this.vehicleId;
    this.rig.armL.visible = !this.vehicleId;
    this.rig.armR.visible = !this.vehicleId;
    this.rig.legL.visible = !this.vehicleId;
    this.rig.legR.visible = !this.vehicleId;
  }

  isStale() { return performance.now() - this.lastUpdate > 12000; }

  dispose() {
    this.group.removeFromParent();
    this.rig.materials.forEach((m) => m.dispose());
    (this.label.material as THREE.SpriteMaterial).map?.dispose();
    this.label.material.dispose();
  }
}
