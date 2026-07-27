import type { ProgramNode, VatraPuzzle } from '../vatra/VatraPuzzles';

export const STEP_MS = 1100; // how long a top-level/branch block stays highlighted while executing
const LOOP_STEP_MS = 35; // fast cascade for repeat/while bodies — loops are the computer's speed, not yours
const MAX_WHILE_DEMO = 5; // a "forever" loop still has to demo as a finite animation
const MAX_REPEAT_ANIM = 150; // caps a mistyped huge repeat count from freezing the animation

export interface TablaCallbacks {
  onRunStart: (puzzleId: string) => void;
  onStep: (puzzleId: string, blockId: string) => void;
  onFinish: (puzzleId: string, program: ProgramNode[]) => { success: boolean; text: string };
  onRequestClose: () => void;
  isDone: (puzzleId: string) => boolean;
  onResetLesson: (puzzleId: string) => void;
}

// A path of steps into the program tree, identifying which nested list is
// currently "active" — where new blocks land when a palette button is
// clicked. [] means the top level.
interface PathStep {
  index: number;
  slot: 'body' | 'elseBody';
}

// Tabla de Blocuri: the diegetic wooden-tablet block editor of Satul Codat.
// Action chips append leaves; the generic Repetă/Cât timp/Dacă containers
// hold other blocks — including other containers — like Scratch. Click a
// container (or an existing one's DACĂ/ALTFEL section) to make it the
// active insertion point; "ieși din bloc" steps back out.
export class TablaPanel {
  isOpen = false;
  private puzzle: VatraPuzzle | null = null;
  private program: ProgramNode[] = [];
  private activePath: PathStep[] = [];
  private running = false;
  private status: { text: string; ok: boolean } | null = null;
  private root: HTMLElement;
  private panel: HTMLElement;
  private nodeEls = new Map<ProgramNode, HTMLElement>();

