import type { StatusEffectDef } from '../items/Consumable';

// Short-lived bonuses from food: a burst of speed, faster healing. Each kind
// keeps only its strongest current value; eating again extends the timer.
export class StatusEffects {
  private speedTimer = 0;
  private speedFactor = 1;
  private regenTimer = 0;
  private regenFactor = 1;

  apply(effect: StatusEffectDef): void {
    if (effect.kind === 'speed') {
      this.speedTimer = Math.max(this.speedTimer, effect.seconds);
      this.speedFactor = Math.max(this.speedFactor, effect.factor);
    } else {
      this.regenTimer = Math.max(this.regenTimer, effect.seconds);
      this.regenFactor = Math.max(this.regenFactor, effect.factor);
    }
  }

  update(dt: number): void {
    if (this.speedTimer > 0) {
      this.speedTimer -= dt;
      if (this.speedTimer <= 0) this.speedFactor = 1;
    }
    if (this.regenTimer > 0) {
      this.regenTimer -= dt;
      if (this.regenTimer <= 0) this.regenFactor = 1;
    }
  }

  get speedMul(): number {
    return this.speedTimer > 0 ? this.speedFactor : 1;
  }

  get regenMul(): number {
    return this.regenTimer > 0 ? this.regenFactor : 1;
  }

  // For the HUD: what's active and for how long
  get summary(): string {
    const parts: string[] = [];
    if (this.speedTimer > 0) parts.push(`⚡ iute ${Math.ceil(this.speedTimer)}s`);
    if (this.regenTimer > 0) parts.push(`💗 vindecare ${Math.ceil(this.regenTimer)}s`);
    return parts.join('  ');
  }
}
