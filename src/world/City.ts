import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD } from '../core/types';
import { PROPERTIES, JOBS, BUSINESSES } from '../data/gamedata';

// ============================================================
// City — procedural Ibadan-inspired world
// ============================================================

export interface Collider { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number; }
export interface Interactable {
  id: string; kind: string; label: string;
  position: THREE.Vector3; radius: number; data?: any;
}
export interface Footprint { x: number; z: number; w: number; d: number; c: string; }

const WALL_COLORS = ['#c9a24b', '#b5651d', '#d9c7a3', '#8fae7a', '#c98b7a', '#a9b7c6', '#e0c27a', '#b0a08a', '#d2b48c', '#9c8f7a', '#a8845c', '#c2b280'];
const ROOF_COLORS = ['#7a4a2b', '#8b5a2b', '#6b4226', '#5c4033', '#7d5a3c', '#4a4a4a', '#8a4b2a'];
const AWNING_COLORS = ['#d33', '#2a7', '#26c', '#e8b923', '#e67e22', '#8e44ad'];

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addBox(geos: THREE.BufferGeometry[], cx: number, cy: number, cz: number, w: number, h: number, d: number, color: string, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(cx, cy, cz);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geos.push(g);
}

function addCyl(geos: THREE.BufferGeometry[], cx: number, cy: number, cz: number, r: number, h: number, color: string, seg = 6) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  g.translate(cx, cy, cz);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geos.push(g);
}

function addCone(geos: THREE.BufferGeometry[], cx: number, cy: number, cz: number, r: number, h: number, color: string, seg = 8) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(cx, cy, cz);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geos.push(g);
}

export class City {
  group = new THREE.Group();
  colliders: Collider[] = [];
  interactables: Interactable[] = [];
  footprints: Footprint[] = [];
  roadLines: number[] = [];
  roadNodes: { x: number; z: number; id: number }[] = [];
  roadEdges: [number, number][] = [];
  windowMesh!: THREE.Mesh;
  private windowGeos: THREE.BufferGeometry[] = [];
  private rng = mulberry32(1337);
  private occupiedBlocks = new Set<string>();
  private signTextures: THREE.Texture[] = [];

  constructor() {
    this.buildGround();
    this.buildRoads();
    this.buildSpecials();
    this.buildProceduralBlocks();
    this.buildProps();
    this.buildLandmark();
    this.buildWindows();
    this.buildRoadGraph();
  }

