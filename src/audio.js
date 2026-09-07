/**
 * Royal Game of Ur - Procedural Audio Engine
 * Produces ultra-satisfying, crunchy dice roll sounds using Web Audio API.
 * No external audio files needed; zero latency, offline ready.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime);

      // Warm lowpass filter to remove high-pitched ringing and produce a rich, dull earthy acoustic
      this.warmthFilter = this.ctx.createBiquadFilter();
      this.warmthFilter.type = 'lowpass';
      this.warmthFilter.frequency.setValueAtTime(1800, this.ctx.currentTime);
      this.warmthFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

      this.masterGain.connect(this.warmthFilter);
      this.warmthFilter.connect(this.ctx.destination);

      this.createNoiseBuffer();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not supported or failed to initialize:', e);
    }
  }

  createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Pinkish/velvet noise distribution for warmer crunch
      data[i] = (Math.random() * 2 - 1) * 0.8;
    }
    this.noiseBuffer = buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.85, this.ctx.currentTime);
    }
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Plays a single crunchy click/clack (used for dice-to-floor and dice-to-dice collisions) - warm, dull bone/wood clack
   */
  playDieImpact(velocity = 0.5, pan = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const t = this.ctx.currentTime;
    const vol = Math.min(Math.max(velocity, 0.1), 1.0);

    // 1. Mellow stone/wood tap (520 - 980Hz, dropping to 180Hz)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    const baseFreq = 520 + Math.random() * 460;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.35, t + 0.035);

    oscGain.gain.setValueAtTime(vol * 0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    // 2. Dull gritty crunch (warm bandpass filtered noise at 950 - 1500Hz)
    let noiseSource = null;
    let noiseGain = null;
    if (this.noiseBuffer) {
      noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;
      noiseSource.loop = true;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1050 + Math.random() * 450, t);
      noiseFilter.Q.setValueAtTime(2.2, t);

      noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(vol * 0.55, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
    }

    // 3. Resonant wooden tray body thud (125Hz -> 38Hz)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(125 + Math.random() * 30, t);
    subOsc.frequency.exponentialRampToValueAtTime(38, t + 0.045);

    subGain.gain.setValueAtTime(vol * 0.38, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    // Stereo Panner
    let panner = null;
    if (this.ctx.createStereoPanner) {
      panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.8, Math.min(0.8, pan)), t);
    }

    // Routing
    const dest = panner || this.masterGain;
    osc.connect(oscGain);
    oscGain.connect(dest);

    if (noiseSource && noiseGain) {
      noiseGain.connect(dest);
      noiseSource.start(t);
      noiseSource.stop(t + 0.04);
    }

    subOsc.connect(subGain);
    subGain.connect(dest);

    if (panner) panner.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.04);
    subOsc.start(t);
    subOsc.stop(t + 0.05);
  }

  /**
   * Generates a full, rich, multi-stage crunchy dice roll sequence.
   * Features:
   * - Cup rattle / agitation
   * - Crisp scatter & bouncing clatters
   * - Distinct bone/wood grit crunch
   * - Decaying settling impacts
   */
  playCrunchyRoll(durationMs = 1200) {
    if (this.muted) return;
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const startTime = this.ctx.currentTime;
    const durSec = durationMs / 1000;

    // Trigger haptic vibration if supported (mobile feel)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([18, 30, 22, 25, 15, 20, 10, 40]);
      } catch (_) {}
    }

    // A. Tumbling friction / crunch bed (textured noise sliding over felt/wood)
    if (this.noiseBuffer) {
      const crunchSource = this.ctx.createBufferSource();
      crunchSource.buffer = this.noiseBuffer;
      crunchSource.loop = true;

      const filter1 = this.ctx.createBiquadFilter();
      filter1.type = 'bandpass';
      filter1.frequency.setValueAtTime(1250, startTime);
      filter1.frequency.exponentialRampToValueAtTime(650, startTime + durSec * 0.85);
      filter1.Q.setValueAtTime(1.8, startTime);

      const crunchGain = this.ctx.createGain();
      crunchGain.gain.setValueAtTime(0.001, startTime);
      // Fast swell at launch
      crunchGain.gain.linearRampToValueAtTime(0.38, startTime + 0.06);
      // Rattle modulation
      for (let i = 1; i < 7; i++) {
        const timePoint = startTime + (durSec * 0.1) + (i * durSec * 0.12);
        const gainVal = 0.2 + (Math.random() * 0.2);
        crunchGain.gain.setValueAtTime(gainVal, timePoint);
      }
      // Decay out
      crunchGain.gain.exponentialRampToValueAtTime(0.001, startTime + durSec * 0.9);

      crunchSource.connect(filter1);
      filter1.connect(crunchGain);
      crunchGain.connect(this.masterGain);

      crunchSource.start(startTime);
      crunchSource.stop(startTime + durSec);
    }

    // B. Micro-impact cascades (14 to 20 individual dice collisions)
    const numImpacts = 20 + Math.floor(Math.random() * 6);
    for (let i = 0; i < numImpacts; i++) {
      const progress = Math.pow(i / numImpacts, 1.55);
      const impactTime = startTime + (progress * durSec * 0.85) + (Math.random() * 0.015);

      const energy = (1 - (i / numImpacts) * 0.72) * (0.6 + Math.random() * 0.4);
      const pan = (Math.random() * 1.4) - 0.7;

      this.scheduleSingleImpact(impactTime, energy, pan);
    }

    // C. Final crisp settling clacks
    const settle1 = startTime + durSec * 0.80 + Math.random() * 0.04;
    const settle2 = startTime + durSec * 0.93 + Math.random() * 0.04;
    this.scheduleSingleImpact(settle1, 0.45, -0.2);
    this.scheduleSingleImpact(settle2, 0.35, 0.25);
  }

  scheduleSingleImpact(time, volume, pan) {
    if (!this.ctx) return;

    // 1. Hard contact click (triangular osc)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    const freq = 480 + Math.random() * 450;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.35, time + 0.03);

    oscGain.gain.setValueAtTime(volume * 0.42, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    // 2. Bone grit noise snap
    let noiseSource = null;
    let noiseGain = null;
    if (this.noiseBuffer) {
      noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000 + Math.random() * 450, time);
      filter.Q.setValueAtTime(2.0, time);

      noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(volume * 0.48, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.026);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
    }

    // 3. Wooden tray resonance
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(115 + Math.random() * 25, time);
    sub.frequency.exponentialRampToValueAtTime(40, time + 0.038);

    subGain.gain.setValueAtTime(volume * 0.32, time);
    subGain.gain.exponentialRampToValueAtTime(0.001, time + 0.038);

    subGain.gain.setValueAtTime(volume * 0.25, time);
    subGain.gain.exponentialRampToValueAtTime(0.001, time + 0.038);

    // Panner
    let panner = null;
    if (this.ctx.createStereoPanner) {
      panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, time);
    }

    const dest = panner || this.masterGain;
    osc.connect(oscGain);
    oscGain.connect(dest);

    if (noiseSource && noiseGain) {
      noiseGain.connect(dest);
      noiseSource.start(time);
      noiseSource.stop(time + 0.03);
    }

    sub.connect(subGain);
    subGain.connect(dest);

    if (panner) panner.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.03);
    sub.start(time);
    sub.stop(time + 0.04);
  }
}

export const soundEngine = new SoundEngine();
