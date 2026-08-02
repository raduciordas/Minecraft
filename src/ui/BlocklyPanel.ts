import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as Ro from 'blockly/msg/ro';
import { pythonGenerator } from 'blockly/python';
import { VATRA_PUZZLES, rewardWhen, type ProgramNode, type VatraPuzzle } from '../vatra/VatraPuzzles';

// Tabla de Blocuri — the block editor of Satul Codat, built on Blockly.
// Palette on the left, program canvas on the right; repeat/while/if are
// containers that hold any number of other blocks, nested freely. Blockly
// gives us Romanian out of the box, touch dragging, and a Python generator
// for the "Vezi codul adevărat" panel.
//
// Whatever the child builds is converted into a ProgramNode[] tree, which
// is what VatraModule grades — the editor is replaceable, the puzzle model
// is not.

export const STEP_MS = 1100; // a top-level/branch block's beat while executing
const LOOP_STEP_MS = 35; // loop bodies run at the computer's speed, not yours
const MAX_WHILE_DEMO = 5; // a "forever" loop still demos as a finite animation
const MAX_REPEAT_ANIM = 150; // caps a mistyped huge count from freezing the run

export interface BlocklyCallbacks {
  onRunStart: (puzzleId: string) => void;
  onStep: (puzzleId: string, blockId: string) => void;
  onFinish: (puzzleId: string, program: ProgramNode[]) => { success: boolean; text: string };
  onRequestClose: () => void;
  isDone: (puzzleId: string) => boolean;
  onResetLesson: (puzzleId: string) => void;
  onActivity: () => void; // any sign of life at the tabla, for the idle timeout
}

Blockly.setLocale(Ro as unknown as { [key: string]: string });

// Debug handle for the browser console, mirroring window.__game
(window as unknown as { Blockly: typeof Blockly }).Blockly = Blockly;

// Block type names are global in Blockly, and two lessons may reuse an
// action id with different wording ('canta' is a song at the well and an
// anvil tune at the forge), so every type is namespaced by lesson.
const actionType = (puzzleId: string, actionId: string) => `vatra_${puzzleId}__${actionId}`;
const condType = (puzzleId: string, condId: string) => `cond_${puzzleId}__${condId}`;
const idFromType = (type: string) => type.slice(type.indexOf('__') + 2);

const REPEAT = 'controls_repeat_ext';
const WHILE = 'vatra_while';
const IF = 'vatra_if';

// Wooden-tablet skin, so the editor still reads as an object from the
// village rather than a generic IDE dropped on top of the game.
const VATRA_THEME = Blockly.Theme.defineTheme('vatra', {
  name: 'vatra',
  base: Blockly.Themes.Classic,
  blockStyles: {
    vatra_action: { colourPrimary: '#caa06a', colourSecondary: '#e8c88f', colourTertiary: '#4a2f16' },
    vatra_control: { colourPrimary: '#7a9fca', colourSecondary: '#cdd9e8', colourTertiary: '#2f5f8a' },
    vatra_cond: { colourPrimary: '#8ab87a', colourSecondary: '#c4e0b8', colourTertiary: '#3f7d2c' },
    // Blockly's own built-in styles, so stock blocks match the village too
    loop_blocks: { colourPrimary: '#7a9fca', colourSecondary: '#cdd9e8', colourTertiary: '#2f5f8a' },
    logic_blocks: { colourPrimary: '#8ab87a', colourSecondary: '#c4e0b8', colourTertiary: '#3f7d2c' },
    math_blocks: { colourPrimary: '#a07a4a', colourSecondary: '#caa06a', colourTertiary: '#4a2f16' },
  },
  componentStyles: {
    workspaceBackgroundColour: '#9a6f3f',
    toolboxBackgroundColour: '#7d5730',
    toolboxForegroundColour: '#f2e6d0',
    flyoutBackgroundColour: '#8a5f33',
    flyoutForegroundColour: '#f2e6d0',
    flyoutOpacity: 1,
    scrollbarColour: '#4a2f16',
    insertionMarkerColour: '#ffe14d',
    insertionMarkerOpacity: 0.7,
    cursorColour: '#ffe14d',
  },
  fontStyle: { family: 'monospace', weight: 'bold', size: 11 },
  startHats: true,
});

