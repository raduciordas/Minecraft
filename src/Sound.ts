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

  swing(): void {
    this.noise(0.12, 2600, 0.12, 500);
  }

  hitMob(): void {
    this.noise(0.08, 500, 0.3);
    this.tone(140, 0.1, 'triangle', 0.2, 90);
  }

  mobDeath(): void {
    this.tone(300, 0.4, 'square', 0.22, 60);
  }

  teleport(): void {
    this.tone(200, 0.18, 'sine', 0.18, 900);
  }

  fireballCast(): void {
    this.tone(180, 0.3, 'sawtooth', 0.22, 500);
    this.noise(0.35, 2000, 0.15, 600);
  }

  fireballImpact(): void {
    this.noise(0.25, 800, 0.3, 150);
    this.tone(120, 0.2, 'square', 0.2, 60);
  }

  throwBottle(): void {
    this.tone(400, 0.15, 'sine', 0.16, 700);
  }

  explosion(): void {
    this.noise(0.5, 1600, 0.35, 90);
    this.tone(80, 0.5, 'sawtooth', 0.3, 30);
  }

  doorToggle(): void {
    this.noise(0.18, 500, 0.16, 250);
  }

  mob(kind: MobKind): void {
    if (kind === 'pig') {
      this.tone(230 + Math.random() * 40, 0.09, 'square', 0.16);
      setTimeout(() => this.tone(190, 0.12, 'square', 0.14), 110);
    } else if (kind === 'sheep') {
      this.tone(470 + Math.random() * 60, 0.14, 'sawtooth', 0.12, 420);
      setTimeout(() => this.tone(430, 0.28, 'sawtooth', 0.12, 380), 150);
    } else if (kind === 'wasp') {
      // Angry buzz
      this.tone(160 + Math.random() * 30, 0.5, 'sawtooth', 0.08, 190);
    } else if (kind === 'golem') {
      // Deep stone rumble
      this.tone(55 + Math.random() * 10, 0.7, 'triangle', 0.28, 40);
      this.noise(0.5, 160, 0.2);
    } else if (kind === 'shadow') {
      // Eerie whisper: descending airy hiss
      this.noise(0.6, 3000, 0.07, 400);
      this.tone(600, 0.5, 'sine', 0.05, 200);
    } else if (kind === 'zmeu') {
      // Dragon roar: harsh descending growl
      this.tone(90 + Math.random() * 20, 0.6, 'sawtooth', 0.22, 45);
      this.noise(0.3, 1200, 0.1);
    } else if (kind === 'capcaun') {
      // Giant's guttural bellow
      this.tone(70, 0.5, 'square', 0.26, 40);
      this.noise(0.3, 300, 0.12);
    } else {
      // Zombie groan: low descending wobble
      this.tone(110 + Math.random() * 30, 0.55, 'sawtooth', 0.16, 65);
    }
  }
}
