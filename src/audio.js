// Every sound here is synthesized with the Web Audio API — there are no audio
// files to fetch, so the game stays dependency-free and works fully offline.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.reversePlaying = false;
    this.reverseBeepTimer = null;
    this.birdTimer = null;
  }

  get ready() {
    return !!this.ctx;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(this.ctx.destination);

    this._buildEngine();
    this._buildWind();
    this._scheduleBird();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  // ---------- Engine hum, tied to speed/throttle every frame ----------
  _buildEngine() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;

    const sub = ctx.createOscillator();
    sub.type = 'sawtooth';
    sub.frequency.value = 27.5;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    sub.start();

    this.engineOsc = osc;
    this.engineSub = sub;
    this.engineFilter = filter;
    this.engineGain = gain;
  }

  updateEngine(speed, throttle) {
    if (!this.ctx) return;
    const absSpeed = Math.abs(speed);
    const revving = Math.abs(throttle) > 0.05 ? 1 : 0;
    const targetFreq = 50 + absSpeed * 4.2 + revving * 18;
    const targetGain = 0.05 + Math.min(absSpeed / 30, 1) * 0.1 + revving * 0.025;
    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.1);
    this.engineSub.frequency.setTargetAtTime(targetFreq / 2, now, 0.1);
    this.engineFilter.frequency.setTargetAtTime(350 + absSpeed * 22, now, 0.15);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.12);
  }

  // ---------- Reverse warning beep ----------
  setReversing(reversing) {
    if (!this.ctx) return;
    if (reversing && !this.reversePlaying) {
      this.reversePlaying = true;
      this._scheduleReverseBeep();
    } else if (!reversing && this.reversePlaying) {
      this.reversePlaying = false;
      if (this.reverseBeepTimer) clearTimeout(this.reverseBeepTimer);
    }
  }

  _scheduleReverseBeep() {
    if (!this.reversePlaying) return;
    this._blip(920, 0.09, 0.1);
    this.reverseBeepTimer = setTimeout(() => this._scheduleReverseBeep(), 430);
  }

  _blip(freq, duration, gainAmt) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gainAmt, ctx.currentTime + 0.01);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  // ---------- Collision thump ----------
  playCollision() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);

    this._noiseBurst(0.15, 0.3, 700);
  }

  // ---------- Shared noise helpers ----------
  _noiseBuffer(duration) {
    const ctx = this.ctx;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _noiseBurst(duration, gainAmt, filterFreq = 800) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainAmt, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }

  // ---------- Ambient nature: wind pad + randomized bird chirps ----------
  _buildWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(4);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 480;
    filter.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0.02;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  _scheduleBird() {
    const delay = 1600 + Math.random() * 3800;
    this.birdTimer = setTimeout(() => {
      this._chirp();
      this._scheduleBird();
    }, delay);
  }

  _chirp() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const notes = 2 + Math.floor(Math.random() * 3);
    let t = ctx.currentTime;
    for (let i = 0; i < notes; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const baseFreq = 2100 + Math.random() * 1500;
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.012);
      g.gain.linearRampToValueAtTime(0, t + 0.09);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.1);
      t += 0.11 + Math.random() * 0.06;
    }
  }
}
