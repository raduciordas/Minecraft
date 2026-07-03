import { IS_TOUCH } from '../config';

const MOUSE_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI / 2 - 0.01;

// Input hub for both desktop (pointer lock + keyboard) and touch (virtual
// joystick + buttons, wired in by TouchControls). "active" means the player
// is in the game: pointer-locked on desktop, or touch play started on mobile.
export class InputController {
  yaw = 0;
  pitch = 0;
  locked = false;
  inventoryOpen = false;
  readonly isTouchDevice = IS_TOUCH;
  touchActive = false;

  // Written by TouchControls
  touchMoveX = 0;
  touchMoveZ = 0;
  touchJump = false;
  touchDown = false;

  private keys = new Set<string>();
  private breakListeners: (() => void)[] = [];
  private placeListeners: (() => void)[] = [];
  private hotbarListeners: ((slot: number) => void)[] = [];
  private scrollListeners: ((delta: number) => void)[] = [];
  private flyToggleListeners: (() => void)[] = [];
  private inventoryToggleListeners: (() => void)[] = [];
  private touchModeListeners: ((active: boolean) => void)[] = [];
  private overlay: HTMLElement;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    this.overlay = overlay;

    overlay.addEventListener('click', () => {
      if (this.isTouchDevice) this.setTouchActive(true);
      else canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.keys.clear();
      this.updateOverlay();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.applyLookDelta(e.movementX, e.movementY, MOUSE_SENSITIVITY);
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && (this.active || this.inventoryOpen)) {
        this.inventoryToggleListeners.forEach((fn) => fn());
        return;
      }
      if (!this.active) return;
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

  get active(): boolean {
    return this.locked || this.touchActive;
  }

  applyLookDelta(dx: number, dy: number, sensitivity: number): void {
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
  }

  setTouchActive(active: boolean): void {
    this.touchActive = active;
    if (!active) {
      this.keys.clear();
      this.touchMoveX = 0;
      this.touchMoveZ = 0;
      this.touchJump = false;
      this.touchDown = false;
    }
    this.updateOverlay();
    this.touchModeListeners.forEach((fn) => fn(active));
  }

  setInventoryOpen(open: boolean): void {
    this.inventoryOpen = open;
    this.updateOverlay();
  }

  private updateOverlay(): void {
    this.overlay.classList.toggle('hidden', this.active || this.inventoryOpen);
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  // Movement intent in local space: x = strafe right, z = forward
  getMoveInput(): { x: number; z: number; jump: boolean; down: boolean } {
    let x = this.touchMoveX;
    let z = this.touchMoveZ;
    if (this.isDown('KeyW')) z += 1;
    if (this.isDown('KeyS')) z -= 1;
    if (this.isDown('KeyD')) x += 1;
    if (this.isDown('KeyA')) x -= 1;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return {
      x,
      z,
      jump: this.isDown('Space') || this.touchJump,
      down: this.isDown('ShiftLeft') || this.touchDown,
    };
  }

  // Programmatic triggers used by the touch buttons
  triggerBreak(): void {
    this.breakListeners.forEach((fn) => fn());
  }
  triggerPlace(): void {
    this.placeListeners.forEach((fn) => fn());
  }
  triggerFlyToggle(): void {
    this.flyToggleListeners.forEach((fn) => fn());
  }
  triggerInventoryToggle(): void {
    this.inventoryToggleListeners.forEach((fn) => fn());
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
  onInventoryToggle(fn: () => void): void {
    this.inventoryToggleListeners.push(fn);
  }
  onTouchModeChange(fn: (active: boolean) => void): void {
    this.touchModeListeners.push(fn);
  }
}
