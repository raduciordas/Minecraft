import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as Ro from 'blockly/msg/ro';
import { pythonGenerator } from 'blockly/python';
import type { ProgramNode, VatraPuzzle } from '../vatra/VatraPuzzles';

// SPIKE — Blockly-backed alternative to TablaPanel, wired to one lesson
// (Câmpul de grâu) so the two editors can be compared side by side on the
// same puzzle. Everything downstream is untouched: this converts the
// Blockly workspace into the same ProgramNode[] tree the hand-rolled
// editor produces, so VatraModule grades it identically.

export const STEP_MS = 1100;
const LOOP_STEP_MS = 35;
const MAX_WHILE_DEMO = 5;
const MAX_REPEAT_ANIM = 150;

export interface BlocklyCallbacks {
  onRunStart: (puzzleId: string) => void;
  onStep: (puzzleId: string, blockId: string) => void;
  onFinish: (puzzleId: string, program: ProgramNode[]) => { success: boolean; text: string };
  onRequestClose: () => void;
  isDone: (puzzleId: string) => boolean;
  onResetLesson: (puzzleId: string) => void;
}

Blockly.setLocale(Ro as unknown as { [key: string]: string });

// Debug handle for the browser console, mirroring window.__game
(window as unknown as { Blockly: typeof Blockly }).Blockly = Blockly;

// Wooden-tablet skin, matching the Tabla de Blocuri palette so the Blockly
// version still reads as an object from the village, not a generic IDE.
const VATRA_THEME = Blockly.Theme.defineTheme('vatra', {
  name: 'vatra',
  base: Blockly.Themes.Classic,
  blockStyles: {
    vatra_action: { colourPrimary: '#caa06a', colourSecondary: '#e8c88f', colourTertiary: '#4a2f16' },
    // Built-in style names, so Blockly's own controls_repeat_ext picks up the
    // village palette instead of shipping Blockly-green into the scene
    loop_blocks: { colourPrimary: '#7a9fca', colourSecondary: '#cdd9e8', colourTertiary: '#2f5f8a' },
    logic_blocks: { colourPrimary: '#7a9fca', colourSecondary: '#cdd9e8', colourTertiary: '#2f5f8a' },
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
    insertionMarkerOpacity: 0.6,
    cursorColour: '#ffe14d',
  },
  fontStyle: { family: 'monospace', weight: 'bold', size: 11 },
  startHats: true,
});

let blocksDefined = false;

