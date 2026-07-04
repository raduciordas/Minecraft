import type { MobKind } from './mobs/Mob';

// All sound effects are synthesized with Web Audio — no audio files.
export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  // Must be called from a user gesture (autoplay policy)
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.32;
        this.master.connect(this.ctx.destination);
      } catch {
        return; // no audio support — game runs silent
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    volume = 0.2,
    slideTo?: number,
  ): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, filterFreq: number, volume = 0.2, filterSlideTo?: number): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const length = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    if (filterSlideTo !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterSlideTo), t0 + duration);
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  step(): void {
    this.noise(0.07, 700 + Math.random() * 500, 0.1);
  }

  breakBlock(): void {
    this.noise(0.14, 900, 0.28, 250);
    this.tone(90, 0.08, 'triangle', 0.15);
  }

  place(): void {
    this.tone(170 + Math.random() * 50, 0.09, 'triangle', 0.22);
  }

  splash(): void {
    this.noise(0.4, 1400, 0.3, 250);
  }

  land(hard: boolean): void {
    this.noise(0.12, 320, hard ? 0.35 : 0.14);
  }

  hurt(): void {
    this.tone(320, 0.22, 'sawtooth', 0.28, 160);
  }

  death(): void {
    this.tone(240, 1.1, 'sawtooth', 0.3, 55);
  }

  mob(kind: MobKind): void {
    if (kind === 'pig') {
      this.tone(230 + Math.random() * 40, 0.09, 'square', 0.16);
      setTimeout(() => this.tone(190, 0.12, 'square', 0.14), 110);
    } else if (kind === 'sheep') {
      this.tone(470 + Math.random() * 60, 0.14, 'sawtooth', 0.12, 420);
      setTimeout(() => this.tone(430, 0.28, 'sawtooth', 0.12, 380), 150);
    } else {
      // Zombie groan: low descending wobble
      this.tone(110 + Math.random() * 30, 0.55, 'sawtooth', 0.16, 65);
    }
  }
}
