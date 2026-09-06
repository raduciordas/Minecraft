// Muma Pădurii's brass compass: while it's the held item, an arrow at the
// top of the screen points at the nearest place worth walking to, and says
// how far it is. Cheaper to read at a glance than the Hartă, and it works
// while you keep running.

export interface CompassTarget {
  x: number;
  z: number;
  label: string;
}

export class Compass {
  private root: HTMLElement;
  private needle: HTMLElement;
  private caption: HTMLElement;
  visible = false;

  constructor(
    container: HTMLElement,
    private targets: CompassTarget[],
  ) {
    this.root = container;
    this.root.classList.add('hidden');
    this.needle = document.createElement('div');
    this.needle.className = 'compass-needle';
    this.needle.textContent = '➤';
    this.root.appendChild(this.needle);
    this.caption = document.createElement('div');
    this.caption.className = 'compass-caption';
    this.root.appendChild(this.caption);
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.root.classList.toggle('hidden', !visible);
  }

  // Turns the needle to whichever target is closest, relative to where the
  // player is looking, so "up" always means straight ahead
  update(px: number, pz: number, yaw: number): void {
    if (!this.visible || this.targets.length === 0) return;
    let best = this.targets[0];
    let bestDist = Infinity;
    for (const t of this.targets) {
      const d = Math.hypot(t.x - px, t.z - pz);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    // Forward is (-sin yaw, -cos yaw); the needle is drawn pointing up, so
    // rotate by the angle between "where I look" and "where it lies"
    const bearing = Math.atan2(-(best.x - px), -(best.z - pz));
    this.needle.style.transform = `rotate(${bearing - yaw}rad)`;
    this.caption.textContent = `${best.label} · ${Math.round(bestDist)} cuburi`;
  }
}