let blocksDefined = false;

// Defines one Blockly block per action and per condition across every
// lesson, plus the two custom containers. Content stays data: adding a
// lesson to VATRA_PUZZLES is enough, no block code to write.
function defineAllBlocks(): void {
  if (blocksDefined) return;
  blocksDefined = true;

  const defs: object[] = [
    {
      type: WHILE,
      message0: 'cât timp %1',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
      message1: 'fă %1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      style: 'vatra_control',
    },
    {
      type: IF,
      message0: 'dacă %1',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
      message1: 'atunci %1',
      args1: [{ type: 'input_statement', name: 'DO' }],
      message2: 'altfel %1',
      args2: [{ type: 'input_statement', name: 'ELSE' }],
      previousStatement: null,
      nextStatement: null,
      style: 'vatra_control',
    },
  ];

  for (const puzzle of Object.values(VATRA_PUZZLES)) {
    for (const a of puzzle.actions) {
      defs.push({
        type: actionType(puzzle.id, a.id),
        message0: a.label,
        previousStatement: null,
        nextStatement: null,
        style: 'vatra_action',
      });
    }
    for (const c of puzzle.conditions ?? []) {
      defs.push({
        type: condType(puzzle.id, c.id),
        message0: c.label,
        output: 'Boolean',
        style: 'vatra_cond',
      });
    }
  }
  Blockly.common.defineBlocksWithJsonArray(defs as never);

  // Python generators — this is what feeds the "Vezi codul adevărat" panel
  const P = pythonGenerator;
  P.forBlock[WHILE] = (block, gen) => {
    const cond = gen.valueToCode(block, 'COND', 0) || 'False';
    const body = gen.statementToCode(block, 'DO') || gen.INDENT + 'pass\n';
    return `while ${cond}:\n${body}`;
  };
  P.forBlock[IF] = (block, gen) => {
    const cond = gen.valueToCode(block, 'COND', 0) || 'False';
    const body = gen.statementToCode(block, 'DO') || gen.INDENT + 'pass\n';
    const elseBody = gen.statementToCode(block, 'ELSE');
    return `if ${cond}:\n${body}` + (elseBody ? `else:\n${elseBody}` : '');
  };
  for (const puzzle of Object.values(VATRA_PUZZLES)) {
    for (const a of puzzle.actions) {
      P.forBlock[actionType(puzzle.id, a.id)] = () => `${a.id}()\n`;
    }
    for (const c of puzzle.conditions ?? []) {
      P.forBlock[condType(puzzle.id, c.id)] = () => [c.id, 0] as [string, number];
    }
  }
}

export class BlocklyPanel {
  isOpen = false;
  private puzzle: VatraPuzzle | null = null;
  private workspace: Blockly.WorkspaceSvg | null = null;
  private running = false;
  private status: { text: string; ok: boolean } | null = null;
  private root: HTMLElement;
  private panel!: HTMLElement;
  private blocklyDiv!: HTMLElement;
  private titleText!: HTMLElement;
  private introEl!: HTMLElement;
  private rewardEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private codeEl!: HTMLElement;
  private runBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private relearnBtn!: HTMLButtonElement;
  private nodeIds = new Map<ProgramNode, string>();

  constructor(
    container: HTMLElement,
    private cb: BlocklyCallbacks,
  ) {
    this.root = container;
    this.root.innerHTML = '';
    defineAllBlocks();
    this.buildChrome();
  }

