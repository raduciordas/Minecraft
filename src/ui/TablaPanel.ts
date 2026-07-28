import type { ProgramNode, VatraPuzzle } from '../vatra/VatraPuzzles';

export const STEP_MS = 1100; // how long a top-level/branch block stays highlighted while executing
const LOOP_STEP_MS = 35; // fast cascade for repeat/while bodies — loops are the computer's speed, not yours
const MAX_WHILE_DEMO = 5; // a "forever" loop still has to demo as a finite animation
const MAX_REPEAT_ANIM = 150; // caps a mistyped huge repeat count from freezing the animation
const DRAG_THRESHOLD_PX = 5; // below this the gesture counts as a tap, not a drag

export interface TablaCallbacks {
  onRunStart: (puzzleId: string) => void;
  onStep: (puzzleId: string, blockId: string) => void;
  onFinish: (puzzleId: string, program: ProgramNode[]) => { success: boolean; text: string };
  onRequestClose: () => void;
  isDone: (puzzleId: string) => boolean;
  onResetLesson: (puzzleId: string) => void;
}

// An insertion point in the program tree: "position `index` of list `list`".
// Every gap between blocks — and the inside of every container — is one.
interface Slot {
  el: HTMLElement;
  list: ProgramNode[];
  index: number;
}

// What the pointer is currently carrying: either a fresh block from the
// palette, or an existing block being moved out of the program.
type DragPayload =
  | { from: 'palette'; label: string; make: () => ProgramNode }
  | { from: 'program'; label: string; node: ProgramNode; list: ProgramNode[]; index: number };

// Tabla de Blocuri: the diegetic wooden-tablet block editor of Satul Codat.
// Palette on the left, program canvas on the right — drag blocks across (or
// tap them, which drops at the highlighted slot). Repeat/while/if are
// generic containers that hold any number of other blocks, nested freely.
export class TablaPanel {
  isOpen = false;
  private puzzle: VatraPuzzle | null = null;
  private program: ProgramNode[] = [];
  private running = false;
  private status: { text: string; ok: boolean } | null = null;
  private root: HTMLElement;
  private panel: HTMLElement;
  private nodeEls = new Map<ProgramNode, HTMLElement>();

  // Drag state
  private slots: Slot[] = [];
  private selected: { list: ProgramNode[]; index: number } | null = null;
  private drag: DragPayload | null = null;
  private dragArmed: { payload: DragPayload; x: number; y: number } | null = null;
  private ghostEl: HTMLElement | null = null;
  private hoverSlot: Slot | null = null;

