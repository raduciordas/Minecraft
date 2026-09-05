import type { InputController } from '../player/InputController';

const JOY_RADIUS = 44; // px of knob travel
const TOUCH_LOOK_SENSITIVITY = 0.0035;
const HOLD_REPEAT_MS = 280;

// On-screen controls for phones/tablets: virtual joystick (move), drag
// anywhere else (look), and buttons for jump/descend/break/place/fly/
// inventory/pause. Built only on touch devices; shown while playing.
export class TouchControls {
  constructor(private input: InputController) {
    if (!input.isTouchDevice) return;

    const root = document.createElement('div');
    root.id = 'touch-ui';
    document.body.appendChild(root);
    input.onTouchModeChange((active) => root.classList.toggle('active', active));

    // Mobile-appropriate start screen text
    const help = document.querySelector('#overlay p');
    if (help) {
      help.innerHTML =
        'Tap to play<br /><br />' +
        'Left stick — move &nbsp;|&nbsp; drag screen — look<br />' +
        '⛏ break &nbsp;|&nbsp; ⬜ place &nbsp;|&nbsp; ⤒ jump / swim &nbsp;|&nbsp; ⤓ descend<br />' +
        '✈ zbor (cu Aripile Zmeului) &nbsp;|&nbsp; 🎒 inventory &nbsp;|&nbsp; tap hotbar to select<br />' +
        'Progress is saved automatically in your browser.';
    }

    this.buildLookArea(root);
    this.buildJoystick(root);
    this.buildButtons(root);
  }

  private buildLookArea(root: HTMLElement): void {
    const look = document.createElement('div');
    look.id = 'touch-look';
    root.appendChild(look);

    let touchId: number | null = null;
    let lastX = 0;
    let lastY = 0;

    look.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        if (touchId !== null) return;
        const t = e.changedTouches[0];
        touchId = t.identifier;
        lastX = t.clientX;
        lastY = t.clientY;
      },
      { passive: false },
    );
    look.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier !== touchId) continue;
          this.input.applyLookDelta(t.clientX - lastX, t.clientY - lastY, TOUCH_LOOK_SENSITIVITY);
          lastX = t.clientX;
          lastY = t.clientY;
        }
      },
      { passive: false },
    );
    for (const type of ['touchend', 'touchcancel'] as const) {
      look.addEventListener(type, (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === touchId) touchId = null;
        }
      });
    }
  }

  private buildJoystick(root: HTMLElement): void {
    const base = document.createElement('div');
    base.className = 'joy-base';
    const knob = document.createElement('div');
    knob.className = 'joy-knob';
    base.appendChild(knob);
    root.appendChild(base);

    let touchId: number | null = null;
    let centerX = 0;
    let centerY = 0;

    const apply = (clientX: number, clientY: number) => {
      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) {
        dx *= JOY_RADIUS / len;
        dy *= JOY_RADIUS / len;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.input.touchMoveX = dx / JOY_RADIUS;
      this.input.touchMoveZ = -dy / JOY_RADIUS; // drag up = forward
    };
    const reset = () => {
      touchId = null;
      knob.style.transform = 'translate(-50%, -50%)';
      this.input.touchMoveX = 0;
      this.input.touchMoveZ = 0;
    };

    base.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        if (touchId !== null) return;
        const t = e.changedTouches[0];
        touchId = t.identifier;
        const rect = base.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
        apply(t.clientX, t.clientY);
      },
      { passive: false },
    );
    base.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier === touchId) apply(t.clientX, t.clientY);
        }
      },
      { passive: false },
    );
    for (const type of ['touchend', 'touchcancel'] as const) {
      base.addEventListener(type, (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === touchId) reset();
        }
      });
    }
  }

  private buildButtons(root: HTMLElement): void {
    const input = this.input;
    let repeatTimer: ReturnType<typeof setInterval> | null = null;

    const button = (
      id: string,
      label: string,
      onPress: () => void,
      onRelease?: () => void,
    ): HTMLElement => {
      const el = document.createElement('div');
      el.id = id;
      el.className = 'touch-btn';
      el.textContent = label;
      el.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          onPress();
        },
        { passive: false },
      );
      for (const type of ['touchend', 'touchcancel'] as const) {
        el.addEventListener(type, (e) => {
          e.preventDefault();
          onRelease?.();
        });
      }
      root.appendChild(el);
      return el;
    };
    const stopRepeat = () => {
      if (repeatTimer !== null) clearInterval(repeatTimer);
      repeatTimer = null;
    };

    button('btn-jump', '⤒', () => (input.touchJump = true), () => (input.touchJump = false));
    button('btn-down', '⤓', () => (input.touchDown = true), () => (input.touchDown = false));
    button(
      'btn-break',
      '⛏',
      () => {
        input.triggerBreak();
        stopRepeat();
        repeatTimer = setInterval(() => input.triggerBreak(), HOLD_REPEAT_MS);
      },
      stopRepeat,
    );
    button(
      'btn-place',
      '⬜',
      () => {
        input.triggerPlace();
        stopRepeat();
        repeatTimer = setInterval(() => input.triggerPlace(), HOLD_REPEAT_MS);
      },
      stopRepeat,
    );
    button('btn-fly', '✈', () => input.triggerFlyToggle());
    button('btn-inv', '🎒', () => input.triggerInventoryToggle());
    button('btn-pause', '❚❚', () => input.setTouchActive(false));
  }
}
