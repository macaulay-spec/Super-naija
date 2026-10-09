import type { NetMsg, NetPlayer } from '../core/types';

// ============================================================
// Network — WebSocket client with auto-reconnect
// ============================================================

export type ConnState = 'connecting' | 'online' | 'offline' | 'local';

export class Network {
  ws: WebSocket | null = null;
  state: ConnState = 'connecting';
  myId = '';
  private url: string;
  private reconnectTimer: any = null;
  private reconnectDelay = 1000;
  private sendAccum = 0;
  private lastState = '';
  private pingTime = 0;
  latency = 0;

  onState?: (s: ConnState) => void;
  onJoin?: (p: NetPlayer) => void;
  onLeave?: (id: string) => void;
  onStateMsg?: (p: NetPlayer) => void;
  onChat?: (name: string, text: string) => void;
  onEmote?: (id: string, emote: string) => void;
  onWelcome?: (id: string, players: NetPlayer[]) => void;

  constructor(url?: string) {
    // Derive server URL. Priority:
    //  1. explicit url argument
    //  2. window.__IBADAN_WS_URL__ (full ws:// or wss:// url)
    //  3. window.__IBADAN_WS_PORT__ (host + custom port)
    //  4. same-origin (host + current port) — works when the app is served
    //     by the multiplayer server itself on a single port.
    if (url) {
      this.url = url;
    } else if ((window as any).__IBADAN_WS_URL__) {
      this.url = (window as any).__IBADAN_WS_URL__;
    } else {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = location.hostname || 'localhost';
      const overridePort = (window as any).__IBADAN_WS_PORT__;
      const port = overridePort || location.port;
      this.url = port ? `${proto}//${host}:${port}` : `${proto}//${host}`;
    }
  }

  connect() {
    this.setState('connecting');
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.setState('online');
    };
    this.ws.onclose = () => {
      this.setState('offline');
      this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      this.setState('offline');
    };
    this.ws.onmessage = (ev) => {
      let msg: NetMsg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      this.handle(msg);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.6, 15000);
      this.connect();
    }, this.reconnectDelay);
  }

  private setState(s: ConnState) {
    if (this.state !== s) { this.state = s; this.onState?.(s); }
  }

  private handle(msg: NetMsg) {
    switch (msg.t) {
      case 'welcome':
        this.myId = msg.id;
        this.onWelcome?.(msg.id, msg.players);
        break;
      case 'join': this.onJoin?.(msg.player); break;
      case 'leave': this.onLeave?.(msg.id); break;
      case 'state': this.onStateMsg?.(msg as any); break;
      case 'chat': this.onChat?.(msg.name, msg.text); break;
      case 'emote': this.onEmote?.(msg.id, msg.emote); break;
      case 'pong': this.latency = Date.now() - msg.time; break;
    }
  }

  hello(profile: any) { this.send({ t: 'hello', profile } as NetMsg); }

  sendState(x: number, y: number, z: number, ry: number, anim: string, vehicleId: string | null) {
    const key = `${x.toFixed(1)}|${y.toFixed(1)}|${z.toFixed(1)}|${ry.toFixed(1)}|${anim}|${vehicleId}`;
    if (key === this.lastState) return;
    this.lastState = key;
    this.send({ t: 'state', x, y, z, ry, anim, vehicleId });
  }

  chat(text: string) { this.send({ t: 'chat', text } as any); }
  emote(emote: string) { this.send({ t: 'emote', emote } as any); }
  ping() { this.send({ t: 'ping', time: Date.now() }); }

  private send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify(msg)); } catch {}
    }
  }

  update(dt: number) {
    this.sendAccum += dt;
    if (this.sendAccum > 5) { this.sendAccum = 0; this.ping(); }
  }
}
