// Quick two-client multiplayer test
import WebSocket from 'ws';

const URL = process.env.WS_URL || 'ws://localhost:8090';
const results = [];

function client(name) {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    const log = [];
    ws.on('open', () => {
      ws.send(JSON.stringify({ t: 'hello', profile: { name, skin: 2, outfit: '#e8b923', hair: 0 } }));
    });
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      log.push(m);
      if (m.t === 'welcome') {
        // send a state update and a chat
        ws.send(JSON.stringify({ t: 'state', x: 5, y: 0, z: 10, ry: 1.2, anim: 'walk', vehicleId: null }));
        ws.send(JSON.stringify({ t: 'chat', text: `hello from ${name}` }));
      }
    });
    setTimeout(() => { ws.close(); resolve({ name, log }); }, 2500);
  });
}

(async () => {
  const [a, b] = await Promise.all([client('Ade'), client('Ngozi')]);
  const summarize = (r) => ({
    name: r.name,
    welcome: !!r.log.find((m) => m.t === 'welcome'),
    myId: r.log.find((m) => m.t === 'welcome')?.id,
    sawJoin: r.log.filter((m) => m.t === 'join').map((m) => m.player.name),
    sawState: r.log.filter((m) => m.t === 'state').length,
    sawChat: r.log.filter((m) => m.t === 'chat').map((m) => `${m.name}: ${m.text}`),
  });
  console.log(JSON.stringify({ A: summarize(a), B: summarize(b) }, null, 2));
  process.exit(0);
})();
