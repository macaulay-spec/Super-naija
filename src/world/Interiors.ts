import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Collider, Interactable } from './City';

export interface Interior {
  id: string;
  group: THREE.Group;
  colliders: Collider[];
  interactables: Interactable[];
  spawn: THREE.Vector3;
  exit: THREE.Vector3;
  baseY: number;
}

const ROOM_W = 26;
const ROOM_D = 20;
const ROOM_H = 4.2;

function mat(color: string, emissive = 0.28) {
  const c = new THREE.Color(color);
  return new THREE.MeshLambertMaterial({ color: c, emissive: c.clone().multiplyScalar(emissive) });
}

function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export class Interiors {
  group = new THREE.Group();
  map = new Map<string, Interior>();
  private types = ['shop', 'restaurant', 'garage', 'office', 'police', 'bank', 'hangout', 'home'];

  constructor() {
    this.types.forEach((t, i) => {
      const baseY = -1000 - i * 60;
      const interior = this.build(t, baseY);
      this.map.set(t, interior);
      this.group.add(interior.group);
    });
  }

  private build(type: string, baseY: number): Interior {
    const g = new THREE.Group();
    g.position.set(0, baseY, 0);
    const colliders: Collider[] = [];
    const interactables: Interactable[] = [];
    const W = ROOM_W, D = ROOM_D, H = ROOM_H;
    const t = 0.5;

    // Floor
    const floor = box(g, 0, 0.05, 0, W, 0.1, D, type === 'garage' ? '#4a4a4a' : '#8a7a60');
    // Ceiling
    box(g, 0, H, 0, W, 0.2, D, '#c8c0b0');

    // Walls with a door gap on +Z (south)
    box(g, -W / 2, H / 2, 0, t, H, D, '#c9b8a0');
    box(g, W / 2, H / 2, 0, t, H, D, '#c9b8a0');
    box(g, 0, H / 2, -D / 2, W, H, t, '#c9b8a0');
    const gap = 4;
    const sideW = (W - gap) / 2;
    box(g, -sideW / 2 - gap / 2, H / 2, D / 2, sideW, H, t, '#c9b8a0');
    box(g, sideW / 2 + gap / 2, H / 2, D / 2, sideW, H, t, '#c9b8a0');
    // door frame
    box(g, 0, H / 2 + 0.4, D / 2, gap + 0.6, H - 0.8, 0.3, '#5c4033');

    colliders.push({ minX: -W / 2 - t, maxX: -W / 2 + t, minZ: -D / 2, maxZ: D / 2, minY: baseY, maxY: baseY + H });
    colliders.push({ minX: W / 2 - t, maxX: W / 2 + t, minZ: -D / 2, maxZ: D / 2, minY: baseY, maxY: baseY + H });
    colliders.push({ minX: -W / 2, maxX: W / 2, minZ: -D / 2 - t, maxZ: -D / 2 + t, minY: baseY, maxY: baseY + H });
    colliders.push({ minX: -W / 2, maxX: -gap / 2, minZ: D / 2 - t, maxZ: D / 2 + t, minY: baseY, maxY: baseY + H });
    colliders.push({ minX: gap / 2, maxX: W / 2, minZ: D / 2 - t, maxZ: D / 2 + t, minY: baseY, maxY: baseY + H });

    const addI = (id: string, kind: string, label: string, x: number, z: number, radius: number, data: any) => {
      interactables.push({ id, kind, label, position: new THREE.Vector3(x, baseY, z), radius, data });
    };

    // ---- Furnish by type ----
    if (type === 'shop') {
      for (let r = 0; r < 4; r++) {
        box(g, -6 + r * 4, 1.0, -4, 2.5, 2, 8, '#8a6b40');
        box(g, -6 + r * 4, 2.2, -4, 2.5, 0.2, 8, '#b5651d');
      }
      box(g, 0, 0.6, 6, 10, 1.2, 2, '#5c4033');
      addI('i_shop_counter', 'shop', 'Buy Groceries', 0, 4.5, 4, { shop: 'supermarket' });
    } else if (type === 'restaurant') {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
        const tx = -6 + r * 6, tz = -4 + c * 7;
        box(g, tx, 0.9, tz, 3, 0.2, 3, '#a8845c');
        box(g, tx, 0.45, tz, 0.3, 0.9, 0.3, '#5c4033');
        box(g, tx - 1.6, 0.5, tz, 1, 1, 1, '#8a6b40');
        box(g, tx + 1.6, 0.5, tz, 1, 1, 1, '#8a6b40');
      }
      box(g, 0, 0.6, 7, 12, 1.2, 2, '#5c4033');
      addI('i_rest_table', 'restaurant', 'Order & Eat', 0, 5, 4, { shop: 'restaurant' });
    } else if (type === 'garage') {
      box(g, -6, 0.8, -3, 8, 1.6, 4, '#3a3a3a');
      box(g, -6, 1.7, -3, 7, 0.3, 3, '#555');
      box(g, 6, 1.2, 2, 6, 2.4, 1, '#7a4a2b');
      box(g, 6, 2.5, 2, 6, 0.2, 1.2, '#b5651d');
      // a car on the lift
      box(g, -6, 2.6, -3, 4, 1, 2, '#2b3a67');
      box(g, -6, 3.3, -3, 2.2, 0.8, 1.8, '#1a2540');
      addI('i_garage_bench', 'garage', 'Repair Vehicle', 6, 0, 4, {});
    } else if (type === 'office') {
      for (let r = 0; r < 3; r++) {
        box(g, -7 + r * 7, 0.75, 0, 3, 0.15, 5, '#8a6b40');
        box(g, -7 + r * 7, 0.4, 0, 0.2, 0.75, 5, '#5c4033');
        box(g, -7 + r * 7, 1.1, -1.5, 1.2, 0.8, 0.1, '#222');
        box(g, -7 + r * 7, 0.5, 2, 1.2, 1, 1.2, '#3a3a3a');
      }
      addI('i_office_desk', 'office', 'Work Shift', 0, 3, 4, {});
    } else if (type === 'police') {
      box(g, 0, 0.6, 5, 12, 1.2, 2, '#3a4a6a');
      for (let r = 0; r < 2; r++) {
        box(g, -8 + r * 16, 1.5, -5, 5, 3, 5, '#5a5a5a');
        // bars
        for (let b = 0; b < 5; b++) box(g, -10 + r * 16 + b, 1.5, -2.6, 0.1, 3, 0.1, '#999');
      }
      addI('i_police_desk', 'police', 'Pay Fine / Report', 0, 4, 4, {});
    } else if (type === 'bank') {
      box(g, 0, 0.6, 5, 16, 1.2, 2, '#d2b48c');
      for (let b = 0; b < 3; b++) box(g, -6 + b * 6, 1.6, 4, 3, 0.3, 1.5, '#8a6b40');
      box(g, 0, 1.5, -6, 8, 3, 3, '#4a4a4a');
      box(g, 0, 3.1, -6, 8.4, 0.3, 3.4, '#333');
      addI('i_bank_teller', 'bank', 'Deposit / Withdraw', 0, 4.5, 4, {});
    } else if (type === 'hangout') {
      box(g, 0, 0.6, -4, 14, 1.2, 2, '#5c4033');
      box(g, 0, 2.6, -6, 6, 3, 0.4, '#111');
      for (let s = 0; s < 5; s++) box(g, -5 + s * 2.5, 0.5, -2, 0.8, 1, 0.8, '#8a6b40');
      for (let r = 0; r < 2; r++) {
        box(g, -6 + r * 12, 0.9, 4, 3, 0.2, 3, '#a8845c');
        box(g, -6 + r * 12, 0.45, 4, 0.3, 0.9, 0.3, '#5c4033');
      }
      addI('i_bar_counter', 'hangout', 'Buy Drinks', 0, -2, 4, { shop: 'bar' });
    } else if (type === 'home') {
      // bed
      box(g, -8, 0.5, -5, 4, 1, 6, '#5c4033');
      box(g, -8, 1.1, -5, 3.8, 0.4, 5.8, '#c9b8a0');
      box(g, -8, 1.4, -7, 3.8, 0.8, 1, '#e8e0d0');
      // couch + tv
      box(g, 6, 0.6, 4, 5, 1, 2, '#7a4a2b');
      box(g, 6, 1.2, 5, 5, 1, 0.4, '#7a4a2b');
      box(g, 6, 2.2, -6, 5, 3, 0.3, '#111');
      // kitchen
      box(g, 8, 0.6, -5, 6, 1.2, 3, '#b0a08a');
      box(g, 8, 1.3, -5, 6, 0.2, 3, '#8a7a60');
      // shower
      box(g, -10, 1.2, 6, 3, 2.4, 3, '#8fb0c0');
      addI('i_home_bed', 'bed', 'Sleep (restore energy)', -8, -1, 4, { rest: 100 });
      addI('i_home_shower', 'shower', 'Bathe (restore hygiene)', -10, 4, 4, { hygiene: 100 });
      addI('i_home_kitchen', 'kitchen', 'Cook & Eat', 8, -3, 4, { hunger: 60 });
      addI('i_home_storage', 'storage', 'Storage Chest', 0, 6, 4, {});
    }

    // Exit trigger
    const exit = new THREE.Vector3(0, baseY, D / 2 + 1.5);
    const spawn = new THREE.Vector3(0, baseY, D / 2 - 3);

    // Point light for the room
    const light = new THREE.PointLight(0xfff2d0, 1.1, 40, 1.5);
    light.position.set(0, H - 0.5, 0);
    g.add(light);

    return { id: type, group: g, colliders, interactables, spawn, exit, baseY };
  }

  get(type: string): Interior | undefined {
    return this.map.get(type);
  }
}
