import { MAX_OXYGEN_SECONDS } from '../config';
import type { Health } from '../player/Health';

// Hearts + oxygen bubbles above the hotbar, red damage flash, death screen.
export class HealthHud {
  private hearts: HTMLElement[] = [];
  private heartRow: HTMLElement;
  private bubbles: HTMLElement[] = [];
  private bubbleRow: HTMLElement;
  private flashEl: HTMLElement;
  private deathEl: HTMLElement;

  constructor(health: Health, onRespawn: () => void) {
    const status = document.getElementById('status')!;

    this.bubbleRow = document.createElement('div');
    this.bubbleRow.className = 'bubble-row';
    for (let i = 0; i < MAX_OXYGEN_SECONDS; i++) {
      const b = document.createElement('span');
      b.textContent = '●';
      this.bubbleRow.appendChild(b);
      this.bubbles.push(b);
    }
    status.appendChild(this.bubbleRow);

    this.heartRow = document.createElement('div');
    this.heartRow.className = 'heart-row';
    status.appendChild(this.heartRow);
    this.buildHearts(health.maxHp);

    this.flashEl = document.getElementById('damage-flash')!;
    this.deathEl = document.getElementById('death')!;
    this.deathEl.querySelector('button')!.addEventListener('click', onRespawn);

    health.onChange(() => this.render(health));
    health.onDamage(() => this.flash());
    this.render(health);
  }

  // One heart per two hp; rebuilt when the maximum grows (Mărul de aur)
  private buildHearts(maxHp: number): void {
    this.heartRow.innerHTML = '';
    this.hearts = [];
    for (let i = 0; i < maxHp / 2; i++) {
      const h = document.createElement('span');
      h.textContent = '♥';
      this.heartRow.appendChild(h);
      this.hearts.push(h);
    }
  }

  private render(health: Health): void {
    if (this.hearts.length !== Math.ceil(health.maxHp / 2)) this.buildHearts(health.maxHp);
    this.hearts.forEach((el, i) => {
      const filled = health.hp - i * 2;
      el.className = filled >= 2 ? 'full' : filled === 1 ? 'half' : 'empty';
    });
    const showBubbles = health.oxygen < MAX_OXYGEN_SECONDS - 0.01;
    this.bubbleRow.style.visibility = showBubbles ? 'visible' : 'hidden';
    this.bubbles.forEach((el, i) => {
      el.className = health.oxygen > i + 0.5 ? 'full' : 'empty';
    });
  }

  private flash(): void {
    this.flashEl.classList.add('show');
    setTimeout(() => this.flashEl.classList.remove('show'), 180);
  }

  showDeath(): void {
    this.deathEl.classList.remove('hidden');
  }

  hideDeath(): void {
    this.deathEl.classList.add('hidden');
  }
}
