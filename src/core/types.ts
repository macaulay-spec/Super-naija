// ============================================================
// IBADAN LIFE — Shared Types & Constants
// ============================================================

export const WORLD = {
  SIZE: 480,          // world is SIZE x SIZE units (meters)
  BLOCK: 60,          // city block pitch
  ROAD_W: 14,         // road width
  SIDEWALK_W: 4,
  GRAVITY: -22,
  DAY_LENGTH: 600,    // seconds for a full day/night cycle
};

export type NeedKey = 'hunger' | 'energy' | 'hygiene';

export interface Needs {
  hunger: number;   // 0..100 (100 = full)
  energy: number;
  hygiene: number;
}

export interface PlayerStats {
  level: number;
  xp: number;
  xpNext: number;
  reputation: number;
}

export interface Wallet {
  cash: number;
  bank: number;
}

export interface PlayerProfile {
  id: string;
  name: string;
  skin: number;
  outfit: string;
  hair: number;
  needs: Needs;
  stats: PlayerStats;
  wallet: Wallet;
  position: [number, number, number];
  rotation: number;
  jobId: string | null;
  jobShiftProgress: number;
  homePropertyId: string | null;
  ownedPropertyIds: string[];
  ownedVehicleIds: string[];
  inventory: InventoryItem[];
  wanted: number;      // 0..5 stars
  jailUntil: number;   // timestamp ms
  lastSeen: number;
  created: number;
}

export interface InventoryItem {
  id: string;
  qty: number;
  equipped?: boolean;
}

export interface ItemDef {
  id: string;
  name: string;
  category: 'food' | 'clothing' | 'tool' | 'furniture' | 'misc' | 'stock';
  price: number;
  sell: number;
  emoji: string;
  effect?: Partial<Needs>;
  slot?: 'outfit' | 'hair' | 'none';
}

export interface JobDef {
  id: string;
  title: string;
  employer: string;
  emoji: string;
  pay: number;          // per shift
  xp: number;
  minLevel: number;
  shiftSeconds: number;
  location: [number, number, number];
  description: string;
}

export interface PropertyDef {
  id: string;
  name: string;
  kind: 'apartment' | 'bungalow' | 'duplex' | 'shop';
  price: number;
  rent: number;         // per in-game day
  position: [number, number, number];
  door: [number, number, number];
  size: [number, number];
}

export interface VehicleDef {
  id: string;
  name: string;
  kind: 'car' | 'taxi' | 'bus' | 'keke' | 'okada';
  price: number;
  maxSpeed: number;
  accel: number;
  color: number;
  seats: number;
}

export interface BusinessDef {
  id: string;
  name: string;
  kind: 'restaurant' | 'shop' | 'delivery' | 'garage';
  price: number;
  position: [number, number, number];
  baseIncome: number;
}

export interface NetPlayer {
  id: string;
  name: string;
  x: number; y: number; z: number;
  ry: number;
  skin: number;
  outfit: string;
  hair: number;
  anim: string;
  vehicleId: string | null;
}

export type NetMsg =
  | { t: 'hello'; profile: Partial<PlayerProfile> }
  | { t: 'welcome'; id: string; players: NetPlayer[]; serverTime: number }
  | { t: 'state'; x: number; y: number; z: number; ry: number; anim: string; vehicleId: string | null }
  | { t: 'join'; player: NetPlayer }
  | { t: 'leave'; id: string }
  | { t: 'chat'; id: string; name: string; text: string }
  | { t: 'emote'; id: string; emote: string }
  | { t: 'ping'; time: number }
  | { t: 'pong'; time: number };
