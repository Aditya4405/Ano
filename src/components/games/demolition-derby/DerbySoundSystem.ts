/**
 * Ano Demolition Derby — Web Audio Sound Generator
 * Generates procedural audio for V8 engine revs, tire screeches,
 * heavy metal impact collisions, explosions, countdown beeps, and UI clicks.
 */
class DerbySoundSystem {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private isMuted: boolean = false;
  private engineRunning: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.engineGain) {
      this.engineGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    }
  }

  public startEngineSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || this.engineRunning) return;

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(65, this.ctx.currentTime); // Idle RPM

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      this.engineOsc.start();
      this.engineRunning = true;
    } catch (e) {
      // AudioContext autostart restrictions handled on click
    }
  }

  public updateEngineSound(speedRatio: number) {
    if (this.isMuted || !this.engineOsc || !this.ctx || !this.engineRunning) return;
    const clampedSpeed = Math.min(1, Math.max(0, speedRatio));
    const targetFreq = 60 + clampedSpeed * 220; // 60Hz idle -> 280Hz top speed
    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);

    if (this.engineGain) {
      const targetGain = 0.06 + clampedSpeed * 0.08;
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
    }
  }

  public stopEngineSound() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch (e) {}
      this.engineOsc = null;
    }
    this.engineRunning = false;
  }

  public playTireScreech() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * 0.2; // 200ms
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      filter.Q.setValueAtTime(4, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.07, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch (e) {}
  }

  public playImpact(severity: 'NORMAL' | 'HEAVY' | 'CRITICAL') {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // 1. Metal Clang Oscillator
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      const baseFreq = severity === 'CRITICAL' ? 120 : severity === 'HEAVY' ? 160 : 220;

      osc.type = 'square';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(severity === 'CRITICAL' ? 1200 : 800, now);

      const vol = severity === 'CRITICAL' ? 0.35 : severity === 'HEAVY' ? 0.25 : 0.15;
      oscGain.gain.setValueAtTime(vol, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + (severity === 'CRITICAL' ? 0.4 : 0.25));

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);

      // 2. Heavy Crunch Noise
      const bufferSize = this.ctx.sampleRate * 0.25;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(vol * 0.8, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      noise.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
    } catch (e) {}
  }

  public playExplosion() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const duration = 0.8;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(50, now + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
    } catch (e) {}
  }

  public playCountdownBeep(isGo: boolean = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isGo ? 880 : 440, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.4 : 0.2));

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + (isGo ? 0.4 : 0.2));
    } catch (e) {}
  }

  public playClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }

  public playFanfare(victory: boolean = true) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = victory ? [523.25, 659.25, 783.99, 1046.50] : [400, 350, 300, 250];

      notes.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = victory ? 'triangle' : 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);

        gain.gain.setValueAtTime(0.2, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.3);
      });
    } catch (e) {}
  }
}

export const derbySoundSystem = new DerbySoundSystem();
