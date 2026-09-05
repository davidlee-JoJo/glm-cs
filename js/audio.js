export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _out(dist = 0, gain = 1) {
    if (!this.ctx) return null;
    const g = this.ctx.createGain();
    const att = gain / (1 + dist * 0.085);
    g.gain.value = att;
    g.connect(this.master);
    return g;
  }

  _noise(dur, opts = {}) {
    const out = this._out(opts.dist || 0, opts.gain ?? 0.5);
    if (!out) return;
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = opts.type || 'lowpass';
    filt.frequency.value = opts.freq || 2000;
    filt.Q.value = opts.q || 0.8;
    const env = ctx.createGain();
    const t = ctx.currentTime;
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt); filt.connect(env); env.connect(out);
    src.start(t);
  }

  _tone(freq, dur, opts = {}) {
    const out = this._out(opts.dist || 0, opts.gain ?? 0.3);
    if (!out) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, ctx.currentTime + dur);
    const env = ctx.createGain();
    const t = ctx.currentTime;
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env); env.connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  shot(kind, dist = 0) {
    if (!this.ctx) return;
    if (kind === 'rifle') {
      this._noise(0.14, { freq: 2400, gain: 0.85, dist });
      this._tone(150, 0.06, { type: 'square', gain: 0.35, dist, slideTo: 60 });
    } else if (kind === 'pistol') {
      this._noise(0.09, { freq: 3200, gain: 0.6, dist });
      this._tone(220, 0.04, { type: 'square', gain: 0.25, dist, slideTo: 90 });
    } else if (kind === 'awp') {
      this._noise(0.3, { freq: 1500, gain: 1.0, dist });
      this._tone(90, 0.18, { type: 'square', gain: 0.5, dist, slideTo: 40 });
    } else if (kind === 'knife') {
      this._noise(0.07, { type: 'bandpass', freq: 1400, q: 2, gain: 0.35, dist });
    }
  }

  step(dist = 0) {
    this._noise(0.05, { type: 'bandpass', freq: 700 + Math.random() * 300, q: 1.5, gain: 0.16, dist });
  }

  reload() {
    if (!this.ctx) return;
    this._tone(1300, 0.03, { gain: 0.2 });
    setTimeout(() => this._tone(900, 0.04, { gain: 0.2 }), 220);
    setTimeout(() => this._tone(1600, 0.03, { gain: 0.22 }), 440);
  }

  empty() { this._tone(2200, 0.03, { gain: 0.18 }); }
  buy() { this._tone(1150, 0.07, { gain: 0.2 }); this._tone(1500, 0.07, { gain: 0.15 }); }
  hit(head) { this._tone(head ? 3000 : 2100, 0.05, { gain: 0.25, type: 'sine' }); }
  kill() { this._tone(880, 0.08, { gain: 0.22, type: 'sine', slideTo: 1320 }); }
  damage() {
    this._noise(0.12, { freq: 500, gain: 0.4 });
    this._tone(180, 0.1, { type: 'sawtooth', gain: 0.2, slideTo: 90 });
  }
  bounce(dist = 0) { this._tone(320, 0.05, { gain: 0.2, dist, slideTo: 180 }); }
  plantBeep() { this._tone(1650, 0.07, { gain: 0.25, type: 'sine' }); }
  bombBeep(dist = 0) { this._tone(1900, 0.06, { gain: 0.4, type: 'sine', dist }); }
  defuseTick() { this._tone(1000, 0.03, { gain: 0.15 }); }

  explosion(dist = 0) {
    this._noise(0.9, { freq: 380, gain: 1.3, dist });
    this._tone(60, 0.5, { type: 'sine', gain: 0.8, dist, slideTo: 30 });
  }

  roundStart() {
    this._tone(440, 0.12, { type: 'sine', gain: 0.25 });
    setTimeout(() => this._tone(660, 0.15, { type: 'sine', gain: 0.25 }), 140);
  }
  win() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.18, { type: 'sine', gain: 0.25 }), i * 130));
  }
  lose() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, { type: 'sine', gain: 0.25 }), i * 160));
  }
}
