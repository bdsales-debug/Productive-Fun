import { Vector3 } from 'three';

/**
 * Temple ambience synthesised with Web Audio: wind through the galleries, distant water,
 * an occasional far-off bell, and the sounds of the things you can touch.
 */
export class Ambience {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private wind!: GainNode;
  private windFilter!: BiquadFilterNode;
  private water!: GainNode;
  private noise!: AudioBuffer;
  enabled = false;
  private nextBell = 40;

  private init() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    const len = ctx.sampleRate * 3;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.985 * b + 0.015 * w; d[i] = w * 0.5 + b * 4; }

    const src = (rate = 1) => { const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 0.7;
    this.wind = ctx.createGain();
    this.wind.gain.value = 0.12;
    src(0.6).connect(this.windFilter).connect(this.wind).connect(this.master);

    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
    this.water = ctx.createGain();
    this.water.gain.value = 0.02;
    src(1).connect(lp).connect(hp).connect(this.water).connect(this.master);
    return ctx;
  }

  async setEnabled(on: boolean) {
    const ctx = this.init();
    if (!ctx) return false;
    this.enabled = on;
    if (on && ctx.state !== 'running') await ctx.resume().catch(() => undefined);
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.6);
    return true;
  }

  update(t: number, cam: Vector3) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const now = ctx.currentTime;
    // wind grows with height and near the open south side
    const gust = 0.5 + 0.5 * Math.sin(t * 0.13) * Math.sin(t * 0.071 + 2);
    const height = Math.min(1, Math.max(0, cam.y / 14));
    const outside = cam.z > 12 ? 1 : Math.max(0, (cam.z - 4) / 8) * 0.6;
    this.wind.gain.setTargetAtTime(0.05 + 0.1 * gust + 0.08 * height + 0.07 * outside, now, 0.8);
    this.windFilter.frequency.setTargetAtTime(320 + gust * 360 + height * 200, now, 1.2);
    const toGarden = Math.max(0, 1 - Math.hypot(cam.x + 6, cam.z - 22) / 30);
    this.water.gain.setTargetAtTime(0.012 + toGarden * 0.06, now, 0.8);
    if (t > this.nextBell) {
      this.nextBell = t + 60 + Math.random() * 50;
      this.bell(0.12, 0.55);
    }
  }

  private env(g: GainNode, t0: number, peak: number, decay: number, attack = 0.004) {
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  }

  /** A large bronze bell: inharmonic partials, a long hum and a slow beat. */
  bell(level = 0.5, bright = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime + 0.02;
    const bus = ctx.createGain(); bus.gain.value = level;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 + 2600 * bright;
    bus.connect(lp).connect(this.master);
    const f = 78;
    const partials: [number, number, number][] = [[0.5, 0.5, 14], [1, 0.8, 11], [1.007, 0.6, 11], [1.69, 0.45, 7], [2.04, 0.3, 5.5], [2.74, 0.28, 4], [3.36, 0.16, 3], [4.21, 0.1, 2.2], [5.4, 0.06, 1.4]];
    for (const [r, a, dec] of partials) {
      const o = ctx.createOscillator(); o.frequency.value = f * r;
      const g = ctx.createGain(); this.env(g, t0, a, t0 + dec);
      o.connect(g).connect(bus); o.start(t0); o.stop(t0 + dec + 0.1);
    }
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1.4;
    const ng = ctx.createGain(); this.env(ng, t0, 0.5 * bright, t0 + 0.25);
    n.connect(bp).connect(ng).connect(bus); n.start(t0); n.stop(t0 + 0.3);
  }

  drum() {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(92, t0);
    o.frequency.exponentialRampToValueAtTime(52, t0 + 0.5);
    const g = ctx.createGain(); this.env(g, t0, 0.9, t0 + 1.4, 0.003);
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + 1.5);
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const ng = ctx.createGain(); this.env(ng, t0, 0.5, t0 + 0.35, 0.002);
    n.connect(lp).connect(ng).connect(this.master); n.start(t0); n.stop(t0 + 0.4);
  }

  /** The low rumble of the sutra wheel turning on its pivot. */
  wheel() {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime + 0.01;
    const n = ctx.createBufferSource(); n.buffer = this.noise; n.playbackRate.value = 0.4;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.5, t0 + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.2);
    n.connect(lp).connect(g).connect(this.master); n.start(t0); n.stop(t0 + 3.3);
  }

  /** Paper screens sliding in their wooden tracks. */
  slide() {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t0 = ctx.currentTime + 0.01;
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.07, t0 + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    n.connect(bp).connect(g).connect(this.master); n.start(t0); n.stop(t0 + 1);
  }

  dispose() { this.ctx?.close().catch(() => undefined); this.ctx = null; }
}
