# IBADAN LIFE

A browser-based, mobile-first 3D open-world Nigerian life-simulation game set in a
culturally authentic, fictionalized Ibadan. Built with **Three.js + TypeScript + Vite**
and a **Node.js WebSocket** shared-world server for real multiplayer.

> *"Lagos is a place. Ibadan is a people."*

## Features

- **3D open world** — connected road grid, junctions, sidewalks, buildings, markets,
  landmarks (Cocoa House-inspired tower + hills), street props, day/night cycle and fog.
- **Third-person character** — WASD + mouse look on desktop, virtual joystick + drag-look
  on mobile; sprint, jump, animated walk/run/idle, gravity and AABB collision.
- **Vehicles** — keke napep, okada, taxi, danfo bus and private cars. Enter, drive with
  arcade physics, fuel consumption, and repair at the garage.
- **Interiors** — enterable shops, restaurants, garages, offices, banks, police stations,
  hangouts and homes (each a separate room scene).
- **Life simulation** — hunger / energy / hygiene needs, jobs with shifts, XP & levels,
  reputation, and rent.
- **Economy & businesses** — buy/sell inventory, run businesses, restock, hire staff,
  collect profits, bank deposits/withdrawals.
- **Housing & property** — buy or rent apartments, bungalows and duplexes; set your home.
- **Real multiplayer** — WebSocket shared world: see other real players move, chat and emote.
- **40 ambient NPCs** — wandering pedestrians and traffic cars that follow the road graph.
- **Mobile-first UI** — HUD, minimap radar, phone (jobs/bank/social/stats), inventory,
  map, settings, toasts and chat.

## Tech stack

| Layer | Tech |
|-------|------|
| Rendering | Three.js (WebGL2) |
| Language | TypeScript (strict) |
| Build | Vite |
| Multiplayer | Node.js `ws` WebSocket server |
| Audio | Procedural WebAudio (no assets) |
| Persistence | localStorage |

## Run locally

```bash
cd super-naija
npm install
npm run build        # build the client into dist/
npm run server       # serve dist/ + WebSocket shared world on :8090
# open http://localhost:8090
```

For development with hot reload:

```bash
npm run dev          # Vite dev server
npm run server       # multiplayer server (separate terminal)
```

## Controls

- **Desktop:** `WASD`/arrows move, mouse look (click to lock), `Shift` sprint, `Space`
  jump, `E` interact, `P` phone, `M` map.
- **Mobile:** left joystick moves, drag the right side of the screen to look, on-screen
  action buttons for interact / jump / sprint.

## Project layout

```
super-naija/
├─ index.html            # app shell, HUD, setup screen
├─ src/
│  ├─ core/              # Game orchestrator, Input, types
│  ├─ world/             # City generator, Interiors
│  ├─ entities/          # Player, Vehicle, NPC, RemotePlayer
│  ├─ systems/           # Audio
│  ├─ net/               # Network (WebSocket client)
│  ├─ data/              # Items, jobs, properties, vehicles, businesses
│  ├─ ui/                # UI + stylesheet
│  └─ main.ts            # entry point
└─ server/index.js       # static + WebSocket multiplayer server
```
