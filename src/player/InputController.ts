const MOUSE_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.01;

export class InputController {
  yaw = 0;
  pitch = 0;
  locked = false;

  private keys = new Set<string>();
  private breakListeners: (() => void)[] = [];
  private placeListeners: (() => void)[] = [];
  private hotbarListeners: ((slot: number) => void)[] = [];
  private scrollListeners: ((delta: number) => void)[] = [];
  private flyToggleListeners: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    overlay.addEventListener('click', () => {
      canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      overlay.classList.toggle('hidden', this.locked);
      if (!this.locked) this.keys.clear();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    });

    document.addEventListener('keydown', (e) => {
      if (!this.locked) return;
      this.keys.add(e.code);
      if (e.code === 'KeyF') this.flyToggleListeners.forEach((fn) => fn());
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) this.hotbarListeners.forEach((fn) => fn(n - 1));
      }
    });

    document.addEventListener('keyup', (e) => this.keys.delete(e.code));

    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.breakListeners.forEach((fn) => fn());
      if (e.button === 2) this.placeListeners.forEach((fn) => fn());
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.scrollListeners.forEach((fn) => fn(Math.sign(e.deltaY)));
    });
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  // Movement intent in local space: x = strafe right, z = forward
  getMoveInput(): { x: number; z: number; jump: boolean; down: boolean } {
    let x = 0;
    let z = 0;
    if (this.isDown('KeyW')) z += 1;
    if (this.isDown('KeyS')) z -= 1;
    if (this.isDown('KeyD')) x += 1;
    if (this.isDown('KeyA')) x -= 1;
    const len = Math.hypot(x, z);
    if (len > 0) {
      x /= len;
      z /= len;
    }
    return { x, z, jump: this.isDown('Space'), down: this.isDown('ShiftLeft') };
  }

  onBreak(fn: () => void): void {
    this.breakListeners.push(fn);
  }
  onPlace(fn: () => void): void {
    this.placeListeners.push(fn);
  }
  onHotbarSelect(fn: (slot: number) => void): void {
    this.hotbarListeners.push(fn);
  }
  onScroll(fn: (delta: number) => void): void {
    this.scrollListeners.push(fn);
  }
  onFlyToggle(fn: () => void): void {
    this.flyToggleListeners.push(fn);
  }
}
