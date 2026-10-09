// ============================================================
// IBADAN LIFE — multiplayer server
// Serves the built client AND hosts the WebSocket shared world
// on the SAME port (so it works behind any single-port host/proxy).
// ============================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = process.env.PORT || 8090;

// ---------- Static file server ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = path.join(DIST, urlPath);
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback to index.html
      fs.readFile(path.join(DIST, 'index.html'), (e2, d2) => {
        if (e2) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

// ---------- WebSocket shared world (same port as HTTP) ----------
const wss = new WebSocketServer({ server });

const players = new Map(); // ws -> player record
let nextId = 1;

function broadcast(msg, exceptWs) {
  const data = JSON.stringify(msg);
  for (const ws of wss.clients) {
    if (ws === exceptWs) continue;
    if (ws.readyState === 1) {
      try { ws.send(data); } catch {}
    }
  }
}

function publicPlayers(exceptId) {
  return [...players.values()].filter((p) => p.id !== exceptId);
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.t === 'hello') {
      const p = msg.profile || {};
      const id = 'srv_' + (nextId++);
      const player = {
        id,
        name: String(p.name || 'Player').slice(0, 16),
        skin: p.skin ?? 2,
        outfit: p.outfit || '#e8b923',
        hair: p.hair ?? 0,
        x: 0, y: 0, z: 25, ry: 0, anim: 'idle', vehicleId: null,
      };
      players.set(ws, player);
      ws.send(JSON.stringify({
        t: 'welcome',
        id,
        players: publicPlayers(id),
        serverTime: Date.now(),
      }));
      broadcast({ t: 'join', player }, ws);
      console.log(`[join] ${player.name} (${id}) — ${players.size} online`);
      return;
    }

    const me = players.get(ws);
    if (!me) return;

    if (msg.t === 'state') {
      me.x = msg.x; me.y = msg.y; me.z = msg.z;
      me.ry = msg.ry; me.anim = msg.anim; me.vehicleId = msg.vehicleId;
      broadcast({
        t: 'state', id: me.id,
        x: me.x, y: me.y, z: me.z, ry: me.ry, anim: me.anim, vehicleId: me.vehicleId,
      }, ws);
    } else if (msg.t === 'chat') {
      const text = String(msg.text || '').slice(0, 120);
      if (text) broadcast({ t: 'chat', id: me.id, name: me.name, text });
    } else if (msg.t === 'emote') {
      broadcast({ t: 'emote', id: me.id, emote: String(msg.emote || '').slice(0, 20) }, ws);
    } else if (msg.t === 'ping') {
      ws.send(JSON.stringify({ t: 'pong', time: msg.time }));
    }
  });

  ws.on('close', () => {
    const me = players.get(ws);
    if (me) {
      players.delete(ws);
      broadcast({ t: 'leave', id: me.id });
      console.log(`[leave] ${me.name} — ${players.size} online`);
    }
  });
});

// heartbeat to drop dead connections
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`[ibadan] http+ws server ready on :${PORT}`);
});
