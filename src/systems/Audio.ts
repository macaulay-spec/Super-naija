// ============================================================
// Audio — fully procedural WebAudio (no asset downloads)
// ============================================================

export class AudioSys {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  enabled = true;

  init() {
    if (this.ctx) return;
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
    } catch { this.enabled = false; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  private startAmbient() {
    if (!this.ctx || !this.master) return;
    // Low city hum
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer; noise.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 320;
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.06;
    noise.connect(filter); filter.connect(this.ambientGain); this.ambientGain.connect(this.master);
    noise.start();
  }

  private blip(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2) {
    if (!this.ctx || !this.master || !this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  footstep() { this.blip(120 + Math.random() * 40, 0.06, 'triangle', 0.08); }
  uiClick() { this.blip(660, 0.05, 'square', 0.06); }
  cash() { this.blip(880, 0.08, 'sine', 0.15); setTimeout(() => this.blip(1320, 0.12, 'sine', 0.12), 60); }
  success() { this.blip(523, 0.1, 'sine', 0.15); setTimeout(() => this.blip(784, 0.18, 'sine', 0.15), 90); }
  error() { this.blip(180, 0.2, 'sawtooth', 0.12); }
  horn() { this.blip(420, 0.25, 'square', 0.12); this.blip(560, 0.25, 'square', 0.1); }

  startEngine() {
    if (!this.ctx || !this.master || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    this.engineGain.gain.value = 0.0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 400;
    this.engineOsc.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speed: number) {
    if (!this.engineOsc || !this.engineGain || !this.ctx) return;
    this.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 4, this.ctx.currentTime, 0.1);
    this.engineGain.gain.setTargetAtTime(Math.min(0.12, 0.03 + Math.abs(speed) * 0.006), this.ctx.currentTime, 0.1);
  }

  stopEngine() {
    if (this.engineGain && this.ctx) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    if (this.engineOsc) { try { this.engineOsc.stop(this.ctx!.currentTime + 0.3); } catch {} this.engineOsc = null; }
    this.engineGain = null;
  }

  setMasterVolume(v: number) { if (this.master) this.master.gain.value = v; }
}