  private buildChrome(): void {
    this.panel = document.createElement('div');
    this.panel.className = 'tabla-panel';

    const title = document.createElement('div');
    title.className = 'tabla-title';
    this.titleText = document.createElement('span');
    title.appendChild(this.titleText);
    const close = document.createElement('span');
    close.className = 'tabla-close';
    close.textContent = '✕';
    close.addEventListener('click', () => {
      if (!this.running) this.cb.onRequestClose();
    });
    title.appendChild(close);
    this.panel.appendChild(title);

    this.introEl = document.createElement('div');
    this.introEl.className = 'tabla-intro';
    this.panel.appendChild(this.introEl);

    this.rewardEl = document.createElement('div');
    this.rewardEl.className = 'tabla-reward';
    this.panel.appendChild(this.rewardEl);

    this.blocklyDiv = document.createElement('div');
    this.blocklyDiv.className = 'tabla-workspace';
    this.panel.appendChild(this.blocklyDiv);

    const codeWrap = document.createElement('details');
    codeWrap.className = 'tabla-code';
    const summary = document.createElement('summary');
    summary.textContent = '🐍 Vezi codul adevărat (Python)';
    codeWrap.appendChild(summary);
    this.codeEl = document.createElement('pre');
    codeWrap.appendChild(this.codeEl);
    this.panel.appendChild(codeWrap);

    const actions = document.createElement('div');
    actions.className = 'tabla-actions';
    this.runBtn = document.createElement('button');
    this.runBtn.className = 'tabla-run';
    this.runBtn.textContent = '▶ Pornește';
    this.runBtn.addEventListener('click', () => {
      this.cb.onActivity();
      void this.run();
    });
    actions.appendChild(this.runBtn);

    this.resetBtn = document.createElement('button');
    this.resetBtn.className = 'tabla-reset';
    this.resetBtn.textContent = 'Șterge tot';
    this.resetBtn.addEventListener('click', () => {
      if (this.running) return;
      this.workspace?.clear();
      this.status = null;
      this.refresh();
    });
    actions.appendChild(this.resetBtn);

    this.relearnBtn = document.createElement('button');
    this.relearnBtn.className = 'tabla-relearn';
    this.relearnBtn.textContent = '↺ Resetează lecția';
    this.relearnBtn.title = 'Reia lecția de la capăt — o poți rezolva din nou, pentru răsplată din nou';
    this.relearnBtn.addEventListener('click', () => {
      this.cb.onActivity();
      if (this.running || !this.puzzle) return;
      this.cb.onResetLesson(this.puzzle.id);
      this.workspace?.clear();
      this.status = { text: 'Lecția a fost resetată — poți s-o iei de la capăt, ca prima dată!', ok: true };
      this.refresh();
    });
    actions.appendChild(this.relearnBtn);
    this.panel.appendChild(actions);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'tabla-status';
    this.panel.appendChild(this.statusEl);

    this.root.appendChild(this.panel);
  }

  open(puzzle: VatraPuzzle): void {
    this.puzzle = puzzle;
    this.running = false;
    this.status = null;
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.titleText.textContent = puzzle.title;
    this.introEl.textContent = puzzle.intro;
    this.rewardEl.innerHTML = '';
    const rewardLabel = document.createElement('b');
    rewardLabel.textContent = '🎁 Răsplată: ';
    this.rewardEl.appendChild(rewardLabel);
    this.rewardEl.appendChild(document.createTextNode(`${puzzle.reward} `));
    const rewardWhenEl = document.createElement('span');
    rewardWhenEl.className = 'reward-when';
    rewardWhenEl.textContent = `(${rewardWhen(puzzle)})`;
    this.rewardEl.appendChild(rewardWhenEl);

    const narrow = window.innerWidth < 720;
    if (!this.workspace) {
      this.workspace = Blockly.inject(this.blocklyDiv, {
        toolbox: this.buildToolbox(puzzle),
        theme: VATRA_THEME,
        renderer: 'zelos', // chunky Scratch-like blocks, best for kids and touch
        // Blockly otherwise pulls sprites and sounds from static.blockly.com
        // on every open; vendored into public/ so the game stays offline-
        // capable and sends nothing to a third party.
        media: 'blockly-media/',
        trashcan: false,
        move: { scrollbars: true, drag: true, wheel: true },
        zoom: {
          controls: true,
          wheel: false,
          startScale: narrow ? 0.65 : 0.95,
          minScale: 0.4,
          maxScale: 1.4,
        },
        grid: { spacing: 22, length: 2, colour: 'rgba(74,47,22,0.25)', snap: false },
      });
      this.workspace.addChangeListener((e) => {
        // UI-only events (scroll, selection) fire constantly; only real edits
        // count as the player still being at the tabla
        if (!e.isUiEvent) this.cb.onActivity();
        if (!this.running) this.refresh();
      });
    } else {
      this.workspace.updateToolbox(this.buildToolbox(puzzle));
      this.workspace.clear();
      this.workspace.setScale(narrow ? 0.65 : 0.95);
    }
    // The container was display:none until now, so Blockly measured it as 0×0
    requestAnimationFrame(() => {
      if (this.workspace) Blockly.svgResize(this.workspace);
    });
    this.refresh();
  }