  // ---------- Ground ----------
  private buildGround() {
    const g = new THREE.PlaneGeometry(WORLD.SIZE + 240, WORLD.SIZE + 240, 1, 1);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ color: 0x9a7b4f });
    const ground = new THREE.Mesh(g, mat);
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.group.add(ground);

    // dirt patches for texture variation
    const patches: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 120; i++) {
      const x = (this.rng() - 0.5) * (WORLD.SIZE + 120);
      const z = (this.rng() - 0.5) * (WORLD.SIZE + 120);
      const s = 4 + this.rng() * 10;
      const col = this.rng() > 0.5 ? '#8a6b40' : '#a8895a';
      const gg = new THREE.PlaneGeometry(s, s * (0.6 + this.rng() * 0.8));
      gg.rotateX(-Math.PI / 2);
      gg.rotateY(this.rng() * Math.PI);
      gg.translate(x, 0.0, z);
      const c = new THREE.Color(col);
      const n = gg.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { arr[k * 3] = c.r; arr[k * 3 + 1] = c.g; arr[k * 3 + 2] = c.b; }
      gg.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      patches.push(gg);
    }
    const merged = mergeGeometries(patches);
    if (merged) {
      const m = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
      m.position.y = 0.01;
      this.group.add(m);
    }
  }

  // ---------- Roads ----------
  private buildRoads() {
    const half = WORLD.SIZE / 2;
    const lines: number[] = [];
    for (let k = 1; k <= 7; k++) lines.push(-half + WORLD.BLOCK * k);
    this.roadLines = lines;

    const roadGeos: THREE.BufferGeometry[] = [];
    const markGeos: THREE.BufferGeometry[] = [];
    const walkGeos: THREE.BufferGeometry[] = [];
    const drainGeos: THREE.BufferGeometry[] = [];

    const RW = WORLD.ROAD_W;
    const SW = WORLD.SIDEWALK_W;

    for (const p of lines) {
      // road running along X (constant z = p)
      addBox(roadGeos, 0, 0.02, p, WORLD.SIZE + RW, 0.04, RW, '#2a2a2e');
      // road running along Z (constant x = p)
      addBox(roadGeos, p, 0.02, 0, RW, 0.04, WORLD.SIZE + RW, '#2a2a2e');
      // sidewalks
      addBox(walkGeos, 0, 0.06, p + RW / 2 + SW / 2, WORLD.SIZE, 0.12, SW, '#b8b0a0');
      addBox(walkGeos, 0, 0.06, p - RW / 2 - SW / 2, WORLD.SIZE, 0.12, SW, '#b8b0a0');
      addBox(walkGeos, p + RW / 2 + SW / 2, 0.06, 0, SW, 0.12, WORLD.SIZE, '#b8b0a0');
      addBox(walkGeos, p - RW / 2 - SW / 2, 0.06, 0, SW, 0.12, WORLD.SIZE, '#b8b0a0');
      // drainage gutters
      addBox(drainGeos, 0, 0.03, p + RW / 2 + 0.6, WORLD.SIZE, 0.08, 1.0, '#3a3630');
      addBox(drainGeos, 0, 0.03, p - RW / 2 - 0.6, WORLD.SIZE, 0.08, 1.0, '#3a3630');
      addBox(drainGeos, p + RW / 2 + 0.6, 0.03, 0, 1.0, 0.08, WORLD.SIZE, '#3a3630');
      addBox(drainGeos, p - RW / 2 - 0.6, 0.03, 0, 1.0, 0.08, WORLD.SIZE, '#3a3630');

      // dashed centre markings
      for (let d = -half; d < half; d += 8) {
        addBox(markGeos, d, 0.05, p, 4, 0.02, 0.35, '#e8c93a');
        addBox(markGeos, p, 0.05, d, 0.35, 0.02, 4, '#e8c93a');
      }
    }

    const roadM = new THREE.Mesh(mergeGeometries(roadGeos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const markM = new THREE.Mesh(mergeGeometries(markGeos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const walkM = new THREE.Mesh(mergeGeometries(walkGeos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const drainM = new THREE.Mesh(mergeGeometries(drainGeos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.group.add(roadM, markM, walkM, drainM);
  }

  // ---------- Special gameplay buildings ----------
  private buildSpecials() {
    const specials: any[] = [
      { id: 'supermarket', name: 'BODIJA SUPERSTORE', x: -60, z: 40, w: 26, d: 20, h: 6, wall: '#c9a24b', roof: '#7a4a2b', sign: '#0b7a3b', interior: 'shop', kind: 'shop' },
      { id: 'restaurant', name: 'MAMA NKECHI KITCHEN', x: 70, z: -30, w: 22, d: 18, h: 5, wall: '#d9c7a3', roof: '#8b5a2b', sign: '#c0392b', interior: 'restaurant', kind: 'restaurant' },
      { id: 'garage', name: 'DUGBE MOTORS', x: -90, z: -70, w: 28, d: 22, h: 6, wall: '#8fae7a', roof: '#5c4033', sign: '#2c3e50', interior: 'garage', kind: 'garage', open: true },
      { id: 'delivery', name: 'IBADAN EXPRESS', x: 20, z: 90, w: 20, d: 16, h: 5, wall: '#a9b7c6', roof: '#6b4226', sign: '#e67e22', interior: 'office', kind: 'office' },
      { id: 'police', name: 'MOKOLA POLICE STATION', x: 110, z: 60, w: 24, d: 20, h: 7, wall: '#b0a08a', roof: '#4a4a4a', sign: '#1a3a6b', interior: 'police', kind: 'police' },
      { id: 'bank', name: 'FIRST IBADAN BANK', x: 0, z: -60, w: 26, d: 20, h: 12, wall: '#d2b48c', roof: '#4a4a4a', sign: '#0f5132', interior: 'bank', kind: 'bank' },
      { id: 'hangout', name: 'CHILL SPOT BAR', x: 60, z: 60, w: 22, d: 18, h: 5, wall: '#c98b7a', roof: '#7d5a3c', sign: '#8e44ad', interior: 'hangout', kind: 'hangout' },
    ];

    for (const s of specials) {
      this.placeBuilding(s);
      this.markBlock(s.x, s.z);
    }

    // Home properties (with interiors)
    for (const p of PROPERTIES) {
      const wall = p.kind === 'duplex' ? '#d9c7a3' : p.kind === 'shop' ? '#c9a24b' : '#b5651d';
      const h = p.kind === 'duplex' ? 9 : p.kind === 'apartment' ? 7 : 4.5;
      this.placeBuilding({
        id: p.id, name: p.name.toUpperCase(), x: p.position[0], z: p.position[2],
        w: p.size[0], d: p.size[1], h, wall, roof: '#7a4a2b', sign: '#0f5132',
        interior: 'home', kind: 'property',
      });
      this.markBlock(p.position[0], p.position[2]);
    }
  }

  private placeBuilding(s: any) {
    const geos: THREE.BufferGeometry[] = [];
    const roofGeos: THREE.BufferGeometry[] = [];
    const cx = s.x, cz = s.z, w = s.w, d = s.d, h = s.h;

    if (s.open) {
      // open-front workshop: pillars + roof only
      addBox(geos, cx - w / 2 + 1, h / 2, cz - d / 2 + 1, 2, h, 2, s.wall);
      addBox(geos, cx + w / 2 - 1, h / 2, cz - d / 2 + 1, 2, h, 2, s.wall);
      addBox(geos, cx - w / 2 + 1, h / 2, cz + d / 2 - 1, 2, h, 2, s.wall);
      addBox(geos, cx + w / 2 - 1, h / 2, cz + d / 2 - 1, 2, h, 2, s.wall);
      addBox(geos, cx, h / 2, cz - d / 2 + 0.5, w, h, 1, s.wall);
      addBox(geos, cx - w / 2 + 0.5, h / 2, cz, 1, h, d, s.wall);
      addBox(roofGeos, cx, h + 0.4, cz, w + 2, 0.8, d + 2, s.roof);
      this.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz - d / 2 + 1.2, minY: 0, maxY: h });
      this.colliders.push({ minX: cx - w / 2, maxX: cx - w / 2 + 1.2, minZ: cz - d / 2, maxZ: cz + d / 2, minY: 0, maxY: h });
    } else {
      addBox(geos, cx, h / 2, cz, w, h, d, s.wall);
      // plinth / base
      addBox(geos, cx, 0.3, cz, w + 0.6, 0.6, d + 0.6, '#6b6157');
      // corrugated roof (overhanging)
      addBox(roofGeos, cx, h + 0.35, cz, w + 1.6, 0.7, d + 1.6, s.roof);
      // roof ridge
      addBox(roofGeos, cx, h + 0.9, cz, w + 1.6, 0.4, 0.6, s.roof);
      this.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY: 0, maxY: h });
    }

    // windows
    const floors = Math.max(1, Math.round(h / 3));
    for (let f = 0; f < floors; f++) {
      const wy = 1.6 + f * 3;
      if (wy > h - 1) continue;
      for (let k = -1; k <= 1; k++) {
        const gx = cx + k * (w / 3.4);
        const gz = cz + k * (d / 3.4);
        this.addWindow(gx, wy, cz - d / 2 - 0.05, 1.4, 1.8, 0.1);
        this.addWindow(gx, wy, cz + d / 2 + 0.05, 1.4, 1.8, 0.1);
        this.addWindow(cx - w / 2 - 0.05, wy, gz, 0.1, 1.8, 1.4);
        this.addWindow(cx + w / 2 + 0.05, wy, gz, 0.1, 1.8, 1.4);
      }
    }

    // door interactable at front (south face)
    const doorZ = cz + d / 2 + 0.6;
    this.interactables.push({
      id: 'door_' + s.id, kind: 'door', label: s.name,
      position: new THREE.Vector3(cx, 0, doorZ), radius: 4.5,
      data: { interior: s.interior, building: s.id, name: s.name, kind: s.kind, spawn: [cx, 0, doorZ + 1.5] },
    });

    // signboard above door
    const tex = this.makeSign(s.name, s.sign);
    const signMat = new THREE.MeshBasicMaterial({ map: tex });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.8, 12), 2.2), signMat);
    sign.position.set(cx, h - 1.2, cz + d / 2 + 0.12);
    this.group.add(sign);

    // awning
    addBox(geos, cx, h - 2.4, cz + d / 2 + 0.9, w * 0.85, 0.3, 2.2, AWNING_COLORS[Math.floor(this.rng() * AWNING_COLORS.length)]);

    const body = new THREE.Mesh(mergeGeometries(geos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const roof = new THREE.Mesh(mergeGeometries(roofGeos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.group.add(body, roof);

    this.footprints.push({ x: cx, z: cz, w, d, c: s.wall });
  }

  private addWindow(x: number, y: number, z: number, w: number, h: number, d: number) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    this.windowGeos.push(g);
  }

  // ---------- Procedural city blocks ----------
  private buildProceduralBlocks() {
    const half = WORLD.SIZE / 2;
    const N = WORLD.SIZE / WORLD.BLOCK;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const key = i + ',' + j;
        if (this.occupiedBlocks.has(key)) continue;
        const bx = -half + i * WORLD.BLOCK;
        const bz = -half + j * WORLD.BLOCK;
        const type = this.blockType(i, j, N);
        this.fillBlock(bx, bz, type);
      }
    }
  }

  private blockType(i: number, j: number, N: number): string {
    const cx = Math.abs(i - (N - 1) / 2);
    const cz = Math.abs(j - (N - 1) / 2);
    const center = cx < 2.5 && cz < 2.5;
    if (i >= N - 2 && j >= N - 2) return 'market';
    if (i <= 1 && j <= 1) return 'upscale';
    if (center) return 'commercial';
    if (i === 3 && j === 6) return 'park';
    if (this.rng() < 0.25) return 'commercial';
    return 'residential';
  }

  private fillBlock(bx: number, bz: number, type: string) {
    const B = WORLD.BLOCK;
    const m = 7;
    const x0 = bx + m, x1 = bx + B - m;
    const z0 = bz + m, z1 = bz + B - m;

    if (type === 'market') {
      // colourful market stalls
      const stallGeos: THREE.BufferGeometry[] = [];
      for (let k = 0; k < 10; k++) {
        const sx = x0 + this.rng() * (x1 - x0);
        const sz = z0 + this.rng() * (z1 - z0);
        const col = AWNING_COLORS[Math.floor(this.rng() * AWNING_COLORS.length)];
        addBox(stallGeos, sx, 1.0, sz, 3, 2, 3, '#8a6b40');
        addBox(stallGeos, sx, 2.4, sz, 3.6, 0.25, 3.6, col);
        addBox(stallGeos, sx, 2.7, sz, 0.15, 0.5, 0.15, '#5c4033');
      }
      const m2 = new THREE.Mesh(mergeGeometries(stallGeos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
      this.group.add(m2);
      this.colliders.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: 0, maxY: 0.2 });
      this.footprints.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, c: '#c0392b' });
      this.interactables.push({ id: 'market_' + bx + '_' + bz, kind: 'vendor', label: 'Market Vendor', position: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), radius: 8, data: { shop: 'market' } });
      return;
    }

    if (type === 'park') {
      const treeGeos: THREE.BufferGeometry[] = [];
      for (let k = 0; k < 14; k++) {
        const tx = x0 + this.rng() * (x1 - x0);
        const tz = z0 + this.rng() * (z1 - z0);
        addCyl(treeGeos, tx, 1.5, tz, 0.3, 3, '#5c4033', 5);
        addCone(treeGeos, tx, 4.2, tz, 2.2, 3.4, '#2f7d3a', 7);
      }
      // benches
      for (let k = 0; k < 4; k++) {
        const tx = x0 + this.rng() * (x1 - x0);
        const tz = z0 + this.rng() * (z1 - z0);
        addBox(treeGeos, tx, 0.5, tz, 3, 0.2, 0.8, '#8a6b40');
        addBox(treeGeos, tx, 0.25, tz, 0.3, 0.5, 0.8, '#5c4033');
      }
      const m2 = new THREE.Mesh(mergeGeometries(treeGeos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
      this.group.add(m2);
      this.footprints.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, c: '#2f7d3a' });
      this.interactables.push({ id: 'park_' + bx + '_' + bz, kind: 'bench', label: 'Rest on Bench', position: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), radius: 8, data: { rest: 15 } });
      return;
    }

    if (type === 'commercial') {
      // shop row along one edge + a taller block
      const nShops = 3;
      const rowW = (x1 - x0) / nShops;
      for (let k = 0; k < nShops; k++) {
        const sx = x0 + rowW * k + rowW / 2;
        const sz = z0 + 6;
        const h = 3.5 + this.rng() * 1.5;
        this.simpleBuilding(sx, sz, rowW - 2, 10, h, this.pick(WALL_COLORS), this.pick(ROOF_COLORS));
      }
      // office block
      const ox = x0 + (x1 - x0) * 0.5;
      const oz = z0 + (z1 - z0) * 0.65;
      const oh = 9 + this.rng() * 12;
      this.simpleBuilding(ox, oz, 18, 14, oh, this.pick(WALL_COLORS), this.pick(ROOF_COLORS));
      return;
    }

    if (type === 'upscale') {
      // one nice house per block with compound
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const w = 16 + this.rng() * 6, d = 14 + this.rng() * 4;
      const h = 4 + this.rng() * 4;
      this.simpleBuilding(cx, cz, w, d, h, this.pick(WALL_COLORS), this.pick(ROOF_COLORS));
      this.compound(x0, z0, x1 - x0, z1 - z0, cx, cz + d / 2 + 2);
      return;
    }

    // residential: 1-3 bungalows with compound walls
    const n = 1 + Math.floor(this.rng() * 3);
    for (let k = 0; k < n; k++) {
      const w = 8 + this.rng() * 6;
      const d = 8 + this.rng() * 5;
      const cx = x0 + w / 2 + this.rng() * Math.max(1, (x1 - x0) - w);
      const cz = z0 + d / 2 + this.rng() * Math.max(1, (z1 - z0) - d);
      const h = 3 + this.rng() * 3.5;
      this.simpleBuilding(cx, cz, w, d, h, this.pick(WALL_COLORS), this.pick(ROOF_COLORS));
    }
    this.compound(x0, z0, x1 - x0, z1 - z0, (x0 + x1) / 2, z1 + 1);
  }

  private simpleBuilding(cx: number, cz: number, w: number, d: number, h: number, wall: string, roof: string) {
    const geos: THREE.BufferGeometry[] = [];
    const roofGeos: THREE.BufferGeometry[] = [];
    addBox(geos, cx, h / 2, cz, w, h, d, wall);
    addBox(roofGeos, cx, h + 0.3, cz, w + 1.2, 0.6, d + 1.2, roof);
    addBox(roofGeos, cx, h + 0.8, cz, w + 1.2, 0.35, 0.5, roof);
    // windows
    const floors = Math.max(1, Math.round(h / 3));
    for (let f = 0; f < floors; f++) {
      const wy = 1.6 + f * 3;
      if (wy > h - 1) continue;
      this.addWindow(cx, wy, cz - d / 2 - 0.05, Math.min(1.3, w / 3), 1.6, 0.1);
      this.addWindow(cx, wy, cz + d / 2 + 0.05, Math.min(1.3, w / 3), 1.6, 0.1);
      this.addWindow(cx - w / 2 - 0.05, wy, cz, 0.1, 1.6, Math.min(1.3, d / 3));
      this.addWindow(cx + w / 2 + 0.05, wy, cz, 0.1, 1.6, Math.min(1.3, d / 3));
    }
    const body = new THREE.Mesh(mergeGeometries(geos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const roofM = new THREE.Mesh(mergeGeometries(roofGeos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.group.add(body, roofM);
    this.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY: 0, maxY: h });
    this.footprints.push({ x: cx, z: cz, w, d, c: wall });
  }

  private compound(x: number, z: number, w: number, d: number, gateX: number, gateZ: number) {
    const geos: THREE.BufferGeometry[] = [];
    const h = 1.8, t = 0.4;
    // four walls with a gate gap on south
    addBox(geos, x + w / 2, h / 2, z, t, h, d, '#b0a08a');
    addBox(geos, x + w / 2, h / 2, z + d, t, h, d, '#b0a08a');
    addBox(geos, x + w / 2, h / 2, z + d / 2, w, h, t, '#b0a08a');
    const gapW = 4;
    const leftW = (w - gapW) / 2;
    addBox(geos, x + leftW / 2, h / 2, z + d / 2, leftW, h, t, '#b0a08a');
    addBox(geos, x + w - leftW / 2, h / 2, z + d / 2, leftW, h, t, '#b0a08a');
    const m = new THREE.Mesh(mergeGeometries(geos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.group.add(m);
    // colliders (thin)
    this.colliders.push({ minX: x, maxX: x + t, minZ: z, maxZ: z + d, minY: 0, maxY: h });
    this.colliders.push({ minX: x + w - t, maxX: x + w, minZ: z, maxZ: z + d, minY: 0, maxY: h });
    this.colliders.push({ minX: x, maxX: x + w, minZ: z, maxZ: z + t, minY: 0, maxY: h });
    this.colliders.push({ minX: x, maxX: x + leftW, minZ: z + d - t, maxZ: z + d, minY: 0, maxY: h });
    this.colliders.push({ minX: x + w - leftW, maxX: x + w, minZ: z + d - t, maxZ: z + d, minY: 0, maxY: h });
  }

  // ---------- Props ----------
  private buildProps() {
    const poleGeos: THREE.BufferGeometry[] = [];
    const lightGeos: THREE.BufferGeometry[] = [];
    const kioskGeos: THREE.BufferGeometry[] = [];
    const treeGeos: THREE.BufferGeometry[] = [];
    const wirePoints: THREE.Vector3[][] = [];

    const half = WORLD.SIZE / 2;

    // Electricity poles + wires along roads
    for (const p of this.roadLines) {
      for (let d = -half; d <= half; d += 30) {
        const x = d, z = p + WORLD.ROAD_W / 2 + 1.5;
        addCyl(poleGeos, x, 4, z, 0.22, 8, '#6b5b4a', 6);
        addBox(poleGeos, x, 7.6, z, 2.4, 0.18, 0.18, '#4a3f33');
        // cross wires
        wirePoints.push([new THREE.Vector3(x - 1.1, 7.6, z), new THREE.Vector3(x + 1.1, 7.6, z)]);
        if (d + 30 <= half) wirePoints.push([new THREE.Vector3(x + 1.1, 7.6, z), new THREE.Vector3(x + 30 - 1.1, 7.6, z)]);
      }
    }

    // Streetlights
    for (const p of this.roadLines) {
      for (let d = -half + 15; d < half; d += 60) {
        const x = d, z = p - WORLD.ROAD_W / 2 - 1.5;
        addCyl(lightGeos, x, 3.5, z, 0.16, 7, '#8a8f96', 6);
        addBox(lightGeos, x + 1.2, 6.9, z, 2.6, 0.16, 0.16, '#8a8f96');
        addBox(lightGeos, x + 2.4, 6.7, z, 0.8, 0.4, 0.5, '#d9d9d9');
      }
    }

    // Kiosks & roadside stalls scattered near intersections
    for (let k = 0; k < 60; k++) {
      const x = (this.rng() - 0.5) * WORLD.SIZE;
      const z = (this.rng() - 0.5) * WORLD.SIZE;
      // keep near a road line
      const near = this.nearestRoad(x, z);
      const col = AWNING_COLORS[Math.floor(this.rng() * AWNING_COLORS.length)];
      addBox(kioskGeos, near.x, 1.1, near.z, 2.6, 2.2, 2.2, '#8a6b40');
      addBox(kioskGeos, near.x, 2.4, near.z, 3.2, 0.3, 2.8, col);
      addBox(kioskGeos, near.x, 2.7, near.z, 0.2, 0.6, 0.2, '#5c4033');
    }

    // Trees
    for (let k = 0; k < 90; k++) {
      const x = (this.rng() - 0.5) * (WORLD.SIZE + 100);
      const z = (this.rng() - 0.5) * (WORLD.SIZE + 100);
      const h = 3 + this.rng() * 3;
      addCyl(treeGeos, x, h / 2, z, 0.3, h, '#5c4033', 5);
      addCone(treeGeos, x, h + 1.4, z, 2 + this.rng(), 3, '#2f7d3a', 7);
    }

    const poleM = new THREE.Mesh(mergeGeometries(poleGeos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const lightM = new THREE.Mesh(mergeGeometries(lightGeos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const kioskM = new THREE.Mesh(mergeGeometries(kioskGeos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const treeM = new THREE.Mesh(mergeGeometries(treeGeos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.group.add(poleM, lightM, kioskM, treeM);

    // wires as line segments
    const pts: number[] = [];
    for (const w of wirePoints) { pts.push(w[0].x, w[0].y, w[0].z, w[1].x, w[1].y, w[1].z); }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const wires = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1a1a1a }));
    this.group.add(wires);

    // Food vendors (interactable)
    const vendors = [
      { x: -30, z: 20, name: 'Suya Spot', item: 'suya' },
      { x: 40, z: 20, name: 'Mama Put', item: 'jollof' },
      { x: 10, z: -20, name: 'Amala Joint', item: 'amala' },
      { x: -70, z: 70, name: 'Puff Puff Stand', item: 'puffpuff' },
      { x: 90, z: 20, name: 'Zobo Seller', item: 'zobo' },
    ];
    for (const v of vendors) {
      this.interactables.push({ id: 'vendor_' + v.item, kind: 'vendor', label: v.name, position: new THREE.Vector3(v.x, 0, v.z), radius: 5, data: { shop: 'food', item: v.item } });
    }

    // ATM
    this.interactables.push({ id: 'atm', kind: 'atm', label: 'ATM', position: new THREE.Vector3(-4, 0, -60), radius: 5, data: {} });

    // Job markers
    for (const j of JOBS) {
      this.interactables.push({ id: 'job_' + j.id, kind: 'job', label: j.employer, position: new THREE.Vector3(j.location[0], 0, j.location[2] + 3), radius: 6, data: { jobId: j.id } });
    }

    // Business purchase markers
    for (const b of BUSINESSES) {
      this.interactables.push({ id: 'biz_' + b.id, kind: 'business', label: b.name, position: new THREE.Vector3(b.position[0], 0, b.position[2] + 4), radius: 6, data: { bizId: b.id } });
    }

    // Property purchase markers (in front of homes)
    for (const p of PROPERTIES) {
      this.interactables.push({ id: 'prop_' + p.id, kind: 'property', label: p.name, position: new THREE.Vector3(p.door[0], 0, p.door[2]), radius: 5, data: { propId: p.id } });
    }
  }

  private nearestRoad(x: number, z: number) {
    let best = { x: 0, z: 0, d: 1e9 };
    for (const p of this.roadLines) {
      const dz = Math.abs(z - p);
      if (dz < best.d) best = { x, z: p, d: dz };
      const dx = Math.abs(x - p);
      if (dx < best.d) best = { x: p, z, d: dx };
    }
    // offset to roadside
    return { x: best.x + 3, z: best.z + 3 };
  }

  // ---------- Landmark ----------
  private buildLandmark() {
    // Cocoa House-inspired tower in the centre
    const geos: THREE.BufferGeometry[] = [];
    const cx = 0, cz = 0;
    const floors = 14, fh = 3.2;
    addBox(geos, cx, (floors * fh) / 2, cz, 16, floors * fh, 16, '#c9b18a');
    for (let f = 0; f < floors; f++) {
      const y = 1.6 + f * fh;
      for (let k = -2; k <= 2; k++) {
        this.addWindow(cx + k * 3, y, cz - 8.1, 1.6, 2, 0.1);
        this.addWindow(cx + k * 3, y, cz + 8.1, 1.6, 2, 0.1);
        this.addWindow(cx - 8.1, y, cz + k * 3, 0.1, 2, 1.6);
        this.addWindow(cx + 8.1, y, cz + k * 3, 0.1, 2, 1.6);
      }
    }
    // top crown
    addBox(geos, cx, floors * fh + 1.5, cz, 18, 3, 18, '#8a7a5a');
    const tower = new THREE.Mesh(mergeGeometries(geos)!, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.group.add(tower);
    this.colliders.push({ minX: cx - 8, maxX: cx + 8, minZ: cz - 8, maxZ: cz + 8, minY: 0, maxY: floors * fh });
    this.footprints.push({ x: cx, z: cz, w: 16, d: 16, c: '#c9b18a' });

    const tex = this.makeSign('COCOA HOUSE', '#0f5132');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.4), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(cx, floors * fh - 2, cz + 8.15);
    this.group.add(sign);

    // Distant hill (Ibadan geography)
    const hillG = new THREE.ConeGeometry(120, 60, 24);
    const hill = new THREE.Mesh(hillG, new THREE.MeshLambertMaterial({ color: 0x6b5b3a }));
    hill.position.set(-360, 20, -360);
    this.group.add(hill);
    const hill2 = new THREE.Mesh(new THREE.ConeGeometry(90, 40, 20), new THREE.MeshLambertMaterial({ color: 0x7a6a45 }));
    hill2.position.set(340, 12, -380);
    this.group.add(hill2);
  }

  private buildWindows() {
    if (!this.windowGeos.length) return;
    const merged = mergeGeometries(this.windowGeos);
    if (!merged) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 });
    this.windowMesh = new THREE.Mesh(merged, mat);
    this.group.add(this.windowMesh);
  }

  // ---------- Road graph for NPC traffic ----------
  private buildRoadGraph() {
    let id = 0;
    const map = new Map<string, number>();
    for (const x of this.roadLines) {
      for (const z of this.roadLines) {
        const k = x + ':' + z;
        map.set(k, id);
        this.roadNodes.push({ x, z, id });
        id++;
      }
    }
    for (let i = 0; i < this.roadLines.length; i++) {
      for (let j = 0; j < this.roadLines.length; j++) {
        const x = this.roadLines[i], z = this.roadLines[j];
        const a = map.get(x + ':' + z)!;
        if (i + 1 < this.roadLines.length) {
          const b = map.get(this.roadLines[i + 1] + ':' + z)!;
          this.roadEdges.push([a, b]);
        }
        if (j + 1 < this.roadLines.length) {
          const b = map.get(x + ':' + this.roadLines[j + 1])!;
          this.roadEdges.push([a, b]);
        }
      }
    }
  }

  // ---------- Helpers ----------
  private pick(arr: string[]) { return arr[Math.floor(this.rng() * arr.length)]; }

  private markBlock(x: number, z: number) {
    const half = WORLD.SIZE / 2;
    const i = Math.floor((x + half) / WORLD.BLOCK);
    const j = Math.floor((z + half) / WORLD.BLOCK);
    this.occupiedBlocks.add(i + ',' + j);
  }

  private makeSign(text: string, bg: string): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, c.width - 12, c.height - 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 46px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const t = text.length > 20 ? text.slice(0, 20) : text;
    ctx.fillText(t, c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 2;
    this.signTextures.push(tex);
    return tex;
  }

  // ---------- Collision query ----------
  collides(x: number, z: number, r: number, y = 0, height = 1.8): boolean {
    for (const c of this.colliders) {
      if (y + height < c.minY || y > c.maxY) continue;
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx, dz = z - nz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  nearestInteractable(x: number, z: number, maxR = 6): Interactable | null {
    let best: Interactable | null = null;
    let bestD = maxR * maxR;
    for (const it of this.interactables) {
      const dx = it.position.x - x, dz = it.position.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  getSpawnPoint(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 25);
  }
}