  constructor(
    container: HTMLElement,
    private cb: TablaCallbacks,
  ) {
    this.root = container;
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root && !this.running && !this.drag) this.cb.onRequestClose();
    });
    this.panel = document.createElement('div');
    this.panel.className = 'tabla-panel';
    this.root.appendChild(this.panel);
  }

  open(puzzle: VatraPuzzle): void {
    this.puzzle = puzzle;
    this.program = [];
    this.selected = null;
    this.running = false;
    this.status = null;
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.render();
  }

  close(): void {
    this.isOpen = false;
    this.running = false;
    this.cancelDrag();
    this.root.classList.add('hidden');
  }

  // ---------------------------------------------------------------- drag

  // Arms a potential drag; it only becomes a real drag once the pointer
  // travels past the threshold, so a plain tap still reads as a click.
  private armDrag(payload: DragPayload, e: PointerEvent): void {
    if (this.running) return;
    this.dragArmed = { payload, x: e.clientX, y: e.clientY };
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (this.dragArmed && !this.drag) {
      const dx = e.clientX - this.dragArmed.x;
      const dy = e.clientY - this.dragArmed.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      this.startDrag(this.dragArmed.payload, e);
    }
    if (!this.drag) return;
    e.preventDefault();
    this.moveGhost(e.clientX, e.clientY);
    this.updateHover(e.clientX, e.clientY);
  };

  private onPointerUp = (): void => {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);

    if (this.drag) {
      const target = this.hoverSlot;
      const payload = this.drag;
      this.cancelDrag();
      if (target) this.dropInto(payload, target);
      else this.render();
    } else if (this.dragArmed) {
      // Never moved far enough — treat as a tap on the block
      const payload = this.dragArmed.payload;
      this.dragArmed = null;
      if (payload.from === 'palette') this.insertAtSelection(payload.make());
    }
    this.dragArmed = null;
  };

  private startDrag(payload: DragPayload, e: PointerEvent): void {
    this.drag = payload;
    this.dragArmed = null;
    const ghost = document.createElement('div');
    ghost.className = 'tabla-ghost';
    ghost.textContent = payload.label;
    document.body.appendChild(ghost);
    this.ghostEl = ghost;
    this.moveGhost(e.clientX, e.clientY);
    this.panel.classList.add('dragging');
  }

  private moveGhost(x: number, y: number): void {
    if (!this.ghostEl) return;
    this.ghostEl.style.left = `${x}px`;
    this.ghostEl.style.top = `${y}px`;
  }

  // Finds the slot under the pointer and highlights it. The ghost is
  // pointer-events:none so elementFromPoint sees straight through it.
  private updateHover(x: number, y: number): void {
    const el = document.elementFromPoint(x, y);
    const slotEl = el?.closest('.tabla-slot') as HTMLElement | null;
    const slot = slotEl ? this.slots.find((s) => s.el === slotEl) ?? null : null;
    if (slot === this.hoverSlot) return;
    this.hoverSlot?.el.classList.remove('hover');
    this.hoverSlot = slot && this.canDropInto(this.drag!, slot) ? slot : null;
    this.hoverSlot?.el.classList.add('hover');
  }

  private cancelDrag(): void {
    this.hoverSlot?.el.classList.remove('hover');
    this.hoverSlot = null;
    this.ghostEl?.remove();
    this.ghostEl = null;
    this.drag = null;
    this.dragArmed = null;
    this.panel.classList.remove('dragging');
  }

  // A container can't be dropped inside itself — that would build a cycle
  private canDropInto(payload: DragPayload, slot: Slot): boolean {
    if (payload.from !== 'program') return true;
    return !this.listsInside(payload.node).includes(slot.list);
  }

  private listsInside(node: ProgramNode): ProgramNode[][] {
    const out: ProgramNode[][] = [];
    const walk = (n: ProgramNode) => {
      if (n.kind === 'repeat' || n.kind === 'while') {
        out.push(n.body);
        n.body.forEach(walk);
      } else if (n.kind === 'if') {
        out.push(n.body, n.elseBody);
        n.body.forEach(walk);
        n.elseBody.forEach(walk);
      }
    };
    walk(node);
    return out;
  }

  private dropInto(payload: DragPayload, slot: Slot): void {
    if (payload.from === 'palette') {
      slot.list.splice(slot.index, 0, payload.make());
      this.selected = { list: slot.list, index: slot.index + 1 };
    } else {
      let index = slot.index;
      payload.list.splice(payload.index, 1);
      // Removing from the same list shifts everything after it down one
      if (slot.list === payload.list && index > payload.index) index--;
      slot.list.splice(index, 0, payload.node);
      this.selected = { list: slot.list, index: index + 1 };
    }
    this.status = null;
    this.render();
  }

  // Tap-to-add: drops at the highlighted slot, or at the end of the program
  private insertAtSelection(node: ProgramNode): void {
    const target = this.selected ?? { list: this.program, index: this.program.length };
    const index = Math.min(target.index, target.list.length);
    target.list.splice(index, 0, node);
    // A fresh container becomes the next insertion point, so the following
    // taps land inside it — the usual thing you want after adding a loop.
    if (node.kind === 'repeat' || node.kind === 'while' || node.kind === 'if') {
      this.selected = { list: node.body, index: 0 };
    } else {
      this.selected = { list: target.list, index: index + 1 };
    }
    this.status = null;
    this.render();
  }

  // -------------------------------------------------------------- render

  private render(): void {
    if (!this.puzzle) return;
    const p = this.puzzle;
    this.panel.innerHTML = '';
    this.nodeEls.clear();
    this.slots = [];

    const title = document.createElement('div');
    title.className = 'tabla-title';
    title.textContent = p.title;
    const close = document.createElement('span');
    close.className = 'tabla-close';
    close.textContent = '✕';
    close.addEventListener('click', () => {
      if (!this.running) this.cb.onRequestClose();
    });
    title.appendChild(close);
    this.panel.appendChild(title);

    const intro = document.createElement('div');
    intro.className = 'tabla-intro';
    intro.textContent = p.intro;
    this.panel.appendChild(intro);

    const workspace = document.createElement('div');
    workspace.className = 'tabla-workspace';

    // ---- left pane: the palette of available blocks
    const palettePane = document.createElement('div');
    palettePane.className = 'tabla-pane tabla-palette-pane';
    const palTitle = document.createElement('div');
    palTitle.className = 'tabla-sec';
    palTitle.textContent = 'Blocuri';
    palettePane.appendChild(palTitle);

    const hint = document.createElement('div');
    hint.className = 'tabla-hint';
    hint.textContent = 'Trage-le în dreapta (sau apasă-le)';
    palettePane.appendChild(hint);

    const actionsGroup = document.createElement('div');
    actionsGroup.className = 'tabla-palette-group';
    for (const action of p.actions) {
      actionsGroup.appendChild(
        this.paletteChip(action.label, '', () => ({ kind: 'action', id: action.id })),
      );
    }
    palettePane.appendChild(actionsGroup);

    if (p.allowRepeat || p.allowWhile || p.allowIf) {
      const ctrlTitle = document.createElement('div');
      ctrlTitle.className = 'tabla-sec tabla-sec-ctrl';
      ctrlTitle.textContent = 'Control';
      palettePane.appendChild(ctrlTitle);
      const ctrlGroup = document.createElement('div');
      ctrlGroup.className = 'tabla-palette-group';
      if (p.allowRepeat) {
        ctrlGroup.appendChild(
          this.paletteChip('🔁 Repetă de N ori', 'tabla-chip-container', () => ({
            kind: 'repeat',
            count: 1,
            body: [],
          })),
        );
      }
      if (p.allowWhile) {
        ctrlGroup.appendChild(
          this.paletteChip('🔁 Cât timp…', 'tabla-chip-container', () => ({
            kind: 'while',
            cond: p.conditions![0].id,
            body: [],
          })),
        );
      }
      if (p.allowIf) {
        ctrlGroup.appendChild(
          this.paletteChip('❓ Dacă… / Altfel', 'tabla-chip-container', () => ({
            kind: 'if',
            cond: p.conditions![0].id,
            body: [],
            elseBody: [],
          })),
        );
      }
      palettePane.appendChild(ctrlGroup);
    }
    workspace.appendChild(palettePane);

    // ---- right pane: the program canvas
    const canvasPane = document.createElement('div');
    canvasPane.className = 'tabla-pane tabla-canvas-pane';
    const progTitle = document.createElement('div');
    progTitle.className = 'tabla-sec';
    progTitle.textContent = 'Programul tău';
    canvasPane.appendChild(progTitle);

    const prog = document.createElement('div');
    prog.className = 'tabla-program';
    this.renderList(prog, this.program, 0);
    canvasPane.appendChild(prog);
    workspace.appendChild(canvasPane);

    this.panel.appendChild(workspace);

    const actions = document.createElement('div');
    actions.className = 'tabla-actions';
    const run = document.createElement('button');
    run.className = 'tabla-run';
    run.textContent = this.running ? 'Rulează…' : '▶ Pornește';
    run.disabled = this.running || this.program.length === 0;
    run.addEventListener('click', () => void this.run());
    actions.appendChild(run);
    const reset = document.createElement('button');
    reset.className = 'tabla-reset';
    reset.textContent = 'Șterge tot';
    reset.disabled = this.running || this.program.length === 0;
    reset.addEventListener('click', () => {
      this.program = [];
      this.selected = null;
      this.status = null;
      this.render();
    });
    actions.appendChild(reset);

    const done = this.cb.isDone(p.id);
    const relearn = document.createElement('button');
    relearn.className = 'tabla-relearn';
    relearn.textContent = '↺ Resetează lecția';
    relearn.disabled = this.running || !done;
    relearn.title = done
      ? 'Reia lecția de la capăt — o poți rezolva din nou, pentru răsplată din nou'
      : 'Rezolvă lecția întâi, ca s-o poți reseta';
    relearn.addEventListener('click', () => {
      this.cb.onResetLesson(p.id);
      this.program = [];
      this.selected = null;
      this.status = { text: 'Lecția a fost resetată — poți s-o iei de la capăt, ca prima dată!', ok: true };
      this.render();
    });
    actions.appendChild(relearn);
    this.panel.appendChild(actions);

    const status = document.createElement('div');
    status.className = 'tabla-status' + (this.status ? (this.status.ok ? ' ok' : ' bad') : '');
    status.textContent = this.status?.text ?? '';
    this.panel.appendChild(status);
  }

  private paletteChip(label: string, extraClass: string, make: () => ProgramNode): HTMLElement {
    const chip = document.createElement('button');
    chip.className = 'tabla-chip' + (extraClass ? ` ${extraClass}` : '');
    chip.textContent = label;
    chip.disabled = this.running;
    chip.addEventListener('pointerdown', (e) => {
      if (this.running) return;
      e.preventDefault();
      this.armDrag({ from: 'palette', label, make }, e);
    });
    return chip;
  }

  // Renders one nested list: a drop slot, then block, slot, block… so there
  // is an insertion point before, between and after every block.
  private renderList(container: HTMLElement, list: ProgramNode[], depth: number): void {
    const p = this.puzzle!;

    container.appendChild(this.slotEl(list, 0, depth, list.length === 0));

    list.forEach((node, i) => {
      const row = document.createElement('div');
      row.className = 'tabla-row';
      this.nodeEls.set(node, row);

      const head = document.createElement('div');
      head.className = 'tabla-row-head';
      // Dragging an existing block moves it; interactive widgets inside are
      // excluded so you can still edit a count or pick a condition.
      head.addEventListener('pointerdown', (e) => {
        if (this.running) return;
        if ((e.target as HTMLElement).closest('input, select, button')) return;
        e.preventDefault();
        this.armDrag({ from: 'program', label: this.nodeLabel(node), node, list, index: i }, e);
      });

      const grip = document.createElement('span');
      grip.className = 'tabla-grip';
      grip.textContent = '⠿';
      head.appendChild(grip);

      if (node.kind === 'action') {
        const name = document.createElement('span');
        name.textContent = p.actions.find((a) => a.id === node.id)?.label ?? node.id;
        head.appendChild(name);
      } else if (node.kind === 'repeat') {
        row.classList.add('tabla-container-row');
        const label = document.createElement('span');
        label.textContent = '🔁 Repetă de';
        head.appendChild(label);
        const count = document.createElement('input');
        count.type = 'number';
        count.min = '1';
        count.className = 'tabla-count';
        count.value = String(node.count);
        count.disabled = this.running;
        count.addEventListener('change', () => {
          node.count = Math.max(1, Math.floor(Number(count.value)) || 1);
          this.status = null;
          this.render();
        });
        head.appendChild(count);
        const ori = document.createElement('span');
        ori.textContent = 'ori';
        head.appendChild(ori);
      } else if (node.kind === 'while') {
        row.classList.add('tabla-container-row');
        const label = document.createElement('span');
        label.textContent = '🔁 Cât timp';
        head.appendChild(label);
        head.appendChild(this.condSelect(node.cond, (v) => (node.cond = v)));
      } else if (node.kind === 'if') {
        row.classList.add('tabla-container-row');
        const label = document.createElement('span');
        label.textContent = '❓ Dacă';
        head.appendChild(label);
        head.appendChild(this.condSelect(node.cond, (v) => (node.cond = v)));
      }

      const del = document.createElement('button');
      del.className = 'tabla-del';
      del.textContent = '✕';
      del.disabled = this.running;
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        list.splice(i, 1);
        this.selected = null;
        this.status = null;
        this.render();
      });
      head.appendChild(del);
      row.appendChild(head);

      if (node.kind === 'repeat' || node.kind === 'while') {
        const body = document.createElement('div');
        body.className = 'tabla-nested';
        this.renderList(body, node.body, depth + 1);
        row.appendChild(body);
      } else if (node.kind === 'if') {
        const thenLbl = document.createElement('div');
        thenLbl.className = 'tabla-branch-label';
        thenLbl.textContent = 'DACĂ:';
        row.appendChild(thenLbl);
        const body = document.createElement('div');
        body.className = 'tabla-nested';
        this.renderList(body, node.body, depth + 1);
        row.appendChild(body);

        const elseLbl = document.createElement('div');
        elseLbl.className = 'tabla-branch-label';
        elseLbl.textContent = 'ALTFEL:';
        row.appendChild(elseLbl);
        const elseBody = document.createElement('div');
        elseBody.className = 'tabla-nested';
        this.renderList(elseBody, node.elseBody, depth + 1);
        row.appendChild(elseBody);
      }

      container.appendChild(row);
      container.appendChild(this.slotEl(list, i + 1, depth, false));
    });
  }

  private slotEl(list: ProgramNode[], index: number, depth: number, isEmptyList: boolean): HTMLElement {
    const el = document.createElement('div');
    const isSelected = this.selected?.list === list && this.selected.index === index;
    el.className = 'tabla-slot' + (isSelected ? ' selected' : '') + (isEmptyList ? ' empty' : '');
    if (isEmptyList) {
      el.textContent = depth === 0 ? '— trage blocuri aici —' : '— gol —';
    }
    el.addEventListener('click', (e) => {
      if (this.running || this.drag) return;
      e.stopPropagation();
      this.selected = { list, index };
      this.render();
    });
    this.slots.push({ el, list, index });
    return el;
  }

  private nodeLabel(node: ProgramNode): string {
    const p = this.puzzle!;
    if (node.kind === 'action') return p.actions.find((a) => a.id === node.id)?.label ?? node.id;
    if (node.kind === 'repeat') return `🔁 Repetă de ${node.count} ori`;
    if (node.kind === 'while') return '🔁 Cât timp…';
    return '❓ Dacă… / Altfel';
  }

  private condSelect(current: string, onChange: (v: string) => void): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.className = 'tabla-cond';
    sel.disabled = this.running;
    for (const c of this.puzzle!.conditions ?? []) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label;
      opt.selected = c.id === current;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', (e) => {
      e.stopPropagation();
      onChange(sel.value);
      this.status = null;
      this.render();
    });
    sel.addEventListener('click', (e) => e.stopPropagation());
    return sel;
  }

  // ------------------------------------------------------------- execute

  private highlight(node: ProgramNode): void {
    for (const el of this.nodeEls.values()) el.classList.remove('running');
    this.nodeEls.get(node)?.classList.add('running');
  }

  // Recursively walks the tree, animating each action at `stepMs` apart —
  // repeat/while bodies run at LOOP_STEP_MS (the computer's speed), if/else
  // branches run at the normal pace since they're not repeated.
  private async runList(nodes: ProgramNode[], stepMs: number): Promise<boolean> {
    for (const node of nodes) {
      if (!this.isOpen) return false;
      if (node.kind === 'action') {
        this.highlight(node);
        this.cb.onStep(this.puzzle!.id, node.id);
        await new Promise((r) => setTimeout(r, stepMs));
      } else if (node.kind === 'repeat') {
        this.highlight(node);
        const n = Math.min(Math.max(node.count, 0), MAX_REPEAT_ANIM);
        for (let i = 0; i < n; i++) {
          if (!(await this.runList(node.body, LOOP_STEP_MS))) return false;
        }
      } else if (node.kind === 'while') {
        this.highlight(node);
        for (let i = 0; i < MAX_WHILE_DEMO; i++) {
          if (!(await this.runList(node.body, LOOP_STEP_MS))) return false;
        }
      } else if (node.kind === 'if') {
        this.highlight(node);
        await new Promise((r) => setTimeout(r, 400)); // beat to show the condition being checked
        if (!(await this.runList(node.body, stepMs))) return false;
        if (node.elseBody.length && !(await this.runList(node.elseBody, stepMs))) return false;
      }
    }
    return true;
  }

  private async run(): Promise<void> {
    if (!this.puzzle || this.running || this.program.length === 0) return;
    const puzzle = this.puzzle;
    const program = this.program;
    this.running = true;
    this.status = null;
    this.render();

    this.cb.onRunStart(puzzle.id);
    const completed = await this.runList(program, STEP_MS);
    if (!this.isOpen) return; // closed mid-run — abort quietly
    for (const el of this.nodeEls.values()) el.classList.remove('running');
    if (!completed) {
      this.running = false;
      this.render();
      return;
    }

    const result = this.cb.onFinish(puzzle.id, program);
    this.running = false;
    this.status = { text: result.text, ok: result.success };
    this.render();
  }
}
