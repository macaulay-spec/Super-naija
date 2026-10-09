import * as THREE from 'three';
import type { VehicleDef } from '../core/types';
import type { Collider } from '../world/City';

// ============================================================
// Vehicle — driveable with simple arcade physics
// ============================================================

export interface VehicleModel { group: THREE.Group; wheels: THREE.Mesh[]; }

function wheelMesh(r: number, w: number, dark = 0x1a1a1a) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 12), new THREE.MeshLambertMaterial({ color: dark }));
  m.rotation.z = Math.PI / 2;
  return m;
}

export function buildVehicleModel(def: VehicleDef): VehicleModel {
  const g = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  const bodyMat = new THREE.MeshLambertMaterial({ color: def.color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x223344, emissive: 0x0a1018 });
  const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

  const add = (mesh: THREE.Mesh, x: number, y: number, z: number) => { mesh.position.set(x, y, z); g.add(mesh); return mesh; };

  if (def.kind === 'okada') {
    // Motorcycle
    add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 1.6), bodyMat), 0, 0.75, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.7), blackMat), 0, 1.0, -0.2);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), bodyMat), 0, 1.2, -0.75);
    const wf = wheelMesh(0.4, 0.18); add(wf, 0, 0.4, 0.85); wheels.push(wf);
    const wb = wheelMesh(0.4, 0.2); add(wb, 0, 0.4, -0.85); wheels.push(wb);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.6), blackMat), 0, 0.95, 0.7);
  } else if (def.kind === 'keke') {
    // Tricycle (Keke NAPEP)
    add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 2.4), bodyMat), 0, 1.0, -0.2);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.0), bodyMat), 0, 0.9, 1.4);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 2.2), glassMat), 0, 1.4, -0.2);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 3.4), blackMat), 0, 0.35, 0);
    const wf = wheelMesh(0.42, 0.2); add(wf, 0, 0.42, 1.6); wheels.push(wf);
    const wl = wheelMesh(0.42, 0.2); add(wl, -0.75, 0.42, -0.9); wheels.push(wl);
    const wr = wheelMesh(0.42, 0.2); add(wr, 0.75, 0.42, -0.9); wheels.push(wr);
  } else if (def.kind === 'bus') {
    // Danfo minibus — yellow with black stripes
    add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 5.4), bodyMat), 0, 1.35, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.35, 5.44), blackMat), 0, 1.05, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.35, 5.44), blackMat), 0, 1.75, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 5.0), glassMat), 0, 1.5, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.25, 5.6), blackMat), 0, 0.35, 0);
    const wf1 = wheelMesh(0.5, 0.3); add(wf1, -1.05, 0.5, 1.8); wheels.push(wf1);
    const wf2 = wheelMesh(0.5, 0.3); add(wf2, 1.05, 0.5, 1.8); wheels.push(wf2);
    const wb1 = wheelMesh(0.5, 0.3); add(wb1, -1.05, 0.5, -1.8); wheels.push(wb1);
    const wb2 = wheelMesh(0.5, 0.3); add(wb2, 1.05, 0.5, -1.8); wheels.push(wb2);
  } else {
    // Car / taxi
    add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 4.2), bodyMat), 0, 0.75, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.2), glassMat), 0, 1.35, -0.2);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.25, 4.24), blackMat), 0, 0.45, 0);
    if (def.kind === 'taxi') {
      add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 })), 0, 1.8, -0.2);
    }
    const wf1 = wheelMesh(0.42, 0.28); add(wf1, -0.95, 0.42, 1.4); wheels.push(wf1);
    const wf2 = wheelMesh(0.42, 0.28); add(wf2, 0.95, 0.42, 1.4); wheels.push(wf2);
    const wb1 = wheelMesh(0.42, 0.28); add(wb1, -0.95, 0.42, -1.4); wheels.push(wb1);
    const wb2 = wheelMesh(0.42, 0.28); add(wb2, 0.95, 0.42, -1.4); wheels.push(wb2);
  }

  // headlights
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const hl = new THREE.Mesh(new THREE.BoxGeometry(def.kind === 'bus' ? 1.8 : 1.2, 0.2, 0.1), lightMat);
  hl.position.set(0, 0.7, def.kind === 'bus' ? 2.72 : def.kind === 'okada' ? 1.3 : 2.12);
  g.add(hl);

  return { group: g, wheels };
}

export class Vehicle {
  def: VehicleDef;
  id: string;
  model: VehicleModel;
  group: THREE.Group;
  position = new THREE.Vector3();
  velocity = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  steer = 0;
  occupied = false;
  driverId: string | null = null;
  fuel = 100;
  health = 100;
  owned = false;
  private radius: number;
  private wheelSpin = 0;

  constructor(id: string, def: VehicleDef) {
    this.id = id;
    this.def = def;
    this.model = buildVehicleModel(def);
    this.group = this.model.group;
    this.radius = def.kind === 'bus' ? 1.6 : def.kind === 'car' || def.kind === 'taxi' ? 1.2 : 0.9;
  }

  setPosition(x: number, y: number, z: number) { this.position.set(x, y, z); this.group.position.copy(this.position); }

  update(dt: number, input: { throttle: number; steer: number; brake: boolean }, colliders: Collider[]) {
    const maxSpeed = this.def.maxSpeed * (this.fuel > 0 ? 1 : 0.25);
    const accel = this.def.accel;

    // Throttle
    if (input.throttle > 0.05) this.speed += accel * input.throttle * dt;
    else if (input.throttle < -0.05) this.speed += accel * 0.7 * input.throttle * dt;
    else this.speed *= (1 - 1.6 * dt);

    if (input.brake) this.speed *= (1 - 4 * dt);

    this.speed = Math.max(-maxSpeed * 0.5, Math.min(maxSpeed, this.speed));
    if (Math.abs(this.speed) < 0.05) this.speed = 0;

    // Steering — scales with speed
    const steerRate = 2.2 * (0.4 + Math.min(1, Math.abs(this.speed) / 8));
    this.yaw -= input.steer * steerRate * dt * Math.sign(this.speed || 1);

    // Fuel consumption
    if (Math.abs(this.speed) > 0.5) this.fuel = Math.max(0, this.fuel - Math.abs(this.speed) * 0.0025 * dt);

    // Move
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const nx = this.position.x + fx * this.speed * dt;
    const nz = this.position.z + fz * this.speed * dt;

    if (!this.hit(nx, this.position.z, colliders)) this.position.x = nx; else this.speed *= -0.2;
    if (!this.hit(this.position.x, nz, colliders)) this.position.z = nz; else this.speed *= -0.2;

    const lim = 300;
    this.position.x = Math.max(-lim, Math.min(lim, this.position.x));
    this.position.z = Math.max(-lim, Math.min(lim, this.position.z));

    // Wheels spin
    this.wheelSpin += this.speed * dt * 3;
    for (const w of this.model.wheels) w.rotation.x = this.wheelSpin;

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }

  private hit(x: number, z: number, colliders: Collider[]): boolean {
    for (const c of colliders) {
      if (c.maxY < 0.3) continue;
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < this.radius * this.radius) return true;
    }
    return false;
  }

  getSpeedKmh() { return Math.abs(this.speed) * 3.6; }
}
