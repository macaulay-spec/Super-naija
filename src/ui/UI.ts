import type { PlayerProfile } from '../core/types';
import { ITEMS, JOBS, PROPERTIES, VEHICLES, BUSINESSES } from '../data/gamedata';
import type { City } from '../world/City';

// ============================================================
// UI — HUD, modals, minimap, chat, toasts
// ============================================================

export class UI {
  game: any;
  private $ = (id: string) => document.getElementById(id)!;
  private modalOpen = false;
  private currentTab = '';

  constructor(game: any) {
    this.game = game;
    this.bindQuickActions();
    this.bindModalClose();
    this.bindChat();
  }

  // ---------- HUD ----------
  showHUD(show: boolean) {
    this.$('hud').classList.toggle('hidden', !show);
    const touch = this.game.input?.usingTouch;
    this.$('mobile-controls').classList.toggle('hidden', !touch);
    this.$('desktop-hint').classList.toggle('hidden', !!touch);
  }

  updateHUD(p: PlayerProfile) {
    this.$('hud-cash').textContent = Math.floor(p.wallet.cash).toLocaleString();
    this.$('hud-name').textContent = p.name;
    this.$('hud-level').textContent = 'Lv ' + p.stats.level;
    (this.$('bar-hunger') as HTMLElement).style.width = Math.max(0, Math.min(100, p.needs.hunger)) + '%';
    (this.$('bar-energy') as HTMLElement).style.width = Math.max(0, Math.min(100, p.needs.energy)) + '%';
    (this.$('bar-hygiene') as HTMLElement).style.width = Math.max(0, Math.min(100, p.needs.hygiene)) + '%';
  }

  setConnState(s: string) {
    const el = this.$('conn-status');
    el.className = 'conn ' + (s === 'online' ? 'online' : s === 'local' ? 'local' : 'offline');
    el.textContent = s === 'online' ? '● Online' : s === 'local' ? '● Local Mode' : '● Reconnecting…';
  }

  updateInteractPrompt(text: string | null, key = 'E') {
    const el = this.$('interact-prompt');
    if (text) {
      el.classList.remove('hidden');
      this.$('interact-text').textContent = text;
      (el.querySelector('.key') as HTMLElement).textContent = this.game.input?.usingTouch ? '✋' : key;
    } else el.classList.add('hidden');
  }

  toast(text: string, type: 'good' | 'bad' | '' = '') {
    const wrap = this.$('toast-wrap');
    const d = document.createElement('div');
    d.className = 'toast ' + type;
    d.textContent = text;
    wrap.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .3s'; }, 2600);
    setTimeout(() => d.remove(), 3000);
  }

  addChat(name: string, text: string) {
    const log = this.$('chat-log');
    const d = document.createElement('div');
    d.className = 'msg';
    d.innerHTML = `<b>${this.esc(name)}:</b> ${this.esc(text)}`;
    log.appendChild(d);
    while (log.children.length > 6) log.removeChild(log.firstChild!);
    setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .5s'; }, 8000);
    setTimeout(() => d.remove(), 9000);
  }

