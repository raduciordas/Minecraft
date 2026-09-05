import {
  MAX_HP,
  MAX_OXYGEN_SECONDS,
  DROWN_DAMAGE_INTERVAL,
  REGEN_DELAY_SECONDS,
  REGEN_INTERVAL_SECONDS,
} from '../config';

const INVULN_SECONDS = 0.5;
export const MAX_MAX_HP = 30; // the Golden Apple can raise a life this far

export class Health {
  hp = MAX_HP;
  maxHp = MAX_HP; // grows with the Mărul de aur, saved with the world
  oxygen = MAX_OXYGEN_SECONDS;
  dead = false;
  // Food can speed regeneration up for a while (see StatusEffects)
  regenMul = 1;

  private invulnTimer = 0;
  private sinceDamage = Infinity;
  private drownTimer = 0;
  private regenTimer = 0;
  private changeListeners: (() => void)[] = [];
  private deathListeners: (() => void)[] = [];
  private damageListeners: (() => void)[] = [];

  damage(amount: number): void {
    if (this.dead || this.invulnTimer > 0 || amount <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnTimer = INVULN_SECONDS;
    this.sinceDamage = 0;
    this.damageListeners.forEach((fn) => fn());
    this.emitChange();
    if (this.hp === 0) {
      this.dead = true;
      this.deathListeners.forEach((fn) => fn());
    }
  }

  update(dt: number, eyeUnderwater: boolean): void {
    if (this.dead) return;
    this.invulnTimer -= dt;
    this.sinceDamage += dt;

    if (eyeUnderwater) {
      const before = this.oxygen;
      this.oxygen = Math.max(0, this.oxygen - dt);
      if (before !== this.oxygen) this.emitChange();
      if (this.oxygen === 0) {
        this.drownTimer += dt;
        if (this.drownTimer >= DROWN_DAMAGE_INTERVAL) {
          this.drownTimer = 0;
          this.invulnTimer = 0; // drowning ignores hit invulnerability
          this.damage(2);
        }
      }
    } else {
      this.drownTimer = 0;
      if (this.oxygen < MAX_OXYGEN_SECONDS) {
        this.oxygen = Math.min(MAX_OXYGEN_SECONDS, this.oxygen + dt * 4);
        this.emitChange();
      }
    }

    // Slow regeneration a while after the last hit
    if (this.hp < this.maxHp && this.sinceDamage > REGEN_DELAY_SECONDS / this.regenMul) {
      this.regenTimer += dt * this.regenMul;
      if (this.regenTimer >= REGEN_INTERVAL_SECONDS) {
        this.regenTimer = 0;
        this.hp = Math.min(this.maxHp, this.hp + 1);
        this.emitChange();
      }
    } else {
      this.regenTimer = 0;
    }
  }

  // Eating food restores hp, capped at the max — unlike damage(), this
  // works even during the post-hit invulnerability window
  heal(amount: number): void {
    if (this.dead || amount <= 0 || this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.emitChange();
  }

  // A permanent extra heart (or more); the new capacity comes filled
  raiseMaxHp(by: number): void {
    const next = Math.min(MAX_MAX_HP, this.maxHp + by);
    if (next === this.maxHp) return;
    this.hp += next - this.maxHp;
    this.maxHp = next;
    this.emitChange();
  }

  respawn(): void {
    this.hp = this.maxHp;
    this.oxygen = MAX_OXYGEN_SECONDS;
    this.dead = false;
    this.invulnTimer = 0;
    this.sinceDamage = Infinity;
    this.emitChange();
  }

  setHp(hp: number): void {
    this.hp = Math.max(1, Math.min(this.maxHp, hp));
    this.emitChange();
  }

  setMaxHp(maxHp: number): void {
    this.maxHp = Math.max(MAX_HP, Math.min(MAX_MAX_HP, Math.floor(maxHp)));
    this.hp = Math.min(this.hp, this.maxHp);
    this.emitChange();
  }

  onChange(fn: () => void): void {
    this.changeListeners.push(fn);
  }
  onDamage(fn: () => void): void {
    this.damageListeners.push(fn);
  }
  onDeath(fn: () => void): void {
    this.deathListeners.push(fn);
  }

  private emitChange(): void {
    this.changeListeners.forEach((fn) => fn());
  }
}
