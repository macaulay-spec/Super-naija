import * as THREE from 'three';
import { WORLD, type PlayerProfile, type InventoryItem, type NetPlayer } from '../core/types';
import { ITEMS, JOBS, PROPERTIES, VEHICLES, BUSINESSES } from '../data/gamedata';
import { City } from '../world/City';
import { Interiors } from '../world/Interiors';
import { Player } from '../entities/Player';
import { Vehicle } from '../entities/Vehicle';
import { NPCManager } from '../entities/NPC';
import { RemotePlayer } from '../entities/RemotePlayer';
import { Input } from '../core/Input';
import { Network } from '../net/Network';
import { UI } from '../ui/UI';
import { AudioSys } from '../systems/Audio';

// ============================================================
// Game — orchestrator
// ============================================================

export class Game {
  canvas: HTMLCanvasElement;
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera!: THREE.PerspectiveCamera;
  clock = new THREE.Clock();

  city!: City;
  interiors!: Interiors;
  player!: Player;
  npcs!: NPCManager;
  input!: Input;
  net!: Network;
  ui!: UI;
  audio = new AudioSys();

  vehicles: Vehicle[] = [];
  remotePlayers = new Map<string, RemotePlayer>();

  profile!: PlayerProfile;
  graphics: 'low' | 'medium' | 'high' = 'medium';
  fps = 0;
  private fpsAccum = 0; private fpsFrames = 0;

  // camera orbit
  private camYaw = 0;
  private camPitch = 0.35;
  private camDist = 6.5;

  // state
  inInterior = false;
  currentInterior: string | null = null;
  activeColliders: any[] = [];
  activeInteractables: any[] = [];
  currentVehicle: Vehicle | null = null;
  nearInteractable: any = null;
  private dayTime = 0.40; // 0..1, 0.25 = sunrise, 0.5 = noon (start mid-morning = bright)
  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private ambient!: THREE.AmbientLight;
  private rentTimer = 0;
  private autosaveTimer = 0;
  private shiftTimer = 0;
  private shiftingJob: string | null = null;

  // business state
  ownedBusinesses: string[] = [];
  bizStock: Record<string, number> = {};
  bizEmployees: Record<string, number> = {};
  bizRep: Record<string, number> = {};

  running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(onProgress: (pct: number, label: string) => void) {
    onProgress(5, 'Starting renderer…');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: this.graphics !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.graphics === 'high' ? 2 : 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1200);
    this.camera.position.set(0, 6, 12);

    onProgress(15, 'Lighting the sky…');
    this.setupLights();
    this.scene.fog = new THREE.Fog(0xcfd8e0, 120, 420);

    onProgress(30, 'Building Ibadan…');
    this.city = new City();
    this.scene.add(this.city.group);

    onProgress(55, 'Furnishing interiors…');
    this.interiors = new Interiors();
    this.scene.add(this.interiors.group);

    onProgress(68, 'Creating your character…');
    this.player = new Player('Player', 2, '#e8b923', 0);
    this.player.onFootstep = () => this.audio.footstep();
    this.scene.add(this.player.group);

    onProgress(78, 'Spawning traffic & pedestrians…');
    this.npcs = new NPCManager(this.city, 26, 14);
    this.scene.add(this.npcs.group);

    onProgress(86, 'Placing vehicles…');
    this.spawnVehicles();

    onProgress(92, 'Connecting to the world…');
    this.input = new Input(this.canvas);
    this.net = new Network();
    this.setupNetwork();
    this.ui = new UI(this);
    this.setupInput();

