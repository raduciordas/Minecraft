export class Hud {
  private frames: number[] = [];
  private lastUpdate = 0;

  constructor(private fpsElement: HTMLElement) {}

  tick(now: number): void {
    this.frames.push(now);
    while (this.frames.length > 0 && this.frames[0] < now - 1000) {
      this.frames.shift();
    }
    if (now - this.lastUpdate > 500) {
      this.fpsElement.textContent = `${this.frames.length} FPS`;
      this.lastUpdate = now;
    }
  }
}
