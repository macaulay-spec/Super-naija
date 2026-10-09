import { Game } from './core/Game';

// ============================================================
// IBADAN LIFE — entry point
// ============================================================

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const loadFill = document.getElementById('load-fill')!;
const loadStatus = document.getElementById('load-status')!;
const enterBtn = document.getElementById('enter-btn') as HTMLButtonElement;
const loadingScreen = document.getElementById('loading-screen')!;
const setupScreen = document.getElementById('setup-screen')!;
const hud = document.getElementById('hud')!;

const game = new Game(canvas);
(window as any).game = game; // debug

let ready = false;

async function boot() {
  try {
    await game.init((pct, label) => {
      loadFill.style.width = pct + '%';
      loadStatus.textContent = label;
    });
    ready = true;
    loadStatus.textContent = 'Tap to enter';
    enterBtn.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    loadStatus.textContent = 'Failed to start: ' + (err as Error).message;
    loadStatus.style.color = '#d64545';
  }
}

enterBtn.onclick = () => {
  if (!ready) return;
  game.audio.init();
  game.audio.resume();
  // Resume / create profile
  const hasSave = game.loadProfile();
  if (hasSave) {
    startGame();
  } else {
    loadingScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
  }
};

document.getElementById('setup-start')!.onclick = () => {
  const name = (document.getElementById('setup-name') as HTMLInputElement).value.trim() || 'Player';
  const skin = parseInt((document.getElementById('setup-skin') as HTMLInputElement).value);
  const outfit = (document.getElementById('setup-outfit') as HTMLInputElement).value;
  const hair = parseInt((document.getElementById('setup-hair') as HTMLSelectElement).value);
  game.createProfile(name, skin, outfit, hair);
  setupScreen.classList.add('hidden');
  startGame();
};

function startGame() {
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
