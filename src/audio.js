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
    this.musicGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicNextTime = 0;
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
    this._startMusic();
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

  // ---------- Background chiptune soundtrack ----------
  // A tiny step sequencer (bass + arpeggiated lead + kick/hat) scheduled with
  // the standard "lookahead" pattern so timing stays tight regardless of
  // setInterval jitter. Routed through its own gain into the master bus, so
  // the existing mute toggle silences it along with everything else.
  _startMusic() {
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);

    this.musicBpm = 126;
    this.musicStepDur = 60 / this.musicBpm / 4; // 16th notes
    this.musicRoot = 130.81; // C3
    this.musicBass = [0, null, null, null, 7, null, null, null, 9, null, null, null, 5, null, 7, null];
    this.musicLead = [
      12, null, 16, null, 19, 16, 12, null,
      14, null, 17, null, 21, 17, 14, null,
      12, null, 16, null, 19, 16, 12, 16,
      11, null, 15, null, 19, 15, 12, null,
    ];
    this.musicStep = 0;
    this.musicNextTime = this.ctx.currentTime + 0.15;
    this.musicTimer = setInterval(() => this._scheduleMusicSteps(), 100);
  }

  _scheduleMusicSteps() {
    const lookahead = 0.25;
    while (this.musicNextTime < this.ctx.currentTime + lookahead) {
      this._playMusicStep(this.musicStep, this.musicNextTime);
      this.musicNextTime += this.musicStepDur;
      this.musicStep = (this.musicStep + 1) % this.musicLead.length;
    }
  }

  _playMusicStep(step, time) {
    const bassNote = this.musicBass[step % this.musicBass.length];
    if (bassNote !== null) {
      this._musicTone(this.musicRoot * Math.pow(2, bassNote / 12), time, this.musicStepDur * 3.4, 'triangle', 0.45);
    }
    const leadNote = this.musicLead[step];
    if (leadNote !== null) {
      this._musicTone(this.musicRoot * 2 * Math.pow(2, leadNote / 12), time, this.musicStepDur * 0.85, 'square', 0.16);
    }
    if (step % 4 === 0) this._musicKick(time);
    if (step % 4 === 2) this._musicHat(time);
  }

  _musicTone(freq, time, dur, type, gainAmt) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gainAmt, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  _musicKick(time) {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.11);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  _musicHat(time) {
    const dur = 0.035;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.1, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain);
    src.start(time);
  }
}
