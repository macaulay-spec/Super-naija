import { Game } from './core/Game';

// ============================================================
// IBADAN LIFE — entry point
// ============================================================

const BUILD = 'v1.1.0';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const loadFill = document.getElementById('load-fill')!;
const loadStatus = document.getElementById('load-status')!;
const enterBtn = document.getElementById('enter-btn') as HTMLButtonElement;
const loadingScreen = document.getElementById('loading-screen')!;
const setupScreen = document.getElementById('setup-screen')!;
const hud = document.getElementById('hud')!;

const game = new Game(canvas);
(window as any).game = game; // debug
(window as any).__IBADAN_BUILD__ = BUILD;

let ready = false;
let bootFailed = false;
let entering = false; // guards against double-trigger (click + Enter)

const isHidden = (el: HTMLElement) => el.classList.contains('hidden');

function setLoadMessage(msg: string, isError = false) {
  loadStatus.textContent = msg;
  loadStatus.style.color = isError ? '#d64545' : '';
}

// --- Diagnostics: helps confirm the build + GPU support on any device ---
function webglStatus(): string {
  try {
    const c = document.createElement('canvas');
    if (c.getContext('webgl2')) return 'WebGL2 ✓';
    if (c.getContext('webgl') || c.getContext('experimental-webgl')) return 'WebGL1 only ✗';
    return 'WebGL ✗';
  } catch { return 'WebGL ?'; }
}

function addDiagBadge() {
  const el = document.createElement('div');
  el.id = 'build-tag';
  el.textContent = `Build ${BUILD} · ${webglStatus()}`;
  el.style.cssText =
    'position:absolute;bottom:10px;left:50%;transform:translateX(-50%);' +
    'font:11px/1.4 system-ui,sans-serif;opacity:.5;color:#9aa4b2;' +
    'letter-spacing:.4px;pointer-events:none;white-space:nowrap;';
  loadingScreen.appendChild(el);
}
addDiagBadge();

async function boot() {
  try {
    await game.init((pct, label) => {
      loadFill.style.width = pct + '%';
      setLoadMessage(label);
    });
    ready = true;
    setLoadMessage('Tap to enter — or press Enter');
    enterBtn.classList.remove('hidden');
  } catch (err) {
    bootFailed = true;
    console.error(err);
    setLoadMessage('Failed to start: ' + (err as Error).message + ' · ' + webglStatus(), true);
    // Give the player a way out instead of a dead screen.
    enterBtn.classList.remove('hidden');
    enterBtn.textContent = 'Retry';
  }
}

// ------------------------------------------------------------
// Shared entry path used by BOTH the button and the Enter key.
// Never fails silently: always gives visible feedback.
// ------------------------------------------------------------
function tryEnter() {
  if (entering) return;

  // Not finished loading yet — tell the player instead of doing nothing.
  if (!ready) {
    if (bootFailed) {
      bootFailed = false;
      enterBtn.classList.add('hidden');
      setLoadMessage('Retrying…');
      boot();
      return;
    }
    setLoadMessage('Still loading… please wait a moment.');
    return;
  }

  entering = true;
  enterBtn.disabled = true;
  const prevLabel = enterBtn.textContent;
  enterBtn.textContent = 'Loading…';

  // Audio is best-effort: it must NEVER block entry.
  try {
    game.audio.init();
    game.audio.resume();
  } catch (err) {
    console.warn('Audio init skipped:', err);
  }

  // Resume / create profile. loadProfile() is hardened and never throws.
  let hasSave = false;
  try {
    hasSave = game.loadProfile();
  } catch (err) {
    console.error('loadProfile failed:', err);
    hasSave = false;
  }

  if (hasSave) {
    startGame();
  } else {
    loadingScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    const nameInput = document.getElementById('setup-name') as HTMLInputElement | null;
    if (nameInput) setTimeout(() => nameInput.focus(), 50);
  }

  entering = false;
  enterBtn.disabled = false;
  enterBtn.textContent = prevLabel || 'ENTER IBADAN';
}

function submitSetup() {
  const name = (document.getElementById('setup-name') as HTMLInputElement).value.trim() || 'Player';
  const skin = parseInt((document.getElementById('setup-skin') as HTMLInputElement).value) || 0;
  const outfit = (document.getElementById('setup-outfit') as HTMLInputElement).value || 'default';
  const hair = parseInt((document.getElementById('setup-hair') as HTMLSelectElement).value) || 0;
  game.createProfile(name, skin, outfit, hair);
  setupScreen.classList.add('hidden');
  startGame();
}

enterBtn.onclick = tryEnter;

document.getElementById('setup-start')!.onclick = submitSetup;

function startGame() {
  if (game.running) return;
  loadingScreen.classList.add('hidden');
  setupScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  game.ui.showHUD(true);
  game.ui.setConnState(game.net.state);
  game.start();
  game.ui.toast('Welcome to Ibadan! 🇳🇬', 'good');
  setTimeout(() => game.ui.toast('Use the joystick / WASD to move. Find a job, buy food, explore!', ''), 1800);

  // Broadcast player state ~8 times per second
  setInterval(() => game.broadcastState(), 125);
}

// ------------------------------------------------------------
// Global Enter key handler — the core fix.
// Works on the loading screen (enter) and the setup screen (submit).
// ------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.keyCode !== 13) return;
  if (game.running) return; // already in-game; Enter is not an entry action

  // On the setup screen, Enter confirms the character and starts the game.
  if (!isHidden(setupScreen)) {
    e.preventDefault();
    submitSetup();
    return;
  }

  // On the loading screen, Enter is the same as tapping "Enter".
  if (!isHidden(loadingScreen)) {
    e.preventDefault();
    tryEnter();
  }
});

// Also allow Enter inside the setup name field to submit the form.
document.getElementById('setup-name')?.addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') {
    e.preventDefault();
    submitSetup();
  }
});

// Auto-exit interior when standing on the exit trigger
setInterval(() => {
  if (!game.inInterior || !game.profile) return;
  const room = game.interiors.get(game.currentInterior!);
  if (!room) return;
  const d = game.player.position.distanceTo(room.exit);
  if (d < 2.2) game.exitInterior();
}, 300);

// Prevent context menu / double-tap zoom during play
document.addEventListener('contextmenu', (e) => { if (game.running) e.preventDefault(); });
document.addEventListener('gesturestart', (e) => e.preventDefault());
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300) e.preventDefault();
  lastTouch = now;
}, { passive: false });

boot();
