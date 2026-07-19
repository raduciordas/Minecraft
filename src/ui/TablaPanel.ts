import type { VatraPuzzle } from '../vatra/VatraPuzzles';

export const STEP_MS = 1100; // how long each program block stays highlighted while executing

export interface TablaCallbacks {
  onRunStart: (puzzleId: string) => void;
  onStep: (puzzleId: string, blockId: string) => void;
  onFinish: (puzzleId: string, program: string[]) => { success: boolean; text: string };
  onRequestClose: () => void;
}

// Tabla de Blocuri: the diegetic wooden-tablet block editor of Satul Codat.
// Tap palette chips to append commands, reorder/remove them, then run —
// each block highlights in sync with the 3D animation (visible step-by-step
// execution), and the verdict (success or scripted comic fail) lands below.
export class TablaPanel {
  isOpen = false;
  private puzzle: VatraPuzzle | null = null;
  private program: string[] = [];
  private running = false;
  private status: { text: string; ok: boolean } | null = null;
  private root: HTMLElement;
  private panel: HTMLElement;
  private rowEls: HTMLElement[] = [];

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

  private remaining(blockId: string): number {
    const def = this.puzzle!.palette.find((b) => b.id === blockId)!;
    return def.copies - this.program.filter((id) => id === blockId).length;
  }

  private label(blockId: string): string {
    return this.puzzle!.palette.find((b) => b.id === blockId)!.label;
  }

  private render(): void {
    if (!this.puzzle) return;
    const p = this.puzzle;
    this.panel.innerHTML = '';
    this.rowEls = [];

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
    palTitle.textContent = 'Blocuri de poruncă — apasă ca să adaugi';
    this.panel.appendChild(palTitle);

    const palette = document.createElement('div');
    palette.className = 'tabla-palette';
    for (const block of p.palette) {
      const chip = document.createElement('button');
      chip.className = 'tabla-chip';
      const left = this.remaining(block.id);
      chip.textContent = block.copies > 1 ? `${block.label} (${left})` : block.label;
      chip.disabled = this.running || left <= 0;
      chip.addEventListener('click', () => {
        this.program.push(block.id);
        this.status = null;
        this.render();
      });
      palette.appendChild(chip);
    }
    this.panel.appendChild(palette);

    const progTitle = document.createElement('div');
    progTitle.className = 'tabla-sec';
    progTitle.textContent = 'Programul tău';
    this.panel.appendChild(progTitle);

    const prog = document.createElement('div');
    prog.className = 'tabla-program';
    if (this.program.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tabla-empty';
      empty.textContent = '— tăblița e goală —';
      prog.appendChild(empty);
    }
    this.program.forEach((blockId, i) => {
      const row = document.createElement('div');
      row.className = 'tabla-row';
      const idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = `${i + 1}.`;
      row.appendChild(idx);
      const name = document.createElement('span');
      name.textContent = this.label(blockId);
      row.appendChild(name);

      const controls = document.createElement('span');
      controls.className = 'tabla-row-btns';
      const mk = (txt: string, fn: () => void, disabled: boolean) => {
        const b = document.createElement('button');
        b.textContent = txt;
        b.disabled = disabled || this.running;
        b.addEventListener('click', fn);
        controls.appendChild(b);
      };
      mk('↑', () => {
        [this.program[i - 1], this.program[i]] = [this.program[i], this.program[i - 1]];
        this.render();
      }, i === 0);
      mk('↓', () => {
        [this.program[i + 1], this.program[i]] = [this.program[i], this.program[i + 1]];
        this.render();
      }, i === this.program.length - 1);
      mk('✕', () => {
        this.program.splice(i, 1);
        this.status = null;
        this.render();
      }, false);
      row.appendChild(controls);

      prog.appendChild(row);
      this.rowEls.push(row);
    });
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
      this.status = null;
      this.render();
    });
    actions.appendChild(reset);
    this.panel.appendChild(actions);

    const status = document.createElement('div');
    status.className = 'tabla-status' + (this.status ? (this.status.ok ? ' ok' : ' bad') : '');
    status.textContent = this.status?.text ?? '';
    this.panel.appendChild(status);
  }

  // Step-by-step execution: highlight each block while its animation plays
  private async run(): Promise<void> {
    if (!this.puzzle || this.running || this.program.length === 0) return;
    const puzzle = this.puzzle;
    const program = [...this.program];
    this.running = true;
    this.status = null;
    this.render();

    this.cb.onRunStart(puzzle.id);
    for (let i = 0; i < program.length; i++) {
      if (!this.isOpen) return; // closed mid-run — abort quietly
      this.rowEls.forEach((r, ri) => r.classList.toggle('running', ri === i));
      this.cb.onStep(puzzle.id, program[i]);
      await new Promise((r) => setTimeout(r, STEP_MS));
    }
    if (!this.isOpen) return;
    this.rowEls.forEach((r) => r.classList.remove('running'));

    const result = this.cb.onFinish(puzzle.id, program);
    this.running = false;
    this.status = { text: result.text, ok: result.success };
    this.render();
  }
}