  constructor(
    container: HTMLElement,
    private cb: TablaCallbacks,
  ) {
    this.root = container;
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root && !this.running) this.cb.onRequestClose();
    });
    this.panel = document.createElement('div');
    this.panel.className = 'tabla-panel';
    this.root.appendChild(this.panel);
  }

  open(puzzle: VatraPuzzle): void {
    this.puzzle = puzzle;
    this.program = [];
    this.activePath = [];
    this.running = false;
    this.status = null;
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.render();
  }

  close(): void {
    this.isOpen = false;
    this.running = false;
    this.root.classList.add('hidden');
  }

  // Resolves a path to the actual node list it points at (top level if empty)
  private resolveList(path: PathStep[]): ProgramNode[] {
    let list = this.program;
    for (const step of path) {
      const node = list[step.index];
      if (node.kind === 'repeat' || node.kind === 'while') list = node.body;
      else if (node.kind === 'if') list = step.slot === 'elseBody' ? node.elseBody : node.body;
    }
    return list;
  }

  private samePath(a: PathStep[], b: PathStep[]): boolean {
    return a.length === b.length && a.every((s, i) => s.index === b[i].index && s.slot === b[i].slot);
  }

  private addNode(node: ProgramNode): void {
    const list = this.resolveList(this.activePath);
    list.push(node);
    this.status = null;
    // Containers become the new active insertion point, so the next clicks land inside them
    if (node.kind === 'repeat' || node.kind === 'while') {
      this.activePath = [...this.activePath, { index: list.length - 1, slot: 'body' }];
    } else if (node.kind === 'if') {
      this.activePath = [...this.activePath, { index: list.length - 1, slot: 'body' }];
    }
    this.render();
  }

  private render(): void {
    if (!this.puzzle) return;
    const p = this.puzzle;
    this.panel.innerHTML = '';
    this.nodeEls.clear();

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

    const palTitle = document.createElement('div');
    palTitle.className = 'tabla-sec';
    palTitle.textContent = 'Blocuri — apasă ca să adaugi acolo unde e cadrul aprins mai jos';
    this.panel.appendChild(palTitle);

    const palette = document.createElement('div');
    palette.className = 'tabla-palette';
    for (const action of p.actions) {
      const chip = document.createElement('button');
      chip.className = 'tabla-chip';
      chip.textContent = action.label;
      chip.disabled = this.running;
      chip.addEventListener('click', () => this.addNode({ kind: 'action', id: action.id }));
      palette.appendChild(chip);
    }
    if (p.allowRepeat) {
      const chip = document.createElement('button');
      chip.className = 'tabla-chip tabla-chip-container';
      chip.textContent = '🔁 Repetă de N ori';
      chip.disabled = this.running;
      chip.addEventListener('click', () => this.addNode({ kind: 'repeat', count: 1, body: [] }));
      palette.appendChild(chip);
    }
    if (p.allowWhile) {
      const chip = document.createElement('button');
      chip.className = 'tabla-chip tabla-chip-container';
      chip.textContent = '🔁 Cât timp…';
      chip.disabled = this.running;
      chip.addEventListener('click', () =>
        this.addNode({ kind: 'while', cond: p.conditions![0].id, body: [] }),
      );
      palette.appendChild(chip);
    }
    if (p.allowIf) {
      const chip = document.createElement('button');
      chip.className = 'tabla-chip tabla-chip-container';
      chip.textContent = '❓ Dacă… / Altfel';
      chip.disabled = this.running;
      chip.addEventListener('click', () =>
        this.addNode({ kind: 'if', cond: p.conditions![0].id, body: [], elseBody: [] }),
      );
      palette.appendChild(chip);
    }
    this.panel.appendChild(palette);

    const progTitle = document.createElement('div');
    progTitle.className = 'tabla-sec';
    progTitle.textContent = 'Programul tău';
    this.panel.appendChild(progTitle);

    const prog = document.createElement('div');
    prog.className = 'tabla-program';
    this.renderList(prog, this.program, [], 0);
    this.panel.appendChild(prog);

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
      this.activePath = [];
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
      this.activePath = [];
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

  // Renders one nested list of nodes (recursing into containers), tracking
  // the path so click handlers know exactly which list/slot they touch. An
  // always-visible marker is the one reliable way to (re)select a level as
  // the active insertion point, regardless of how full it already is.
  private renderList(container: HTMLElement, list: ProgramNode[], path: PathStep[], depth: number): void {
    const p = this.puzzle!;
    const isActive = this.samePath(path, this.activePath);

    const dropzone = document.createElement('div');
    dropzone.className = 'tabla-dropzone' + (isActive ? ' active' : '');

    const marker = document.createElement('button');
    marker.className = 'tabla-marker' + (isActive ? ' active' : '');
    marker.type = 'button';
    marker.disabled = this.running;
    marker.textContent = isActive
      ? '✅ adaugi aici'
      : list.length === 0
        ? (depth === 0 ? '— tăblița e goală — apasă aici' : '— gol — apasă aici')
        : '📍 adaugă aici';
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.running) return;
      this.activePath = path;
      this.render();
    });
    dropzone.appendChild(marker);

    list.forEach((node, i) => {
      const row = document.createElement('div');
      row.className = 'tabla-row';
      this.nodeEls.set(node, row);

      const head = document.createElement('div');
      head.className = 'tabla-row-head';

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
        const rest = document.createElement('span');
        rest.textContent = '→';
        head.appendChild(rest);
      } else if (node.kind === 'if') {
        row.classList.add('tabla-container-row');
        const label = document.createElement('span');
        label.textContent = '❓ Dacă';
        head.appendChild(label);
        head.appendChild(this.condSelect(node.cond, (v) => (node.cond = v)));
      }

      const controls = document.createElement('span');
      controls.className = 'tabla-row-btns';
      const mk = (txt: string, fn: () => void, disabled: boolean) => {
        const b = document.createElement('button');
        b.textContent = txt;
        b.disabled = disabled || this.running;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          fn();
        });
        controls.appendChild(b);
      };
      mk('↑', () => {
        [list[i - 1], list[i]] = [list[i], list[i - 1]];
        this.render();
      }, i === 0);
      mk('↓', () => {
        [list[i + 1], list[i]] = [list[i], list[i + 1]];
        this.render();
      }, i === list.length - 1);
      mk('✕', () => {
        list.splice(i, 1);
        this.status = null;
        this.activePath = []; // removing a node can invalidate deeper paths — reset to top level
        this.render();
      }, false);
      head.appendChild(controls);
      row.appendChild(head);

      if (node.kind === 'repeat' || node.kind === 'while') {
        const body = document.createElement('div');
        body.className = 'tabla-nested';
        this.renderList(body, node.body, [...path, { index: i, slot: 'body' }], depth + 1);
        row.appendChild(body);
      } else if (node.kind === 'if') {
        const thenLbl = document.createElement('div');
        thenLbl.className = 'tabla-branch-label';
        thenLbl.textContent = 'DACĂ:';
        row.appendChild(thenLbl);
        const body = document.createElement('div');
        body.className = 'tabla-nested';
        this.renderList(body, node.body, [...path, { index: i, slot: 'body' }], depth + 1);
        row.appendChild(body);

        const elseLbl = document.createElement('div');
        elseLbl.className = 'tabla-branch-label';
        elseLbl.textContent = 'ALTFEL:';
        row.appendChild(elseLbl);
        const elseBody = document.createElement('div');
        elseBody.className = 'tabla-nested';
        this.renderList(elseBody, node.elseBody, [...path, { index: i, slot: 'elseBody' }], depth + 1);
        row.appendChild(elseBody);
      }

      dropzone.appendChild(row);
    });

    container.appendChild(dropzone);
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
