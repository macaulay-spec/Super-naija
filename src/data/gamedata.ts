import type { ItemDef, JobDef, PropertyDef, VehicleDef, BusinessDef } from '../core/types';

// ============================================================
// ITEMS — Nigerian-flavoured catalogue
// ============================================================
export const ITEMS: Record<string, ItemDef> = {
  // Food & drink
  jollof:      { id: 'jollof', name: 'Jollof Rice Plate', category: 'food', price: 1200, sell: 400, emoji: '🍚', effect: { hunger: 45 } },
  amala:       { id: 'amala', name: 'Amala & Ewedu', category: 'food', price: 1000, sell: 350, emoji: '🥣', effect: { hunger: 50 } },
  suya:        { id: 'suya', name: 'Suya Skewer', category: 'food', price: 700, sell: 250, emoji: '🍢', effect: { hunger: 30 } },
  puffpuff:    { id: 'puffpuff', name: 'Puff Puff (5)', category: 'food', price: 300, sell: 100, emoji: '🧆', effect: { hunger: 18 } },
  bottledwater:{ id: 'bottledwater', name: 'Bottled Water', category: 'food', price: 150, sell: 50, emoji: '💧', effect: { hunger: 8, hygiene: 5 } },
  zobo:        { id: 'zobo', name: 'Zobo Drink', category: 'food', price: 400, sell: 130, emoji: '🥤', effect: { hunger: 12, energy: 8 } },
  plantain:    { id: 'plantain', name: 'Fried Plantain', category: 'food', price: 500, sell: 160, emoji: '🍌', effect: { hunger: 25 } },
  bread:       { id: 'bread', name: 'Agege Bread', category: 'food', price: 400, sell: 130, emoji: '🍞', effect: { hunger: 22 } },
  // Clothing
  ankara:      { id: 'ankara', name: 'Ankara Outfit', category: 'clothing', price: 6500, sell: 2200, emoji: '👗', slot: 'outfit' },
  agbada:      { id: 'agbada', name: 'Agbada Set', category: 'clothing', price: 14000, sell: 5000, emoji: '🧥', slot: 'outfit' },
  jeans:       { id: 'jeans', name: 'Jeans & Tee', category: 'clothing', price: 4500, sell: 1500, emoji: '👖', slot: 'outfit' },
  sneakers:    { id: 'sneakers', name: 'Sneakers', category: 'clothing', price: 8000, sell: 2600, emoji: '👟', slot: 'none' },
  // Tools / misc
  phone:       { id: 'phone', name: 'Smartphone', category: 'tool', price: 45000, sell: 15000, emoji: '📱' },
  generator:   { id: 'generator', name: 'I Better Pass My Neighbour', category: 'tool', price: 22000, sell: 7000, emoji: '🔌' },
  toolbox:     { id: 'toolbox', name: 'Mechanic Toolbox', category: 'tool', price: 12000, sell: 4000, emoji: '🧰' },
  // Furniture
  mattress:    { id: 'mattress', name: 'Foam Mattress', category: 'furniture', price: 18000, sell: 6000, emoji: '🛏️' },
  tv:          { id: 'tv', name: 'LED TV', category: 'furniture', price: 65000, sell: 22000, emoji: '📺' },
  fan:         { id: 'fan', name: 'Standing Fan', category: 'furniture', price: 15000, sell: 5000, emoji: '🌀' },
  chair:       { id: 'chair', name: 'Plastic Chair', category: 'furniture', price: 3500, sell: 1200, emoji: '🪑' },
  // Business stock
  ingredients: { id: 'ingredients', name: 'Food Ingredients (crate)', category: 'stock', price: 3000, sell: 900, emoji: '🥬' },
  fuelcan:     { id: 'fuelcan', name: 'Fuel (Jerrycan)', category: 'stock', price: 2500, sell: 800, emoji: '⛽' },
};