  close(): void {
    this.isOpen = false;
    this.running = false;
    this.root.classList.add('hidden');
  }

  private buildToolbox(puzzle: VatraPuzzle): Blockly.utils.toolbox.ToolboxDefinition {
    type Item = Blockly.utils.toolbox.ToolboxItemInfo;
    const actions: Item[] = puzzle.actions.map((a) => ({ kind: 'block', type: actionType(puzzle.id, a.id) }));
    const control: Item[] = [];
    if (puzzle.allowRepeat) {
      control.push({
        kind: 'block',
        type: REPEAT,
        inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 4 } } } },
      } as Item);
    }
    if (puzzle.allowWhile) control.push({ kind: 'block', type: WHILE });
    if (puzzle.allowIf) control.push({ kind: 'block', type: IF });
    const conds: Item[] = (puzzle.conditions ?? []).map((c) => ({
      kind: 'block',
      type: condType(puzzle.id, c.id),
    }));

    // On a phone a permanently-open flyout would eat most of the width, so
    // there we use category buttons whose flyout opens over the canvas and
    // closes after a drag. On a wide screen the palette just stays open.
    if (window.innerWidth < 720) {
      const cats: Item[] = [{ kind: 'category', name: 'Acțiuni', colour: '#caa06a', contents: actions } as Item];
      if (control.length) cats.push({ kind: 'category', name: 'Control', colour: '#7a9fca', contents: control } as Item);
      if (conds.length) cats.push({ kind: 'category', name: 'Condiții', colour: '#8ab87a', contents: conds } as Item);
      return { kind: 'categoryToolbox', contents: cats } as Blockly.utils.toolbox.ToolboxDefinition;
    }
    const flat: Item[] = [...actions];
    if (control.length) flat.push({ kind: 'sep', gap: 16 } as Item, ...control);
    if (conds.length) flat.push({ kind: 'sep', gap: 16 } as Item, ...conds);
    return { kind: 'flyoutToolbox', contents: flat };
  }

  // ---- Blockly workspace -> the ProgramNode[] tree VatraModule grades

  private toProgram(): ProgramNode[] {
    this.nodeIds.clear();
    if (!this.workspace || !this.puzzle) return [];
    const tops = this.workspace.getTopBlocks(true).filter((b) => !b.isShadow() && b.previousConnection);
    if (tops.length === 0) return [];
    return this.chainToNodes(tops[0]);
  }

  private chainToNodes(first: Blockly.Block | null): ProgramNode[] {
    const out: ProgramNode[] = [];
    let b = first;
    while (b) {
      const node = this.blockToNode(b);
      if (node) {
        out.push(node);
        this.nodeIds.set(node, b.id);
      }
      b = b.getNextBlock();
    }
    return out;
  }

  private blockToNode(b: Blockly.Block): ProgramNode | null {
    if (b.type === REPEAT || b.type === 'controls_repeat') {
      const timesBlock = b.getInputTargetBlock('TIMES');
      const raw = timesBlock ? timesBlock.getFieldValue('NUM') : b.getFieldValue('TIMES');
      const count = Math.max(1, Math.floor(Number(raw) || 1));
      return { kind: 'repeat', count, body: this.chainToNodes(b.getInputTargetBlock('DO')) };
    }
    if (b.type === WHILE) {
      return {
        kind: 'while',
        cond: this.condIdOf(b),
        body: this.chainToNodes(b.getInputTargetBlock('DO')),
      };
    }
    if (b.type === IF) {
      return {
        kind: 'if',
        cond: this.condIdOf(b),
        body: this.chainToNodes(b.getInputTargetBlock('DO')),
        elseBody: this.chainToNodes(b.getInputTargetBlock('ELSE')),
      };
    }
    if (b.type.startsWith(`vatra_${this.puzzle!.id}__`)) {
      return { kind: 'action', id: idFromType(b.type) };
    }
    return null;
  }

  // An empty condition socket yields '', which matches no solution — the
  // child gets the lesson's fail text rather than a silent wrong answer.
  private condIdOf(b: Blockly.Block): string {
    const c = b.getInputTargetBlock('COND');
    return c && c.type.startsWith('cond_') ? idFromType(c.type) : '';
  }

  private refresh(): void {
    const program = this.toProgram();
    this.runBtn.disabled = this.running || program.length === 0;
    this.runBtn.textContent = this.running ? 'Rulează…' : '▶ Pornește';
    this.resetBtn.disabled = this.running;
    this.relearnBtn.disabled = this.running || !this.puzzle || !this.cb.isDone(this.puzzle.id);
    this.statusEl.className = 'tabla-status' + (this.status ? (this.status.ok ? ' ok' : ' bad') : '');
    this.statusEl.textContent = this.status?.text ?? '';
    if (this.workspace) {
      const code = pythonGenerator.workspaceToCode(this.workspace).trim();
      this.codeEl.textContent = code || '# (încă niciun bloc)';
    }
  }

  // ---- step-by-step execution, highlighting each block as it runs

  private async runList(nodes: ProgramNode[], stepMs: number): Promise<boolean> {
    for (const node of nodes) {
      if (!this.isOpen) return false;
      const id = this.nodeIds.get(node);
      if (id) this.workspace?.highlightBlock(id);
      if (node.kind === 'action') {
        this.cb.onStep(this.puzzle!.id, node.id);
        await new Promise((r) => setTimeout(r, stepMs));
      } else if (node.kind === 'repeat') {
        const n = Math.min(Math.max(node.count, 0), MAX_REPEAT_ANIM);
        for (let i = 0; i < n; i++) {
          if (!(await this.runList(node.body, LOOP_STEP_MS))) return false;
        }
      } else if (node.kind === 'while') {
        for (let i = 0; i < MAX_WHILE_DEMO; i++) {
          if (!(await this.runList(node.body, LOOP_STEP_MS))) return false;
        }
      } else if (node.kind === 'if') {
        await new Promise((r) => setTimeout(r, 400)); // a beat to show the condition being checked
        if (!(await this.runList(node.body, stepMs))) return false;
        if (node.elseBody.length && !(await this.runList(node.elseBody, stepMs))) return false;
      }
    }
    return true;
  }

  private async run(): Promise<void> {
    if (!this.puzzle || this.running) return;
    const program = this.toProgram();
    if (program.length === 0) return;
    this.running = true;
    this.status = null;
    this.refresh();

    this.cb.onRunStart(this.puzzle.id);
    const completed = await this.runList(program, STEP_MS);
    this.workspace?.highlightBlock(null);
    if (!this.isOpen) return; // closed mid-run — abort quietly
    if (!completed) {
      this.running = false;
      this.refresh();
      return;
    }

    const result = this.cb.onFinish(this.puzzle.id, program);
    this.running = false;
    this.status = { text: result.text, ok: result.success };
    this.refresh();
  }
}
