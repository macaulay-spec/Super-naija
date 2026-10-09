// ============================================================
// Input — keyboard, mouse, and touch (virtual joystick)
// ============================================================

export interface InputState {
  moveX: number;      // -1..1 strafe
  moveY: number;      // -1..1 forward
  lookX: number;      // camera yaw delta
  lookY: number;      // camera pitch delta
  sprint: boolean;
  jump: boolean;
  interact: boolean;
  brake: boolean;
}

export class Input {
  state: InputState = {
    moveX: 0, moveY: 0, lookX: 0, lookY: 0,
    sprint: false, jump: false, interact: false, brake: false,
  };

  private keys: Record<string, boolean> = {};
  private isTouch = false;
  private joyActive = false;
  private joyId = -1;
  private joyCenter = { x: 0, y: 0 };
  private joyVec = { x: 0, y: 0 };
  private lookId = -1;
  private lastLook = { x: 0, y: 0 };
  private accumLook = { x: 0, y: 0 };

  onInteract?: () => void;
  onKey?: (key: string) => void;

  constructor(private canvas: HTMLCanvasElement) {
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.bindKeyboard();
    this.bindMouse();
    this.bindTouch();
  }

  get usingTouch() { return this.isTouch; }

  private bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (this.keys[k]) return;
      this.keys[k] = true;
      if (k === 'e') { this.onInteract?.(); }
      this.onKey?.(k);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  }

  private bindMouse() {
    let dragging = false;
    this.canvas.addEventListener('mousedown', (e) => { if (e.button === 0) dragging = true; });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      this.accumLook.x += e.movementX || 0;
      this.accumLook.y += e.movementY || 0;
    });
    // Pointer lock on click for desktop feel
    this.canvas.addEventListener('click', () => {
      if (!this.isTouch && document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock?.();
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.accumLook.x += e.movementX || 0;
        this.accumLook.y += e.movementY || 0;
      }
    });
  }

  private bindTouch() {
    const joyZone = document.getElementById('joystick-zone');
    const base = document.getElementById('joystick-base');
    const knob = document.getElementById('joystick-knob');

    const onStart = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
        const inJoy = joyZone && (joyZone.contains(el) || el === joyZone);
        const inBtn = el && el.closest && el.closest('#action-buttons, #drive-controls, .hud-actions, .modal, .chat-input-wrap');
        if (inJoy && !this.joyActive) {
          this.joyActive = true; this.joyId = t.identifier;
          const rect = (base as HTMLElement).getBoundingClientRect();
          this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          this.updateJoy(t.clientX, t.clientY, knob);
        } else if (!inBtn && this.lookId === -1) {
          this.lookId = t.identifier;
          this.lastLook = { x: t.clientX, y: t.clientY };
        }
      }
      if (e.cancelable) e.preventDefault();
    };

    const onMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joyId) this.updateJoy(t.clientX, t.clientY, knob);
        else if (t.identifier === this.lookId) {
          this.accumLook.x += (t.clientX - this.lastLook.x) * 1.6;
          this.accumLook.y += (t.clientY - this.lastLook.y) * 1.6;
          this.lastLook = { x: t.clientX, y: t.clientY };
        }
      }
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.joyId) {
          this.joyActive = false; this.joyId = -1; this.joyVec = { x: 0, y: 0 };
          if (knob) knob.style.transform = 'translate(-50%,-50%)';
        } else if (t.identifier === this.lookId) {
          this.lookId = -1;
        }
      }
    };

    window.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: false });
    window.addEventListener('touchcancel', onEnd, { passive: false });
  }

  private updateJoy(cx: number, cy: number, knob: HTMLElement | null) {
    const max = 55;
    let dx = cx - this.joyCenter.x;
    let dy = cy - this.joyCenter.y;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    this.joyVec = { x: dx / max, y: dy / max };
    if (knob) knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  // Called once per frame by the game loop
  update() {
    const s = this.state;
    // Keyboard movement
    let kx = 0, ky = 0;
    if (this.keys['a'] || this.keys['arrowleft']) kx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) kx += 1;
    if (this.keys['w'] || this.keys['arrowup']) ky -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) ky += 1;

    if (this.joyActive) {
      s.moveX = this.joyVec.x;
      s.moveY = this.joyVec.y;
    } else {
      s.moveX = kx;
      s.moveY = ky;
    }

    s.sprint = !!this.keys['shift'];
    s.jump = !!this.keys[' '];
    s.brake = !!this.keys[' '];

    // Consume accumulated look
    s.lookX = this.accumLook.x;
    s.lookY = this.accumLook.y;
    this.accumLook.x = 0; this.accumLook.y = 0;
  }

  // Button helpers for mobile UI
  setVirtual(btn: 'jump' | 'sprint' | 'brake', down: boolean) {
    if (btn === 'jump') this.state.jump = down;
    if (btn === 'sprint') this.state.sprint = down;
    if (btn === 'brake') this.state.brake = down;
  }
}