// ============================================================
// JOBS — professions across Ibadan
// ============================================================
export const JOBS: JobDef[] = [
  { id: 'shopkeeper', title: 'Shop Assistant', employer: 'Bodija Superstore', emoji: '🏪', pay: 4500, xp: 30, minLevel: 1, shiftSeconds: 45, location: [-60, 0, 40], description: 'Stock shelves and serve customers.' },
  { id: 'waiter',     title: 'Restaurant Waiter', employer: 'Mama Nkechi Kitchen', emoji: '🍽️', pay: 5000, xp: 35, minLevel: 1, shiftSeconds: 50, location: [70, 0, -30], description: 'Take orders and serve hungry customers.' },
  { id: 'delivery',   title: 'Delivery Rider', employer: 'Ibadan Express', emoji: '🛵', pay: 6000, xp: 40, minLevel: 2, shiftSeconds: 60, location: [20, 0, 90], description: 'Deliver parcels across the city.' },
  { id: 'mechanic',   title: 'Auto Mechanic', employer: 'Dugbe Motors', emoji: '🔧', pay: 7000, xp: 45, minLevel: 2, shiftSeconds: 55, location: [-90, 0, -70], description: 'Repair vehicles at the garage.' },
  { id: 'driver',     title: 'Taxi Driver', employer: 'Ibadan Cabs', emoji: '🚕', pay: 8000, xp: 50, minLevel: 3, shiftSeconds: 70, location: [0, 0, 0], description: 'Move passengers around the city.' },
  { id: 'security',   title: 'Security Guard', employer: 'Mokola Plaza', emoji: '🛡️', pay: 5500, xp: 35, minLevel: 2, shiftSeconds: 50, location: [110, 0, 60], description: 'Guard the premises through the night.' },
  { id: 'engineer',   title: 'Site Engineer', employer: 'UI Construction', emoji: '👷', pay: 12000, xp: 70, minLevel: 5, shiftSeconds: 80, location: [-40, 0, 120], description: 'Supervise building projects.' },
];

// ============================================================
// PROPERTIES — housing & business premises
// ============================================================
export const PROPERTIES: PropertyDef[] = [
  { id: 'apt_bodija',  name: 'Bodija 1-Bed Apartment', kind: 'apartment', price: 850000, rent: 15000, position: [-100, 0, 30], door: [-90, 0, 30], size: [16, 14] },
  { id: 'bun_agodi',   name: 'Agodi Bungalow',         kind: 'bungalow',  price: 1500000, rent: 22000, position: [100, 0, -80], door: [90, 0, -80], size: [18, 16] },
  { id: 'dup_jericho', name: 'Jericho Duplex',         kind: 'duplex',    price: 4200000, rent: 45000, position: [-120, 0, -120], door: [-108, 0, -120], size: [22, 20] },
  { id: 'apt_mokola',  name: 'Mokola Studio Flat',     kind: 'apartment', price: 600000, rent: 11000, position: [120, 0, 70], door: [110, 0, 70], size: [14, 12] },
  { id: 'shop_dugbe',  name: 'Dugbe Shop Unit',        kind: 'shop',      price: 1100000, rent: 18000, position: [-80, 0, -80], door: [-70, 0, -80], size: [16, 14] },
];

// ============================================================
// VEHICLES — Nigerian transport
// ============================================================
export const VEHICLES: Record<string, VehicleDef> = {
  keke:   { id: 'keke',   name: 'Keke NAPEP (Tricycle)', kind: 'keke',  price: 320000,  maxSpeed: 16, accel: 9,  color: 0xf2c200, seats: 3 },
  okada:  { id: 'okada',  name: 'Okada (Motorcycle)',    kind: 'okada', price: 210000,  maxSpeed: 24, accel: 14, color: 0x1f7a3d, seats: 2 },
  taxi:   { id: 'taxi',   name: 'Taxi (Corolla)',        kind: 'taxi',  price: 2400000, maxSpeed: 30, accel: 11, color: 0xd8d8d8, seats: 4 },
  danfo:  { id: 'danfo',  name: 'Danfo Minibus',         kind: 'bus',   price: 3800000, maxSpeed: 26, accel: 8,  color: 0xf2c200, seats: 8 },
  car:    { id: 'car',    name: 'Toyota Camry',          kind: 'car',   price: 6500000, maxSpeed: 38, accel: 13, color: 0x2b3a67, seats: 4 },
};

// ============================================================
// BUSINESSES
// ============================================================
export const BUSINESSES: BusinessDef[] = [
  { id: 'biz_restaurant', name: 'Mama Nkechi Kitchen', kind: 'restaurant', price: 900000,  position: [70, 0, -30], baseIncome: 22000 },
  { id: 'biz_shop',       name: 'Bodija Superstore',   kind: 'shop',       price: 1400000, position: [-60, 0, 40], baseIncome: 30000 },
  { id: 'biz_delivery',   name: 'Ibadan Express Logistics', kind: 'delivery', price: 750000, position: [20, 0, 90], baseIncome: 18000 },
  { id: 'biz_garage',     name: 'Dugbe Motors Garage', kind: 'garage',     price: 1200000, position: [-90, 0, -70], baseIncome: 26000 },
];

export const SKIN_TONES = ['#3b2417', '#5a3a24', '#7a5233', '#9c6b45', '#b98a63', '#d3a884'];
export const HAIR_STYLES = ['Low Cut', 'Afro', 'Braids', 'Cap'];
