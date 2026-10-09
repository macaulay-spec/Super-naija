import * as THREE from 'three';
import { buildCharacter, type Rig } from './Player';
import { buildVehicleModel, type VehicleModel } from './Vehicle';
import { VEHICLES } from '../data/gamedata';
import type { City } from '../world/City';

// ============================================================
// NPCs — pedestrians and ambient traffic
// ============================================================

const NPC_NAMES = ['Tunde', 'Bola', 'Ngozi', 'Emeka', 'Aisha', 'Segun', 'Yemi', 'Chidi', 'Funke', 'Musa', 'Kemi', 'Uche', 'Tayo', 'Halima', 'Ife', 'Dapo'];
const OUTFITS = ['#e8b923', '#c0392b', '#2a7d4f', '#2b5fa8', '#8e44ad', '#e67e22', '#16a085', '#c9a24b'];

export class Pedestrian {
  rig: Rig;
  group: THREE.Group;
  position = new THREE.Vector3();
  yaw = 0;
  speed = 1.4;
  private target = new THREE.Vector3();
  private phase = 0;
  private waitTimer = 0;
  name: string;

  constructor(x: number, z: number) {
    this.name = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
    this.rig = buildCharacter(Math.floor(Math.random() * 6), OUTFITS[Math.floor(Math.random() * OUTFITS.length)], Math.floor(Math.random() * 4));
    this.group = this.rig.group;
    this.position.set(x, 0, z);
    this.pickTarget();
  }

  private pickTarget() {
    const r = 12 + Math.random() * 30;
    const a = Math.random() * Math.PI * 2;
    this.target.set(this.position.x + Math.cos(a) * r, 0, this.position.z + Math.sin(a) * r);
    this.waitTimer = Math.random() * 3;
  }

  update(dt: number) {
    if (this.waitTimer > 0) { this.waitTimer -= dt; this.animate(dt, 0); return; }
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 1) { this.pickTarget(); return; }
    const nx = dx / d, nz = dz / d;
    this.position.x += nx * this.speed * dt;
    this.position.z += nz * this.speed * dt;
    const targetYaw = Math.atan2(nx, nz);
    let dy = targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, 8 * dt);
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.animate(dt, 1);
  }

  private animate(dt: number, moving: number) {
    this.phase += dt * 8 * (moving || 0.3);
    const s = Math.sin(this.phase) * 0.5 * moving;
    this.rig.legL.rotation.x = s;
    this.rig.legR.rotation.x = -s;
    this.rig.armL.rotation.x = -s;
    this.rig.armR.rotation.x = s;
  }
}

export class TrafficCar {
  model: VehicleModel;
  group: THREE.Group;
  position = new THREE.Vector3();
  yaw = 0;
  speed: number;
  private from: THREE.Vector3;
  private to: THREE.Vector3;
  private progress = 0;
  private wheelSpin = 0;

  constructor(city: City, kind: string) {
    const def = VEHICLES[kind] || VEHICLES.car;
    this.model = buildVehicleModel(def);
    this.group = this.model.group;
    this.speed = 8 + Math.random() * 6;
    const edge = city.roadEdges[Math.floor(Math.random() * city.roadEdges.length)];
    const a = city.roadNodes[edge[0]], b = city.roadNodes[edge[1]];
    this.from = new THREE.Vector3(a.x, 0, a.z);
    this.to = new THREE.Vector3(b.x, 0, b.z);
    this.position.copy(this.from);
    this.yaw = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }

  update(dt: number, city: City) {
    const dist = this.from.distanceTo(this.to);
    this.progress += (this.speed * dt) / dist;
    if (this.progress >= 1) {
      // pick a new connected edge
      this.progress = 0;
      this.from.copy(this.to);
      const node = city.roadNodes.find((n) => Math.abs(n.x - this.to.x) < 0.5 && Math.abs(n.z - this.to.z) < 0.5);
      const candidates = city.roadEdges.filter((e) => e[0] === node?.id || e[1] === node?.id);
      if (candidates.length) {
        const e = candidates[Math.floor(Math.random() * candidates.length)];
        const otherId = e[0] === node?.id ? e[1] : e[0];
        const o = city.roadNodes[otherId];
        this.to.set(o.x, 0, o.z);
      }
      this.yaw = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
    }
    this.position.lerpVectors(this.from, this.to, this.progress);
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.wheelSpin += this.speed * dt * 3;
    for (const w of this.model.wheels) w.rotation.x = this.wheelSpin;
  }
}

export class NPCManager {
  group = new THREE.Group();
  pedestrians: Pedestrian[] = [];
  traffic: TrafficCar[] = [];

  constructor(city: City, pedCount: number, trafficCount: number) {
    const spawn = city.getSpawnPoint();
    for (let i = 0; i < pedCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 90;
      const p = new Pedestrian(spawn.x + Math.cos(a) * r, spawn.z + Math.sin(a) * r);
      this.pedestrians.push(p);
      this.group.add(p.group);
    }
    for (let i = 0; i < trafficCount; i++) {
      const kinds = ['danfo', 'taxi', 'keke', 'okada', 'car'];
      const t = new TrafficCar(city, kinds[Math.floor(Math.random() * kinds.length)]);
      this.traffic.push(t);
      this.group.add(t.group);
    }
  }

  update(dt: number, city: City, playerPos: THREE.Vector3) {
    // Only update NPCs near the player for performance
    for (const p of this.pedestrians) {
      const d = p.position.distanceToSquared(playerPos);
      if (d < 120 * 120) p.update(dt);
    }
    for (const t of this.traffic) {
      const d = t.position.distanceToSquared(playerPos);
      if (d < 200 * 200) t.update(dt, city);
    }
  }

  setCount(ped: number, traffic: number) {
    this.pedestrians.forEach((p, i) => (p.group.visible = i < ped));
    this.traffic.forEach((t, i) => (t.group.visible = i < traffic));
  }
}