// Turns a puzzle's action list into one Blockly block per action, the same
// way the hand-rolled palette does — content stays data, not code.
function defineBlocksFor(puzzle: VatraPuzzle): void {
  if (blocksDefined) return;
  blocksDefined = true;

  const defs = puzzle.actions.map((a) => ({
    type: `vatra_${a.id}`,
    message0: a.label,
    previousStatement: null,
    nextStatement: null,
    style: 'vatra_action',
  }));
  Blockly.common.defineBlocksWithJsonArray(defs);

  // Python generators, so the "Vezi codul adevărat" panel has something to
  // show — this is the payoff of Blockly shipping generators for free.
  for (const a of puzzle.actions) {
    pythonGenerator.forBlock[`vatra_${a.id}`] = () => `${a.id}()\n`;
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
  private statusEl!: HTMLElement;
  private codeEl!: HTMLElement;
  private runBtn!: HTMLButtonElement;
  private nodeIds = new Map<ProgramNode, string>();

  constructor(
    container: HTMLElement,
    private cb: BlocklyCallbacks,
  ) {
    this.root = container;
    this.buildChrome();
  }

  private buildChrome(): void {
    this.panel = document.createElement('div');
    this.panel.className = 'tabla-panel bl-panel';

    const title = document.createElement('div');
    title.className = 'tabla-title';
    const titleText = document.createElement('span');
    titleText.className = 'bl-title-text';
    title.appendChild(titleText);
    const badge = document.createElement('span');
    badge.className = 'bl-badge';
    badge.textContent = 'BLOCKLY';
    title.appendChild(badge);
    const close = document.createElement('span');
    close.className = 'tabla-close';
    close.textContent = '✕';
    close.addEventListener('click', () => {
      if (!this.running) this.cb.onRequestClose();
    });
    title.appendChild(close);
    this.panel.appendChild(title);

    const intro = document.createElement('div');
    intro.className = 'tabla-intro bl-intro';
    this.panel.appendChild(intro);

    this.blocklyDiv = document.createElement('div');
    this.blocklyDiv.className = 'bl-workspace';
    this.panel.appendChild(this.blocklyDiv);

    const codeWrap = document.createElement('details');
    codeWrap.className = 'bl-code';
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
    this.runBtn.addEventListener('click', () => void this.run());
    actions.appendChild(this.runBtn);
    const reset = document.createElement('button');
    reset.className = 'tabla-reset';
    reset.textContent = 'Șterge tot';
    reset.addEventListener('click', () => {
      if (this.running) return;
      this.workspace?.clear();
      this.status = null;
      this.refresh();
    });
    actions.appendChild(reset);
    const relearn = document.createElement('button');
    relearn.className = 'tabla-relearn bl-relearn';
    relearn.textContent = '↺ Resetează lecția';
    relearn.addEventListener('click', () => {
      if (this.running || !this.puzzle) return;
      this.cb.onResetLesson(this.puzzle.id);
      this.workspace?.clear();
      this.status = { text: 'Lecția a fost resetată — poți s-o iei de la capăt!', ok: true };
      this.refresh();
    });
    actions.appendChild(relearn);
    this.panel.appendChild(actions);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'tabla-status';
    this.panel.appendChild(this.statusEl);

    this.root.appendChild(this.panel);
    this.titleText = titleText;
    this.introEl = intro;
    this.relearnBtn = relearn;
  }

  private titleText!: HTMLElement;
  private introEl!: HTMLElement;
  private relearnBtn!: HTMLButtonElement;

  open(puzzle: VatraPuzzle): void {
    this.puzzle = puzzle;
    this.running = false;
    this.status = null;
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.titleText.textContent = puzzle.title;
    this.introEl.textContent = puzzle.intro;

    defineBlocksFor(puzzle);

    if (!this.workspace) {
      this.workspace = Blockly.inject(this.blocklyDiv, {
        toolbox: this.buildToolbox(puzzle),
        theme: VATRA_THEME,
        // Blockly otherwise pulls sprites and sounds from static.blockly.com
        // on every open — vendored into public/ so the game stays offline-
        // capable and sends nothing to a third party.
        media: 'blockly-media/',
        renderer: 'zelos', // the chunky Scratch-like renderer, best for kids/touch
        trashcan: false,
        move: { scrollbars: true, drag: true, wheel: true },
        zoom: { controls: true, wheel: false, startScale: 0.95, minScale: 0.6, maxScale: 1.4 },
        grid: { spacing: 22, length: 2, colour: 'rgba(74,47,22,0.25)', snap: false },
      });
      this.workspace.addChangeListener(() => {
        if (!this.running) this.refresh();
      });
    } else {
      this.workspace.updateToolbox(this.buildToolbox(puzzle));
      this.workspace.clear();
    }
    // The div was display:none until now, so Blockly measured it as 0×0
    requestAnimationFrame(() => this.workspace && Blockly.svgResize(this.workspace));
    this.refresh();
  }

  close(): void {
    this.isOpen = false;
    this.running = false;
    this.root.classList.add('hidden');
  }

  private buildToolbox(puzzle: VatraPuzzle): Blockly.utils.toolbox.ToolboxDefinition {
    const contents: Blockly.utils.toolbox.ToolboxItemInfo[] = puzzle.actions.map((a) => ({
      kind: 'block',
      type: `vatra_${a.id}`,
    }));
    if (puzzle.allowRepeat) {
      contents.push({
        kind: 'block',
        type: 'controls_repeat_ext',
        inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 4 } } } },
      } as Blockly.utils.toolbox.ToolboxItemInfo);
    }
    // On a wide screen the palette stays permanently open on the left. On a
    // phone that flyout would eat most of the width, so there we fall back to
    // Blockly's category toolbox: a narrow strip of buttons whose flyout
    // opens over the canvas on demand and closes after a drag.
    if (window.innerWidth < 720) {
      return {
        kind: 'categoryToolbox',
        contents: [
          {
            kind: 'category',
            name: 'Acțiuni',
            colour: '#caa06a',
            contents: contents.filter((c) => (c as { type?: string }).type?.startsWith('vatra_')),
          },
          {
            kind: 'category',
            name: 'Control',
            colour: '#7a9fca',
            contents: contents.filter((c) => !(c as { type?: string }).type?.startsWith('vatra_')),
          },
        ],
      } as Blockly.utils.toolbox.ToolboxDefinition;
    }
    return { kind: 'flyoutToolbox', contents };
  }

  // ---- Blockly workspace -> the same ProgramNode[] the other editor makes

  private toProgram(): ProgramNode[] {
    this.nodeIds.clear();
    if (!this.workspace) return [];
    const tops = this.workspace.getTopBlocks(true).filter((b) => !b.isShadow());
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
    if (b.type === 'controls_repeat_ext' || b.type === 'controls_repeat') {
      const timesBlock = b.getInputTargetBlock('TIMES');
      const raw = timesBlock ? timesBlock.getFieldValue('NUM') : b.getFieldValue('TIMES');
      const count = Math.max(1, Math.floor(Number(raw) || 1));
      return { kind: 'repeat', count, body: this.chainToNodes(b.getInputTargetBlock('DO')) };
    }
    if (b.type.startsWith('vatra_')) {
      return { kind: 'action', id: b.type.slice('vatra_'.length) };
    }
    return null;
  }

  private refresh(): void {
    const program = this.toProgram();
    this.runBtn.disabled = this.running || program.length === 0;
    this.runBtn.textContent = this.running ? 'Rulează…' : '▶ Pornește';
    this.relearnBtn.disabled = this.running || !this.puzzle || !this.cb.isDone(this.puzzle.id);
    this.statusEl.className = 'tabla-status' + (this.status ? (this.status.ok ? ' ok' : ' bad') : '');
    this.statusEl.textContent = this.status?.text ?? '';
    if (this.workspace) {
      const code = pythonGenerator.workspaceToCode(this.workspace).trim();
      this.codeEl.textContent = code || '# (încă niciun bloc)';
    }
  }

  // ---- execution, mirroring TablaPanel's semantics

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
        await new Promise((r) => setTimeout(r, 400));
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
    if (!this.isOpen) return;
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