    window.addEventListener('resize', () => this.onResize());
    onProgress(100, 'Ready!');
  }

  private setupLights() {
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.7);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xffe6b0, 1.1);
    this.sun.position.set(80, 120, 40);
    this.scene.add(this.sun);
  }

  private spawnVehicles() {
    // Parked vehicles around the city (some purchasable)
    const spots: { id: string; kind: string; x: number; z: number; yaw: number; owned?: boolean }[] = [
      { id: 'v_keke1', kind: 'keke', x: 8, z: 30, yaw: 0 },
      { id: 'v_okada1', kind: 'okada', x: -14, z: 26, yaw: 1 },
      { id: 'v_taxi1', kind: 'taxi', x: 24, z: 20, yaw: 0.5 },
      { id: 'v_danfo1', kind: 'danfo', x: -30, z: 8, yaw: 1.5 },
      { id: 'v_car1', kind: 'car', x: 40, z: -10, yaw: 2 },
      { id: 'v_keke2', kind: 'keke', x: -60, z: 50, yaw: 0 },
      { id: 'v_taxi2', kind: 'taxi', x: 70, z: -40, yaw: 0 },
      { id: 'v_danfo2', kind: 'danfo', x: -90, z: -60, yaw: 1 },
    ];
    for (const s of spots) {
      const v = new Vehicle(s.id, VEHICLES[s.kind]);
      v.setPosition(s.x, 0, s.z);
      v.yaw = s.yaw;
      v.group.rotation.y = s.yaw;
      this.vehicles.push(v);
      this.scene.add(v.group);
    }
  }

  private setupInput() {
    this.input.onInteract = () => this.handleInteract();
    const jb = document.getElementById('btn-jump');
    const sb = document.getElementById('btn-sprint');
    const ib = document.getElementById('btn-interact');
    const bb = document.getElementById('btn-brake');
    const eb = document.getElementById('btn-exit');
    const bind = (el: HTMLElement | null, down: () => void, up: () => void) => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); down(); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); up(); }, { passive: false });
      el.addEventListener('mousedown', (e) => { e.preventDefault(); down(); });
      el.addEventListener('mouseup', (e) => { e.preventDefault(); up(); });
    };
    bind(jb, () => this.input.setVirtual('jump', true), () => this.input.setVirtual('jump', false));
    bind(sb, () => this.input.setVirtual('sprint', true), () => this.input.setVirtual('sprint', false));
    bind(bb, () => this.input.setVirtual('brake', true), () => this.input.setVirtual('brake', false));
    if (ib) ib.onclick = () => this.handleInteract();
    if (eb) eb.onclick = () => this.exitVehicle();
  }

  private setupNetwork() {
    this.net.onState = (s) => this.ui?.setConnState(s);
    this.net.onWelcome = (id, players) => {
      this.ui.setConnState('online');
      for (const p of players) if (p.id !== id) this.addRemote(p);
    };
    this.net.onJoin = (p) => { this.addRemote(p); this.ui.toast(`${p.name} joined Ibadan`, 'good'); };
    this.net.onLeave = (id) => this.removeRemote(id);
    this.net.onStateMsg = (p: any) => {
      const rp = this.remotePlayers.get(p.id);
      if (rp) rp.setState(p.x, p.y, p.z, p.ry, p.anim, p.vehicleId);
    };
    this.net.onChat = (name, text) => this.ui.addChat(name, text);
    this.net.onEmote = (id, emote) => {
      const rp = this.remotePlayers.get(id);
      if (rp) { rp.anim = emote === 'dance' ? 'run' : rp.anim; this.ui.addChat(rp.name, `*${emote}*`); }
    };
    this.net.connect();
  }

  private addRemote(p: NetPlayer) {
    if (this.remotePlayers.has(p.id)) return;
    const rp = new RemotePlayer(p);
    this.remotePlayers.set(p.id, rp);
    this.scene.add(rp.group);
  }

  private removeRemote(id: string) {
    const rp = this.remotePlayers.get(id);
    if (rp) { rp.dispose(); this.remotePlayers.delete(id); }
  }

  // ---------- Profile ----------
  createProfile(name: string, skin: number, outfit: string, hair: number) {
    const id = 'p_' + Math.random().toString(36).slice(2, 10);
    this.profile = {
      id, name: name || 'Player', skin, outfit, hair,
      needs: { hunger: 80, energy: 90, hygiene: 85 },
      stats: { level: 1, xp: 0, xpNext: 100, reputation: 50 },
      wallet: { cash: 25000, bank: 50000 },
      position: [0, 0, 25], rotation: 0,
      jobId: null, jobShiftProgress: 0,
      homePropertyId: null, ownedPropertyIds: [], ownedVehicleIds: [],
      inventory: [
        { id: 'bottledwater', qty: 2 },
        { id: 'bread', qty: 1 },
      ],
      wanted: 0, jailUntil: 0,
      lastSeen: Date.now(), created: Date.now(),
    };
    this.player.setAppearance(skin, outfit, hair);
    this.player.name = name || 'Player';
    this.player.setPosition(0, 0, 25);
    this.loadExtras();
    this.net.hello({ name: this.profile.name, skin, outfit, hair });
    this.saveProfile();
  }

  private loadExtras() {
    try {
      const ex = JSON.parse(localStorage.getItem('ibadan_extras_' + this.profile.id) || '{}');
      this.ownedBusinesses = ex.ownedBusinesses || [];
      this.bizStock = ex.bizStock || {};
      this.bizEmployees = ex.bizEmployees || {};
      this.bizRep = ex.bizRep || {};
      if (ex.dayTime != null) this.dayTime = ex.dayTime;
    } catch {}
  }

  private saveExtras() {
    try {
      localStorage.setItem('ibadan_extras_' + this.profile.id, JSON.stringify({
        ownedBusinesses: this.ownedBusinesses, bizStock: this.bizStock,
        bizEmployees: this.bizEmployees, bizRep: this.bizRep, dayTime: this.dayTime,
      }));
    } catch {}
  }

  saveProfile() {
    if (!this.profile) return;
    this.profile.position = [this.player.position.x, this.player.position.y, this.player.position.z];
    this.profile.rotation = this.player.yaw;
    this.profile.lastSeen = Date.now();
    try { localStorage.setItem('ibadan_profile', JSON.stringify(this.profile)); } catch {}
    this.saveExtras();
  }

  loadProfile(): boolean {
    try {
      const raw = localStorage.getItem('ibadan_profile');
      if (!raw) return false;
      const p = JSON.parse(raw) as PlayerProfile;
      if (!p || !p.id) return false;
      // Repair any missing / malformed fields so a bad save can never block entry.
      if (!Array.isArray(p.position) || p.position.length < 3 ||
          !p.position.every((n) => typeof n === 'number' && isFinite(n))) {
        p.position = [0, 0, 25];
      }
      if (typeof p.rotation !== 'number' || !isFinite(p.rotation)) p.rotation = 0;
      p.name = p.name || 'Player';
      p.ownedPropertyIds = p.ownedPropertyIds || [];
      p.ownedVehicleIds = p.ownedVehicleIds || [];
      p.inventory = p.inventory || [];
      p.needs = p.needs || { hunger: 80, energy: 90, hygiene: 85 };
      p.stats = p.stats || { level: 1, xp: 0, xpNext: 100, reputation: 50 };
      p.wallet = p.wallet || { cash: 25000, bank: 50000 };
      this.profile = p;
      this.player.setAppearance(p.skin, p.outfit, p.hair);
      this.player.name = p.name;
      this.player.setPosition(p.position[0], p.position[1], p.position[2]);
      this.loadExtras();
      this.net.hello({ name: p.name, skin: p.skin, outfit: p.outfit, hair: p.hair });
      return true;
    } catch { return false; }
  }

  // ---------- Loop ----------
  start() {
    this.running = true;
    this.clock.start();
    this.loop();
  }

  private loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    // FPS
    this.fpsAccum += dt; this.fpsFrames++;
    if (this.fpsAccum >= 0.5) { this.fps = this.fpsFrames / this.fpsAccum; this.fpsAccum = 0; this.fpsFrames = 0; }
  };

  private update(dt: number) {
    this.input.update();
    const paused = this.ui?.isModalOpen;
    const lookScale = this.input.usingTouch ? 0.006 : 0.0022;
    if (!paused) {
      this.camYaw -= this.input.state.lookX * lookScale;
      this.camPitch = Math.max(-0.2, Math.min(1.1, this.camPitch + this.input.state.lookY * lookScale));
    }

    if (this.currentVehicle) {
      this.updateDriving(dt, paused);
    } else if (!paused) {
      this.player.update(dt, this.input.state, this.camYaw, this.activeColliders, true);
    }

    this.updateCamera(dt);
    this.updateDayNight(dt);
    this.npcs.update(dt, this.city, this.player.position);
    for (const rp of this.remotePlayers.values()) rp.update(dt);
    this.updateRemoteVisibility();
    this.tickNeeds(dt);
    this.tickRent(dt);
    this.updateInteractionTarget();
    this.net.update(dt);
    if (this.currentVehicle) this.audio.setEngine(this.currentVehicle.speed);

    // autosave
    this.autosaveTimer += dt;
    if (this.autosaveTimer > 15) { this.autosaveTimer = 0; this.saveProfile(); }

    // HUD
    if (this.profile) {
      this.ui.updateHUD(this.profile);
      const others = Array.from(this.remotePlayers.values()).map((r) => ({ x: r.position.x, z: r.position.z }));
      this.ui.drawMinimap(this.city, this.player.position.x, this.player.position.z, this.player.yaw, others);
    }
  }

  private updateDriving(dt: number, paused: boolean) {
    const v = this.currentVehicle!;
    let throttle = 0, steer = 0;
    if (!paused) {
      const s = this.input.state;
      // moveY: forward is -1 (W). Use as throttle
      throttle = -s.moveY;
      steer = s.moveX;
      if (s.jump) throttle = Math.max(throttle, 0);
    }
    v.update(dt, { throttle, steer, brake: this.input.state.brake }, this.activeColliders);
    // camera follows vehicle
    this.player.position.set(v.position.x, v.position.y, v.position.z);
    this.player.yaw = v.yaw;
    this.camDist = 9;
    if (v.fuel <= 0) this.ui.toast('Out of fuel! Visit the garage.', 'bad');
  }

  private updateCamera(dt: number) {
    const target = this.player.position.clone();
    target.y += 1.6;
    const cd = this.currentVehicle ? 10 : this.camDist;
    const cx = target.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * cd;
    const cz = target.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * cd;
    const cy = target.y + Math.sin(this.camPitch) * cd + 1.2;
    const desired = new THREE.Vector3(cx, cy, cz);
    // simple collision: don't let camera go through buildings
    if (!this.inInterior) {
      const d = desired.clone().sub(target);
      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        const p = target.clone().add(d.clone().multiplyScalar(i / steps));
        if (this.city.collides(p.x, p.z, 0.6, p.y - 1, 1.5)) {
          desired.copy(target.clone().add(d.clone().multiplyScalar((i - 1) / steps)));
          break;
        }
      }
    }
    this.camera.position.lerp(desired, Math.min(1, 10 * dt));
    this.camera.lookAt(target);
  }

  private updateDayNight(dt: number) {
    this.dayTime = (this.dayTime + dt / WORLD.DAY_LENGTH) % 1;
    const angle = this.dayTime * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);
    this.sun.position.set(sunX * 120, Math.max(-20, sunY * 140), 40);
    const day = Math.max(0, sunY);
    this.sun.intensity = 0.45 + day * 0.95;
    this.hemi.intensity = 0.5 + day * 0.5;
    this.ambient.intensity = 0.3 + day * 0.22;
    // sky colour
    const night = new THREE.Color(0x0a0e18);
    const dawn = new THREE.Color(0xd98a4a);
    const noon = new THREE.Color(0x9fc6e8);
    let sky: THREE.Color;
    if (day < 0.15) sky = night.clone().lerp(dawn, day / 0.15);
    else sky = dawn.clone().lerp(noon, Math.min(1, (day - 0.15) / 0.5));
    this.scene.background = sky;
    this.scene.fog!.color.copy(sky);
    // window lights at night
    const nightFactor = Math.max(0, 1 - day * 3);
    if (this.city.windowMesh) (this.city.windowMesh.material as THREE.MeshBasicMaterial).opacity = nightFactor * 0.9;
  }

  private updateRemoteVisibility() {
    // hide remotes that are stale (disconnected)
    for (const [id, rp] of this.remotePlayers) {
      if (rp.isStale()) { rp.group.visible = false; }
      else rp.group.visible = true;
    }
  }

  private tickNeeds(dt: number) {
    if (!this.profile) return;
    const n = this.profile.needs;
    const rate = dt * 0.35; // per second
    n.hunger = Math.max(0, n.hunger - rate * 1.0);
    n.energy = Math.max(0, n.energy - rate * (this.player.speed > 5 ? 1.8 : 0.7));
    n.hygiene = Math.max(0, n.hygiene - rate * 0.5);
    if (n.hunger <= 0) { this.profile.stats.reputation = Math.max(0, this.profile.stats.reputation - dt * 0.2); }
  }

  private tickRent(dt: number) {
    this.rentTimer += dt;
    if (this.rentTimer > 120) { // every 2 min = 1 in-game day-ish
      this.rentTimer = 0;
      let total = 0;
      for (const id of this.profile.ownedPropertyIds) {
        const p = PROPERTIES.find((x) => x.id === id);
        if (p) total += p.rent;
      }
      if (total > 0) {
        if (this.profile.wallet.bank >= total) { this.profile.wallet.bank -= total; this.ui.toast(`Rent paid: ₦${total.toLocaleString()}`, ''); }
        else if (this.profile.wallet.cash >= total) { this.profile.wallet.cash -= total; this.ui.toast(`Rent paid from cash: ₦${total.toLocaleString()}`, ''); }
        else { this.ui.toast('⚠️ You cannot pay rent!', 'bad'); this.profile.stats.reputation = Math.max(0, this.profile.stats.reputation - 2); }
      }
      // business income
      for (const id of this.ownedBusinesses) {
        const b = BUSINESSES.find((x) => x.id === id);
        if (!b) continue;
        const stock = this.bizStock[id] ?? 0;
        const emp = this.bizEmployees[id] ?? 0;
        const rep = this.bizRep[id] ?? 50;
        const income = Math.round(b.baseIncome * (0.4 + Math.min(1, stock / 20) * 0.4 + Math.min(1, emp / 3) * 0.3) * (0.6 + rep / 125));
        this.profile.wallet.bank += income;
        this.bizStock[id] = Math.max(0, stock - 2);
        this.ui.toast(`${b.name} earned ₦${income.toLocaleString()}`, 'good');
      }
    }
  }

  // ---------- Interaction ----------
  private updateInteractionTarget() {
    if (this.currentVehicle) { this.ui.updateInteractPrompt('Exit Vehicle'); return; }
    const px = this.player.position.x, pz = this.player.position.z;
    // vehicles nearby
    let nearest: any = null, nd = 4.5 * 4.5;
    for (const v of this.vehicles) {
      const d = (v.position.x - px) ** 2 + (v.position.z - pz) ** 2;
      if (d < nd) { nd = d; nearest = { kind: 'vehicle', label: `Drive ${v.def.name}`, vehicle: v }; }
    }
    // city interactables
    const it = this.city.nearestInteractable(px, pz, 5);
    if (it) {
      const d = (it.position.x - px) ** 2 + (it.position.z - pz) ** 2;
      if (d < nd) { nearest = it; nd = d; }
    }
    // interior interactables
    if (this.inInterior) {
      const iit = this.nearestInInterior(px, pz, 4.5);
      if (iit) { nearest = iit; }
    }
    this.nearInteractable = nearest;
    this.ui.updateInteractPrompt(nearest ? nearest.label : null);
  }

  private nearestInInterior(x: number, z: number, r: number) {
    let best: any = null, bd = r * r;
    for (const it of this.activeInteractables) {
      const d = (it.position.x - x) ** 2 + (it.position.z - z) ** 2;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  handleInteract() {
    if (this.ui.isModalOpen) return;
    if (this.currentVehicle) { this.exitVehicle(); return; }
    const it = this.nearInteractable;
    if (!it) return;
    this.audio.uiClick();

    if (it.kind === 'vehicle') { this.enterVehicle(it.vehicle); return; }
    if (it.kind === 'door') { this.enterInterior(it.data.interior, it.data.name, it.data.spawn); return; }
    if (it.kind === 'vendor') { this.ui.openShop(it.data.shop === 'food' ? 'food' : 'market'); return; }
    if (it.kind === 'shop') { this.ui.openShop(it.data.shop || 'supermarket'); return; }
    if (it.kind === 'restaurant') { this.ui.openShop('restaurant'); return; }
    if (it.kind === 'atm' || it.kind === 'bank') { this.ui.openPhone(); return; }
    if (it.kind === 'job') { this.ui.openJobPanel(it.data.jobId); return; }
    if (it.kind === 'property') { this.ui.openPropertyPanel(it.data.propId); return; }
    if (it.kind === 'business') { this.ui.openBusinessPanel(it.data.bizId); return; }
    if (it.kind === 'garage') { this.repairVehicle(); return; }
    if (it.kind === 'police') { this.handlePolice(); return; }
    if (it.kind === 'bed') { this.restoreNeed('energy', it.data.rest); return; }
    if (it.kind === 'shower') { this.restoreNeed('hygiene', it.data.hygiene); return; }
    if (it.kind === 'kitchen') { this.restoreNeed('hunger', it.data.hunger); return; }
    if (it.kind === 'storage') { this.ui.openInventory(); return; }
    if (it.kind === 'hangout') { this.ui.openShop('bar'); return; }
    if (it.kind === 'bench') { this.restoreNeed('energy', it.data.rest); return; }
    if (it.kind === 'office') { this.ui.openPhone(); return; }
  }

  enterInterior(type: string, name: string, spawn?: number[]) {
    const room = this.interiors.get(type);
    if (!room) { this.ui.toast('This building is not enterable yet.', ''); return; }
    this.inInterior = true;
    this.currentInterior = type;
    this.activeColliders = room.colliders;
    this.activeInteractables = room.interactables;
    this.player.setPosition(room.spawn.x, room.spawn.y, room.spawn.z);
    this.player.velocity.set(0, 0, 0);
    this.ui.toast(`Entered ${name}`, 'good');
    this.saveProfile();
  }

  exitInterior() {
    if (!this.inInterior) return;
    this.inInterior = false;
    this.currentInterior = null;
    this.activeColliders = this.city.colliders;
    this.activeInteractables = [];
    // place back near a door
    this.player.placeSafe(0, 25, this.city.colliders);
    this.ui.toast('Back outside', '');
    this.saveProfile();
  }

  enterVehicle(v: Vehicle) {
    this.currentVehicle = v;
    v.occupied = true;
    v.driverId = this.profile.id;
    this.player.inVehicle = true;
    this.player.group.visible = false;
    this.audio.startEngine();
    this.ui.toast(`Driving ${v.def.name}`, 'good');
    if (v.fuel <= 5) this.ui.toast('Low fuel!', 'bad');
  }

  exitVehicle() {
    if (!this.currentVehicle) return;
    const v = this.currentVehicle;
    v.occupied = false; v.driverId = null;
    this.currentVehicle = null;
    this.player.inVehicle = false;
    this.player.group.visible = true;
    this.player.placeSafe(v.position.x + 2.5, v.position.z, this.activeColliders);
    this.audio.stopEngine();
    this.camDist = 6.5;
    this.saveProfile();
  }

  private repairVehicle() {
    const v = this.currentVehicle || this.vehicles.find((x) => Math.abs(x.position.x - this.player.position.x) < 6 && Math.abs(x.position.z - this.player.position.z) < 6);
    if (!v) { this.ui.toast('No vehicle nearby to repair.', ''); return; }
    const cost = 3000;
    if (this.profile.wallet.cash < cost) { this.ui.toast('Not enough cash (₦3,000)', 'bad'); return; }
    this.profile.wallet.cash -= cost;
    v.fuel = 100; v.health = 100;
    this.audio.cash();
    this.ui.toast('Vehicle refuelled & repaired!', 'good');
  }

  private handlePolice() {
    if (this.profile.wanted > 0) {
      const fine = this.profile.wanted * 5000;
      if (this.profile.wallet.cash >= fine) {
        this.profile.wallet.cash -= fine;
        this.profile.wanted = 0;
        this.ui.toast(`Fine paid: ₦${fine.toLocaleString()}. You're clean.`, 'good');
      } else this.ui.toast(`You need ₦${fine.toLocaleString()} to pay your fine.`, 'bad');
    } else this.ui.toast('No outstanding offences. Stay law-abiding!', '');
  }

  private restoreNeed(key: 'hunger' | 'energy' | 'hygiene', amount: number) {
    const cost = key === 'hunger' ? 800 : key === 'energy' ? 1500 : 500;
    if (this.profile.wallet.cash < cost) { this.ui.toast(`Not enough cash (₦${cost.toLocaleString()})`, 'bad'); return; }
    this.profile.wallet.cash -= cost;
    this.profile.needs[key] = Math.min(100, this.profile.needs[key] + amount);
    this.audio.cash();
    this.ui.toast(`${key} restored`, 'good');
    this.saveProfile();
  }

  // ---------- Economy / items ----------
  private addCash(amount: number) { this.profile.wallet.cash += amount; }
  private spend(amount: number): boolean {
    if (this.profile.wallet.cash < amount) return false;
    this.profile.wallet.cash -= amount; return true;
  }

  buyItem(itemId: string) {
    const def = ITEMS[itemId];
    if (!def) return;
    if (!this.spend(def.price)) { this.ui.toast('Not enough cash', 'bad'); this.audio.error(); return; }
    this.addToInventory(itemId, 1);
    this.audio.cash();
    this.ui.toast(`Bought ${def.name}`, 'good');
    this.addXP(2);
    this.saveProfile();
  }

  sellItem(itemId: string) {
    const def = ITEMS[itemId];
    if (!def) return;
    const inv = this.profile.inventory.find((i) => i.id === itemId);
    if (!inv || inv.qty < 1) return;
    inv.qty--;
    if (inv.qty <= 0) this.profile.inventory = this.profile.inventory.filter((i) => i.id !== itemId);
    this.addCash(def.sell);
    this.audio.cash();
    this.ui.toast(`Sold ${def.name} for ₦${def.sell.toLocaleString()}`, 'good');
    this.saveProfile();
  }

  useItem(itemId: string) {
    const def = ITEMS[itemId];
    if (!def || !def.effect) return;
    const inv = this.profile.inventory.find((i) => i.id === itemId);
    if (!inv) return;
    inv.qty--;
    if (inv.qty <= 0) this.profile.inventory = this.profile.inventory.filter((i) => i.id !== itemId);
    for (const [k, v] of Object.entries(def.effect)) {
      (this.profile.needs as any)[k] = Math.min(100, (this.profile.needs as any)[k] + (v as number));
    }
    this.audio.success();
    this.ui.toast(`Used ${def.name}`, 'good');
    this.saveProfile();
  }

  equipItem(itemId: string) {
    const def = ITEMS[itemId];
    if (!def || def.slot !== 'outfit') return;
    for (const i of this.profile.inventory) i.equipped = false;
    const inv = this.profile.inventory.find((i) => i.id === itemId);
    if (inv) inv.equipped = true;
    const colors: Record<string, string> = { ankara: '#e07b39', agbada: '#f4f4f4', jeans: '#3b5998' };
    this.profile.outfit = colors[itemId] || '#e8b923';
    this.player.setAppearance(this.profile.skin, this.profile.outfit, this.profile.hair);
    this.ui.toast(`Equipped ${def.name}`, 'good');
    this.saveProfile();
  }

  private addToInventory(id: string, qty: number) {
    const ex = this.profile.inventory.find((i) => i.id === id);
    if (ex) ex.qty += qty; else this.profile.inventory.push({ id, qty });
  }

  // ---------- Jobs ----------
  applyForJob(jobId: string) {
    const job = JOBS.find((j) => j.id === jobId);
    if (!job) return;
    if (this.profile.stats.level < job.minLevel) { this.ui.toast('Level too low', 'bad'); return; }
    this.profile.jobId = jobId;
    this.audio.success();
    this.ui.toast(`Hired as ${job.title}!`, 'good');
    this.saveProfile();
  }

  quitJob() { this.profile.jobId = null; this.ui.toast('You quit your job.', ''); this.saveProfile(); }

  workShift(jobId: string) {
    const job = JOBS.find((j) => j.id === jobId);
    if (!job) return;
    if (this.profile.jobId !== jobId) { this.ui.toast('Apply for this job first.', 'bad'); return; }
    if (this.shiftingJob) { this.ui.toast('Already working a shift…', ''); return; }
    this.shiftingJob = jobId;
    this.shiftTimer = job.shiftSeconds;
    this.ui.toast(`Working… ${job.shiftSeconds}s`, '');
    const tick = setInterval(() => {
      this.shiftTimer -= 1;
      if (this.shiftTimer <= 0) {
        clearInterval(tick);
        this.completeShift(job);
      }
    }, 1000);
  }

  private completeShift(job: any) {
    this.shiftingJob = null;
    this.addCash(job.pay);
    this.addXP(job.xp);
    this.profile.stats.reputation = Math.min(100, this.profile.stats.reputation + 1);
    this.audio.cash();
    this.ui.toast(`Shift complete! +₦${job.pay.toLocaleString()} +${job.xp} XP`, 'good');
    this.saveProfile();
  }

  // ---------- Housing ----------
  buyProperty(id: string) {
    const p = PROPERTIES.find((x) => x.id === id);
    if (!p) return;
    if (this.profile.ownedPropertyIds.includes(id)) return;
    const total = this.profile.wallet.cash + this.profile.wallet.bank;
    if (total < p.price) { this.ui.toast('Not enough funds', 'bad'); return; }
    // spend from bank first
    let rem = p.price;
    const fromBank = Math.min(this.profile.wallet.bank, rem);
    this.profile.wallet.bank -= fromBank; rem -= fromBank;
    this.profile.wallet.cash -= rem;
    this.profile.ownedPropertyIds.push(id);
    if (!this.profile.homePropertyId) this.profile.homePropertyId = id;
    this.audio.cash();
    this.ui.toast(`Purchased ${p.name}!`, 'good');
    this.addXP(40);
    this.saveProfile();
  }

  rentProperty(id: string) {
    const p = PROPERTIES.find((x) => x.id === id);
    if (!p) return;
    if (this.profile.wallet.cash < p.rent) { this.ui.toast('Not enough cash for first rent', 'bad'); return; }
    this.profile.wallet.cash -= p.rent;
    if (!this.profile.ownedPropertyIds.includes(id)) this.profile.ownedPropertyIds.push(id);
    this.profile.homePropertyId = id;
    this.audio.cash();
    this.ui.toast(`Renting ${p.name}`, 'good');
    this.saveProfile();
  }

  setHome(id: string) {
    if (!this.profile.ownedPropertyIds.includes(id)) return;
    this.profile.homePropertyId = id;
    this.ui.toast('Home set', 'good');
    this.saveProfile();
  }

  // ---------- Vehicles ----------
  buyVehicle(kind: string) {
    const def = VEHICLES[kind];
    if (!def) return;
    const total = this.profile.wallet.cash + this.profile.wallet.bank;
    if (total < def.price) { this.ui.toast('Not enough funds', 'bad'); return; }
    let rem = def.price;
    const fromBank = Math.min(this.profile.wallet.bank, rem);
    this.profile.wallet.bank -= fromBank; rem -= fromBank;
    this.profile.wallet.cash -= rem;
    const id = 'owned_' + kind + '_' + Math.random().toString(36).slice(2, 6);
    this.profile.ownedVehicleIds.push(id);
    // spawn next to player
    const v = new Vehicle(id, def);
    v.owned = true;
    v.setPosition(this.player.position.x + 4, 0, this.player.position.z + 2);
    v.yaw = this.player.yaw;
    v.group.rotation.y = v.yaw;
    this.vehicles.push(v);
    this.scene.add(v.group);
    this.audio.cash();
    this.ui.toast(`Bought ${def.name}! It's parked nearby.`, 'good');
    this.addXP(30);
    this.saveProfile();
  }

  // ---------- Business ----------
  buyBusiness(id: string) {
    const b = BUSINESSES.find((x) => x.id === id);
    if (!b) return;
    if (this.ownedBusinesses.includes(id)) return;
    const total = this.profile.wallet.cash + this.profile.wallet.bank;
    if (total < b.price) { this.ui.toast('Not enough funds', 'bad'); return; }
    let rem = b.price;
    const fromBank = Math.min(this.profile.wallet.bank, rem);
    this.profile.wallet.bank -= fromBank; rem -= fromBank;
    this.profile.wallet.cash -= rem;
    this.ownedBusinesses.push(id);
    this.bizStock[id] = 10; this.bizEmployees[id] = 1; this.bizRep[id] = 50;
    this.audio.cash();
    this.ui.toast(`You now own ${b.name}!`, 'good');
    this.addXP(50);
    this.saveExtras();
  }

  restockBusiness(id: string) {
    if (!this.ownedBusinesses.includes(id)) return;
    if (!this.spend(5000)) { this.ui.toast('Not enough cash', 'bad'); return; }
    this.bizStock[id] = (this.bizStock[id] ?? 0) + 10;
    this.ui.toast('Restocked +10 units', 'good');
    this.saveExtras();
  }

  hireStaff(id: string) {
    if (!this.ownedBusinesses.includes(id)) return;
    if (!this.spend(3000)) { this.ui.toast('Not enough cash', 'bad'); return; }
    this.bizEmployees[id] = Math.min(5, (this.bizEmployees[id] ?? 0) + 1);
    this.ui.toast('Hired a staff member', 'good');
    this.saveExtras();
  }

  collectProfits(id: string) {
    const b = BUSINESSES.find((x) => x.id === id);
    if (!b || !this.ownedBusinesses.includes(id)) return;
    const stock = this.bizStock[id] ?? 0;
    const emp = this.bizEmployees[id] ?? 0;
    const rep = this.bizRep[id] ?? 50;
    const income = Math.round(b.baseIncome * (0.4 + Math.min(1, stock / 20) * 0.4 + Math.min(1, emp / 3) * 0.3) * (0.6 + rep / 125));
    this.profile.wallet.cash += income;
    this.bizStock[id] = Math.max(0, stock - 3);
    this.audio.cash();
    this.ui.toast(`Collected ₦${income.toLocaleString()}`, 'good');
    this.saveExtras();
  }

  // ---------- Banking ----------
  bankDeposit(amount: number) {
    amount = Math.min(amount, this.profile.wallet.cash);
    if (amount <= 0) return;
    this.profile.wallet.cash -= amount; this.profile.wallet.bank += amount;
    this.audio.cash(); this.ui.toast(`Deposited ₦${amount.toLocaleString()}`, 'good');
    this.saveProfile();
  }

  bankWithdraw(amount: number) {
    amount = Math.min(amount, this.profile.wallet.bank);
    if (amount <= 0) return;
    this.profile.wallet.bank -= amount; this.profile.wallet.cash += amount;
    this.audio.cash(); this.ui.toast(`Withdrew ₦${amount.toLocaleString()}`, 'good');
    this.saveProfile();
  }

  // ---------- Social ----------
  sendChat(text: string) {
    this.net.chat(text);
    this.ui.addChat(this.profile.name, text);
  }

  doEmote(emote: string) {
    this.net.emote(emote);
    this.ui.toast(`*${emote}*`, 'good');
  }

  // ---------- Progression ----------
  addXP(n: number) {
    this.profile.stats.xp += n;
    while (this.profile.stats.xp >= this.profile.stats.xpNext) {
      this.profile.stats.xp -= this.profile.stats.xpNext;
      this.profile.stats.level++;
      this.profile.stats.xpNext = Math.round(this.profile.stats.xpNext * 1.5);
      this.audio.success();
      this.ui.toast(`🎉 Level up! Now Level ${this.profile.stats.level}`, 'good');
    }
  }

  // ---------- Settings ----------
  setGraphics(level: string) {
    this.graphics = level as any;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, level === 'high' ? 2 : level === 'medium' ? 1.5 : 1));
    const ped = level === 'low' ? 10 : level === 'medium' ? 26 : 40;
    const traf = level === 'low' ? 6 : level === 'medium' ? 14 : 22;
    this.npcs.setCount(ped, traf);
    this.scene.fog = new THREE.Fog((this.scene.fog as THREE.Fog).color, level === 'low' ? 60 : 120, level === 'low' ? 200 : 420);
    this.ui.toast(`Graphics: ${level}`, '');
  }

  setVolume(v: number) { this.audio.setMasterVolume(v); }

  teleportTo(x: number, z: number) {
    if (this.inInterior) this.exitInterior();
    this.player.placeSafe(x, z, this.city.colliders);
    this.ui.toast('Teleported', '');
  }

  // ---------- Remote state broadcast ----------
  broadcastState() {
    if (!this.profile) return;
    const p = this.player;
    this.net.sendState(p.position.x, p.position.y, p.position.z, p.yaw, this.currentVehicle ? 'drive' : p.getAnimName(), this.currentVehicle ? this.currentVehicle.id : null);
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
}