  private esc(s: string) { return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!)); }

  // ---------- Minimap ----------
  drawMinimap(city: City, px: number, pz: number, pyaw: number, others: { x: number; z: number }[]) {
    const cv = this.$('minimap') as HTMLCanvasElement;
    const ctx = cv.getContext('2d')!;
    const S = cv.width;
    const range = 150;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(20,26,20,0.85)';
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.clip();
    const scale = S / (range * 2);
    const toMap = (x: number, z: number) => [S / 2 + (x - px) * scale, S / 2 + (z - pz) * scale];
    // roads
    ctx.strokeStyle = '#4a4a4e'; ctx.lineWidth = 4;
    for (const r of city.roadLines) {
      let [x1, y1] = toMap(-240, r); let [x2, y2] = toMap(240, r);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      [x1, y1] = toMap(r, -240); [x2, y2] = toMap(r, 240);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // buildings
    for (const f of city.footprints) {
      const [x, y] = toMap(f.x, f.z);
      ctx.fillStyle = f.c;
      ctx.fillRect(x - f.w * scale / 2, y - f.d * scale / 2, f.w * scale, f.d * scale);
    }
    // other players
    for (const o of others) {
      const [x, y] = toMap(o.x, o.z);
      ctx.fillStyle = '#4ade80';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-pyaw);
    ctx.fillStyle = '#e8b923';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // frame
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.stroke();
  }

  // ---------- Modal ----------
  openModal(title: string, bodyHtml: string, onMount?: (body: HTMLElement) => void) {
    this.$('modal-title').textContent = title;
    const body = this.$('modal-body');
    body.innerHTML = bodyHtml;
    this.$('modal').classList.remove('hidden');
    this.modalOpen = true;
    onMount?.(body);
  }

  closeModal() {
    this.$('modal').classList.add('hidden');
    this.modalOpen = false;
    this.game.input?.resume?.();
  }

  get isModalOpen() { return this.modalOpen; }

  private bindModalClose() {
    this.$('modal-close').onclick = () => this.closeModal();
    this.$('modal').addEventListener('click', (e) => { if (e.target === this.$('modal')) this.closeModal(); });
  }

  private bindQuickActions() {
    this.$('qa-phone').onclick = () => this.openPhone();
    this.$('qa-inventory').onclick = () => this.openInventory();
    this.$('qa-map').onclick = () => this.openMap();
    this.$('qa-settings').onclick = () => this.openSettings();
  }

  private bindChat() {
    const open = () => {
      const wrap = document.createElement('div');
      wrap.className = 'chat-input-wrap';
      wrap.innerHTML = `<input id="chat-field" maxlength="80" placeholder="Say something…" /><button id="chat-send">Send</button>`;
      this.$('hud').appendChild(wrap);
      const field = document.getElementById('chat-field') as HTMLInputElement;
      field.focus();
      const send = () => {
        const t = field.value.trim();
        if (t) this.game.sendChat(t);
        wrap.remove();
      };
      (document.getElementById('chat-send') as HTMLElement).onclick = send;
      field.onkeydown = (e) => { if (e.key === 'Enter') send(); if (e.key === 'Escape') wrap.remove(); };
    };
    this.game.input.onKey = (k: string) => {
      if (k === 't' && !this.modalOpen) open();
      if (k === 'p') this.openPhone();
      if (k === 'i') this.openInventory();
      if (k === 'm') this.openMap();
      if (k === 'escape') this.closeModal();
    };
  }

  // ---------- Panels ----------
  openPhone() {
    const p = this.game.profile as PlayerProfile;
    const html = `
      <div class="tabs">
        <button data-tab="jobs" class="active">Jobs</button>
        <button data-tab="bank">Bank</button>
        <button data-tab="social">Social</button>
        <button data-tab="stats">Stats</button>
      </div>
      <div id="phone-content"></div>`;
    this.openModal('📱 Phone', html, (body) => {
      const tabs = body.querySelectorAll('.tabs button');
      tabs.forEach((b) => (b as HTMLElement).onclick = () => {
        tabs.forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        this.renderPhoneTab((b as HTMLElement).dataset.tab!);
      });
      this.renderPhoneTab('jobs');
    });
  }

  private renderPhoneTab(tab: string) {
    const el = document.getElementById('phone-content')!;
    const p = this.game.profile as PlayerProfile;
    if (tab === 'jobs') {
      const cur = p.jobId ? JOBS.find((j) => j.id === p.jobId) : null;
      let h = cur ? `<h4>Current Job</h4><div class="row"><div><div class="n">${cur.emoji} ${cur.title}</div><div class="sub">${cur.employer} · ₦${cur.pay.toLocaleString()}/shift</div></div><button class="danger" id="quit-job">Quit</button></div>` : `<h4>No job yet</h4>`;
      h += `<h4>Available Jobs</h4>`;
      for (const j of JOBS) {
        const locked = p.stats.level < j.minLevel;
        h += `<div class="row"><div><div class="n">${j.emoji} ${j.title}</div><div class="sub">${j.employer} · ₦${j.pay.toLocaleString()}/shift · ${locked ? 'Requires Lv ' + j.minLevel : 'Apply at workplace'}</div></div><button data-job="${j.id}" ${locked || cur ? 'disabled' : ''}>${cur ? '—' : 'View'}</button></div>`;
      }
      el.innerHTML = h;
      el.querySelectorAll('[data-job]').forEach((b) => (b as HTMLElement).onclick = () => {
        const jid = (b as HTMLElement).dataset.job!;
        const j = JOBS.find((x) => x.id === jid)!;
        this.toast(`Go to ${j.employer} to work this shift`, '');
        this.closeModal();
      });
      const q = document.getElementById('quit-job');
      if (q) q.onclick = () => { this.game.quitJob(); this.renderPhoneTab('jobs'); };
    } else if (tab === 'bank') {
      el.innerHTML = `
        <div class="stat-line"><span>Cash</span><span>₦${Math.floor(p.wallet.cash).toLocaleString()}</span></div>
        <div class="stat-line"><span>Bank</span><span>₦${Math.floor(p.wallet.bank).toLocaleString()}</span></div>
        <h4>Deposit</h4>
        <div class="grid2">
          <button class="btn-primary" data-dep="5000">₦5,000</button>
          <button class="btn-primary" data-dep="20000">₦20,000</button>
          <button class="btn-primary" data-dep="50000">₦50,000</button>
          <button class="btn-primary" data-dep="all">All Cash</button>
        </div>
        <h4>Withdraw</h4>
        <div class="grid2">
          <button class="btn-primary" data-wd="5000">₦5,000</button>
          <button class="btn-primary" data-wd="20000">₦20,000</button>
          <button class="btn-primary" data-wd="50000">₦50,000</button>
          <button class="btn-primary" data-wd="all">All Bank</button>
        </div>`;
      el.querySelectorAll('[data-dep]').forEach((b) => (b as HTMLElement).onclick = () => {
        const v = (b as HTMLElement).dataset.dep!;
        this.game.bankDeposit(v === 'all' ? p.wallet.cash : parseInt(v));
        this.renderPhoneTab('bank');
      });
      el.querySelectorAll('[data-wd]').forEach((b) => (b as HTMLElement).onclick = () => {
        const v = (b as HTMLElement).dataset.wd!;
        this.game.bankWithdraw(v === 'all' ? p.wallet.bank : parseInt(v));
        this.renderPhoneTab('bank');
      });
    } else if (tab === 'social') {
      const others = this.game.remotePlayers ? Array.from(this.game.remotePlayers.values()) as any[] : [];
      let h = `<h4>Players Nearby (${others.length})</h4>`;
      if (!others.length) h += `<div class="row"><div class="sub">No other players online right now. Share the link to play together!</div></div>`;
      for (const o of others) {
        h += `<div class="row"><div><div class="n">${o.name}</div><div class="sub">Player</div></div><button data-wave="${o.id}">👋 Wave</button></div>`;
      }
      h += `<h4>Emotes</h4><div class="grid2">
        <button class="btn-primary" data-emote="wave">👋 Wave</button>
        <button class="btn-primary" data-emote="dance">🕺 Dance</button>
        <button class="btn-primary" data-emote="sit">🪑 Sit</button>
        <button class="btn-primary" data-emote="greet">🤝 Greet</button>
      </div>`;
      el.innerHTML = h;
      el.querySelectorAll('[data-emote]').forEach((b) => (b as HTMLElement).onclick = () => { this.game.doEmote((b as HTMLElement).dataset.emote!); this.closeModal(); });
      el.querySelectorAll('[data-wave]').forEach((b) => (b as HTMLElement).onclick = () => { this.game.doEmote('wave'); this.toast('You wave 👋', 'good'); });
    } else if (tab === 'stats') {
      el.innerHTML = `
        <div class="stat-line"><span>Level</span><span>${p.stats.level}</span></div>
        <div class="stat-line"><span>XP</span><span>${p.stats.xp} / ${p.stats.xpNext}</span></div>
        <div class="stat-line"><span>Reputation</span><span>${p.stats.reputation}</span></div>
        <div class="stat-line"><span>Wanted</span><span>${'★'.repeat(p.wanted) || 'Clean'}</span></div>
        <div class="stat-line"><span>Properties</span><span>${p.ownedPropertyIds.length}</span></div>
        <div class="stat-line"><span>Vehicles</span><span>${p.ownedVehicleIds.length}</span></div>
        <div class="stat-line"><span>Home</span><span>${p.homePropertyId ? PROPERTIES.find((x) => x.id === p.homePropertyId)?.name || '—' : 'None'}</span></div>`;
    }
  }

  openInventory() {
    const p = this.game.profile as PlayerProfile;
    let h = `<h4>Inventory (${p.inventory.length} items)</h4>`;
    if (!p.inventory.length) h += `<div class="row"><div class="sub">Your bag is empty. Visit a shop or market to buy items.</div></div>`;
    else {
      h += '<div class="grid2">';
      for (const inv of p.inventory) {
        const def = ITEMS[inv.id];
        if (!def) continue;
        h += `<div class="inv-item"><div class="n">${def.emoji} ${def.name}${inv.equipped ? ' ✓' : ''}</div><div class="q">x${inv.qty}</div>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
          ${def.effect ? `<button data-use="${inv.id}">Use</button>` : ''}
          ${def.slot === 'outfit' ? `<button data-equip="${inv.id}">Equip</button>` : ''}
          <button class="alt" data-sell="${inv.id}">Sell ₦${def.sell.toLocaleString()}</button>
          </div></div>`;
      }
      h += '</div>';
    }
    h += `<h4>Equipped Outfit</h4><div class="row"><div class="sub">Current: ${this.game.profile.outfit}</div></div>`;
    this.openModal('🎒 Inventory', h, (body) => {
      body.querySelectorAll('[data-use]').forEach((b) => (b as HTMLElement).onclick = () => { this.game.useItem((b as HTMLElement).dataset.use!); this.openInventory(); });
      body.querySelectorAll('[data-equip]').forEach((b) => (b as HTMLElement).onclick = () => { this.game.equipItem((b as HTMLElement).dataset.equip!); this.openInventory(); });
      body.querySelectorAll('[data-sell]').forEach((b) => (b as HTMLElement).onclick = () => { this.game.sellItem((b as HTMLElement).dataset.sell!); this.openInventory(); });
    });
  }

  openMap() {
    const city = this.game.city as City;
    const p = this.game.profile as PlayerProfile;
    const px = this.game.player.position.x, pz = this.game.player.position.z;
    const S = 340, range = 260;
    const scale = S / (range * 2);
    const toMap = (x: number, z: number) => [S / 2 + (x - px) * scale, S / 2 + (z - pz) * scale];
    let svg = `<svg width="${S}" height="${S}" style="background:#141a14;border-radius:12px;max-width:100%">`;
    for (const r of city.roadLines) {
      let [x1, y1] = toMap(-240, r); let [x2, y2] = toMap(240, r);
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4a4a4e" stroke-width="6"/>`;
      [x1, y1] = toMap(r, -240); [x2, y2] = toMap(r, 240);
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4a4a4e" stroke-width="6"/>`;
    }
    for (const f of city.footprints) {
      const [x, y] = toMap(f.x, f.z);
      svg += `<rect x="${x - f.w * scale / 2}" y="${y - f.d * scale / 2}" width="${f.w * scale}" height="${f.d * scale}" fill="${f.c}" opacity="0.7"/>`;
    }
    // markers
    for (const it of city.interactables) {
      const [x, y] = toMap(it.position.x, it.position.z);
      const colors: Record<string, string> = { door: '#38bdf8', job: '#4ade80', property: '#e8b923', business: '#f472b6', vendor: '#fb923c', atm: '#a78bfa', police: '#60a5fa' };
      if (colors[it.kind]) svg += `<circle cx="${x}" cy="${y}" r="4" fill="${colors[it.kind]}"/>`;
    }
    svg += `<circle cx="${S / 2}" cy="${S / 2}" r="6" fill="#e8b923"/>`;
    svg += `</svg>`;
    const legend = `<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin-top:10px">
      <span>🟦 Doors</span><span style="color:#4ade80">🟢 Jobs</span><span style="color:#e8b923">🟡 Property</span><span style="color:#f472b6">🩷 Business</span><span style="color:#fb923c">🟠 Vendors</span></div>`;
    this.openModal('🗺️ City Map', svg + legend + `<h4>Quick Travel</h4><div class="grid2">
      <button class="btn-primary" data-tp="0,25">City Centre</button>
      <button class="btn-primary" data-tp="-60,40">Supermarket</button>
      <button class="btn-primary" data-tp="70,-30">Restaurant</button>
      <button class="btn-primary" data-tp="-90,-70">Garage</button>
    </div>`, (body) => {
      body.querySelectorAll('[data-tp]').forEach((b) => (b as HTMLElement).onclick = () => {
        const [x, z] = (b as HTMLElement).dataset.tp!.split(',').map(Number);
        this.game.teleportTo(x, z); this.closeModal();
      });
    });
  }

  openSettings() {
    const g = this.game;
    this.openModal('⚙️ Settings', `
      <h4>Graphics Quality</h4>
      <div class="tabs" id="gfx-tabs">
        <button data-g="low" class="${g.graphics === 'low' ? 'active' : ''}">Low</button>
        <button data-g="medium" class="${g.graphics === 'medium' ? 'active' : ''}">Medium</button>
        <button data-g="high" class="${g.graphics === 'high' ? 'active' : ''}">High</button>
      </div>
      <h4>Audio Volume</h4>
      <input type="range" id="vol" min="0" max="100" value="${Math.round(g.audio.master?.gain.value * 100) || 50}" style="width:100%" />
      <h4>Performance</h4>
      <div class="stat-line"><span>FPS</span><span id="fps-val">—</span></div>
      <div class="stat-line"><span>Draw calls</span><span id="dc-val">—</span></div>
      <div class="stat-line"><span>Connection</span><span>${g.net.state}</span></div>
      <div class="stat-line"><span>Latency</span><span>${g.net.latency} ms</span></div>
      <h4>Controls</h4>
      <div class="row"><div class="sub">Desktop: WASD move · Mouse look · Shift sprint · Space jump · E interact · T chat</div></div>
      <div class="row"><div class="sub">Mobile: Left joystick move · Drag screen to look · Buttons to act</div></div>
    `, (body) => {
      body.querySelectorAll('#gfx-tabs button').forEach((b) => (b as HTMLElement).onclick = () => {
        body.querySelectorAll('#gfx-tabs button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        g.setGraphics((b as HTMLElement).dataset.g!);
      });
      (document.getElementById('vol') as HTMLInputElement).oninput = (e) => g.setVolume(parseInt((e.target as HTMLInputElement).value) / 100);
    });
    const iv = setInterval(() => {
      const f = document.getElementById('fps-val');
      if (!f) { clearInterval(iv); return; }
      f.textContent = Math.round(g.fps) + '';
      const dc = document.getElementById('dc-val');
      if (dc) dc.textContent = g.renderer.info.render.calls + '';
    }, 500);
  }

  // ---------- Contextual interaction panels ----------
  openShop(shopId: string) {
    const p = this.game.profile as PlayerProfile;
    const stock: Record<string, string[]> = {
      supermarket: ['jollof', 'bottledwater', 'bread', 'plantain', 'jeans', 'ankara', 'sneakers', 'phone', 'generator'],
      food: ['suya', 'jollof', 'amala', 'puffpuff', 'zobo', 'bottledwater'],
      restaurant: ['jollof', 'amala', 'plantain', 'zobo'],
      market: ['plantain', 'bread', 'ingredients', 'fuelcan', 'chair'],
      bar: ['zobo', 'bottledwater'],
    };
    const ids = stock[shopId] || stock.supermarket;
    let h = `<h4>Cash: ₦${Math.floor(p.wallet.cash).toLocaleString()}</h4>`;
    for (const id of ids) {
      const def = ITEMS[id];
      if (!def) continue;
      h += `<div class="row"><div><div class="n">${def.emoji} ${def.name}</div><div class="sub">₦${def.price.toLocaleString()}${def.effect ? ' · restores ' + Object.keys(def.effect).join(', ') : ''}</div></div><button data-buy="${id}">Buy</button></div>`;
    }
    this.openModal('🛒 Shop', h, (body) => {
      body.querySelectorAll('[data-buy]').forEach((b) => (b as HTMLElement).onclick = () => {
        this.game.buyItem((b as HTMLElement).dataset.buy!);
        this.openShop(shopId);
      });
    });
  }

  openPropertyPanel(propId: string) {
    const p = this.game.profile as PlayerProfile;
    const prop = PROPERTIES.find((x) => x.id === propId)!;
    const owned = p.ownedPropertyIds.includes(propId);
    const isHome = p.homePropertyId === propId;
    let h = `<h4>${prop.name}</h4>
      <div class="stat-line"><span>Type</span><span>${prop.kind}</span></div>
      <div class="stat-line"><span>Price</span><span>₦${prop.price.toLocaleString()}</span></div>
      <div class="stat-line"><span>Rent / day</span><span>₦${prop.rent.toLocaleString()}</span></div>
      <div class="stat-line"><span>Status</span><span>${owned ? (isHome ? 'Your Home' : 'Owned') : 'Available'}</span></div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">`;
    if (!owned) {
      h += `<button class="btn-primary" id="buy-prop" style="flex:1">Buy ₦${prop.price.toLocaleString()}</button>`;
      h += `<button class="btn-primary" id="rent-prop" style="flex:1;background:#2b3648">Rent ₦${prop.rent.toLocaleString()}/day</button>`;
    } else {
      if (!isHome) h += `<button class="btn-primary" id="set-home" style="flex:1">Set as Home</button>`;
      h += `<button class="btn-primary" id="enter-home" style="flex:1">Enter</button>`;
    }
    h += `</div>`;
    this.openModal('🏠 Property', h, (body) => {
      const bp = document.getElementById('buy-prop');
      if (bp) bp.onclick = () => { this.game.buyProperty(propId); this.openPropertyPanel(propId); };
      const rp = document.getElementById('rent-prop');
      if (rp) rp.onclick = () => { this.game.rentProperty(propId); this.openPropertyPanel(propId); };
      const sh = document.getElementById('set-home');
      if (sh) sh.onclick = () => { this.game.setHome(propId); this.openPropertyPanel(propId); };
      const eh = document.getElementById('enter-home');
      if (eh) eh.onclick = () => { this.game.enterInterior('home', prop.name); this.closeModal(); };
    });
  }

  openVehicleShop() {
    const p = this.game.profile as PlayerProfile;
    let h = `<h4>Cash: ₦${Math.floor(p.wallet.cash).toLocaleString()}</h4><h4>Vehicles for Sale</h4>`;
    for (const id of Object.keys(VEHICLES)) {
      const v = VEHICLES[id];
      h += `<div class="row"><div><div class="n">${v.name}</div><div class="sub">₦${v.price.toLocaleString()} · top ${v.maxSpeed} m/s · ${v.seats} seats</div></div><button data-buyv="${id}">Buy</button></div>`;
    }
    this.openModal('🚗 Dealership', h, (body) => {
      body.querySelectorAll('[data-buyv]').forEach((b) => (b as HTMLElement).onclick = () => {
        this.game.buyVehicle((b as HTMLElement).dataset.buyv!);
        this.openVehicleShop();
      });
    });
  }

  openBusinessPanel(bizId: string) {
    const p = this.game.profile as PlayerProfile;
    const biz = BUSINESSES.find((x) => x.id === bizId)!;
    const owned = this.game.ownedBusinesses.includes(bizId);
    let h = `<h4>${biz.name}</h4>
      <div class="stat-line"><span>Type</span><span>${biz.kind}</span></div>
      <div class="stat-line"><span>Price</span><span>₦${biz.price.toLocaleString()}</span></div>
      <div class="stat-line"><span>Base income</span><span>₦${biz.baseIncome.toLocaleString()}/day</span></div>
      <div class="stat-line"><span>Status</span><span>${owned ? 'Owned by you' : 'Available'}</span></div>`;
    if (owned) {
      h += `<h4>Management</h4>
        <div class="stat-line"><span>Stock</span><span>${this.game.bizStock[bizId] ?? 0} units</span></div>
        <div class="stat-line"><span>Employees</span><span>${this.game.bizEmployees[bizId] ?? 0}</span></div>
        <div class="stat-line"><span>Reputation</span><span>${this.game.bizRep[bizId] ?? 50}</span></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button class="btn-primary" data-restock="${bizId}">Restock ₦5,000</button>
          <button class="btn-primary" data-hire="${bizId}">Hire Staff ₦3,000</button>
          <button class="btn-primary" data-collect="${bizId}">Collect Profits</button>
        </div>`;
    } else {
      h += `<button class="btn-primary" id="buy-biz" style="margin-top:12px">Buy Business ₦${biz.price.toLocaleString()}</button>`;
    }
    this.openModal('🏢 Business', h, (body) => {
      const bb = document.getElementById('buy-biz');
      if (bb) bb.onclick = () => { this.game.buyBusiness(bizId); this.openBusinessPanel(bizId); };
      body.querySelectorAll('[data-restock]').forEach((b) => (b as HTMLElement).onclick = () => { this.game.restockBusiness(bizId); this.openBusinessPanel(bizId); });
      body.querySelectorAll('[data-hire]').forEach((b) => (b as HTMLElement).onclick = () => { this.game.hireStaff(bizId); this.openBusinessPanel(bizId); });
      body.querySelectorAll('[data-collect]').forEach((b) => (b as HTMLElement).onclick = () => { this.game.collectProfits(bizId); this.openBusinessPanel(bizId); });
    });
  }

  openJobPanel(jobId: string) {
    const p = this.game.profile as PlayerProfile;
    const job = JOBS.find((x) => x.id === jobId)!;
    const locked = p.stats.level < job.minLevel;
    const isCurrent = p.jobId === jobId;
    let h = `<h4>${job.emoji} ${job.title}</h4>
      <div class="stat-line"><span>Employer</span><span>${job.employer}</span></div>
      <div class="stat-line"><span>Pay / shift</span><span>₦${job.pay.toLocaleString()}</span></div>
      <div class="stat-line"><span>XP / shift</span><span>${job.xp}</span></div>
      <div class="stat-line"><span>Requires</span><span>Lv ${job.minLevel}</span></div>
      <p style="color:#9aa4b5;font-size:13px;margin:10px 0">${job.description}</p>`;
    if (locked) h += `<div class="row"><div class="sub">You need Level ${job.minLevel} to apply.</div></div>`;
    else if (isCurrent) h += `<button class="btn-primary" id="work-shift" style="margin-top:10px">Work a Shift (${job.shiftSeconds}s)</button>`;
    else h += `<button class="btn-primary" id="apply-job" style="margin-top:10px">Apply for this Job</button>`;
    this.openModal('💼 Job', h, (body) => {
      const aj = document.getElementById('apply-job');
      if (aj) aj.onclick = () => { this.game.applyForJob(jobId); this.openJobPanel(jobId); };
      const ws = document.getElementById('work-shift');
      if (ws) ws.onclick = () => { this.closeModal(); this.game.workShift(jobId); };
    });
  }
}
