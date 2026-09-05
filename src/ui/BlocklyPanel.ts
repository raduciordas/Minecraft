import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as Ro from 'blockly/msg/ro';
import { pythonGenerator } from 'blockly/python';
import {
  VATRA_PUZZLES,
  rewardWhen,
  type Cond,
  type Expr,
  type ProgramNode,
  type VatraPuzzle,
} from '../vatra/VatraPuzzles';
import { execute } from '../vatra/Interpreter';

// Tabla de Blocuri — the block editor of Satul Codat, built on Blockly.
// Palette on the left, program canvas on the right; repeat/while/if are
// containers that hold any number of other blocks, nested freely. Later
// lessons add Blockly's own variable, logic, number and procedure blocks,
// plus two of ours: the "când se întâmplă…" hat and per-lesson sensors.
// Blockly gives us Romanian out of the box, touch dragging, and a Python
// generator for the "Vezi codul adevărat" panel.
//
// Whatever the child builds is converted into a ProgramNode[] tree, which
// is what VatraModule grades — the editor is replaceable, the puzzle model
// is not. The same Interpreter that grades it also drives the animation.

export const STEP_MS = 1100; // a top-level/branch block's beat while executing
const LOOP_STEP_MS = 35; // loop bodies run at the computer's speed, not yours
const SCENARIO_PAUSE_MS = 900; // a breath between "Încercarea 1" and "Încercarea 2"
const EVENT_PAUSE_MS = 700;

export interface BlocklyCallbacks {
  onRunStart: (puzzleId: string) => void;
  // A lesson with several scenarios runs the program once per scenario;
  // the world resets between them and may be tinted (night, flood…)
  onScenario: (puzzleId: string, label: string, index: number, total: number) => void;
  onStep: (puzzleId: string, blockId: string, arg?: number) => void;
  onEvent: (puzzleId: string, eventId: string) => void;
  onRunEnd: (puzzleId: string) => void;
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
const sensorType = (puzzleId: string, sensorId: string) => `sensor_${puzzleId}__${sensorId}`;
const whenType = (puzzleId: string) => `when_${puzzleId}`;
const idFromType = (type: string) => type.slice(type.indexOf('__') + 2);

const REPEAT = 'controls_repeat_ext';
const WHILE = 'vatra_while';
const IF = 'vatra_if';
const DEFINE = 'procedures_defnoreturn';
const CALL = 'procedures_callnoreturn';

const NUM_SHADOW = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });

// Wooden-tablet skin, so the editor still reads as an object from the
// village rather than a generic IDE dropped on top of the game.
const VATRA_THEME = Blockly.Theme.defineTheme('vatra', {
  name: 'vatra',
  base: Blockly.Themes.Classic,
  blockStyles: {
    vatra_action: { colourPrimary: '#caa06a', colourSecondary: '#e8c88f', colourTertiary: '#4a2f16' },
    vatra_control: { colourPrimary: '#7a9fca', colourSecondary: '#cdd9e8', colourTertiary: '#2f5f8a' },
    vatra_cond: { colourPrimary: '#8ab87a', colourSecondary: '#c4e0b8', colourTertiary: '#3f7d2c' },
    vatra_sensor: { colourPrimary: '#5aa7a0', colourSecondary: '#b8dedb', colourTertiary: '#2c6b66' },
    vatra_event: { colourPrimary: '#d08a3a', colourSecondary: '#ecc79a', colourTertiary: '#7a4a12' },
    // Blockly's own built-in styles, so stock blocks match the village too
    loop_blocks: { colourPrimary: '#7a9fca', colourSecondary: '#cdd9e8', colourTertiary: '#2f5f8a' },
    logic_blocks: { colourPrimary: '#8ab87a', colourSecondary: '#c4e0b8', colourTertiary: '#3f7d2c' },
    math_blocks: { colourPrimary: '#a07a4a', colourSecondary: '#caa06a', colourTertiary: '#4a2f16' },
    variable_blocks: { colourPrimary: '#b8674a', colourSecondary: '#e2b7a6', colourTertiary: '#6b2f1a' },
    variable_dynamic_blocks: { colourPrimary: '#b8674a', colourSecondary: '#e2b7a6', colourTertiary: '#6b2f1a' },
    procedure_blocks: { colourPrimary: '#8e6ab8', colourSecondary: '#cfbde4', colourTertiary: '#4e3470' },
  },
  categoryStyles: {
    actiuni: { colour: '#caa06a' },
    control: { colour: '#7a9fca' },
    conditii: { colour: '#8ab87a' },
    senzori: { colour: '#5aa7a0' },
    variabile: { colour: '#b8674a' },
    numere: { colour: '#a07a4a' },
    proceduri: { colour: '#8e6ab8' },
    evenimente: { colour: '#d08a3a' },
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

// Defines one Blockly block per action, condition, sensor and event across
// every lesson, plus our custom containers. Content stays data: adding a
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
      if (a.hasArg) {
        defs.push({
          type: actionType(puzzle.id, a.id),
          message0: a.label.includes('%1') ? a.label : `${a.label} %1`,
          args0: [{ type: 'input_value', name: 'ARG', check: 'Number' }],
          previousStatement: null,
          nextStatement: null,
          style: 'vatra_action',
        });
      } else {
        defs.push({
          type: actionType(puzzle.id, a.id),
          message0: a.label,
          previousStatement: null,
          nextStatement: null,
          style: 'vatra_action',
        });
      }
    }
    for (const c of puzzle.conditions ?? []) {
      defs.push({
        type: condType(puzzle.id, c.id),
        message0: c.label,
        output: 'Boolean',
        style: 'vatra_cond',
      });
    }
    for (const s of puzzle.sensors ?? []) {
      defs.push({
        type: sensorType(puzzle.id, s.id),
        message0: s.label,
        output: 'Number',
        style: 'vatra_sensor',
      });
    }
    if (puzzle.events && puzzle.events.length > 0) {
      defs.push({
        type: whenType(puzzle.id),
        message0: 'când %1',
        args0: [{ type: 'field_dropdown', name: 'EVENT', options: puzzle.events.map((e) => [e.label, e.id]) }],
        message1: 'fă %1',
        args1: [{ type: 'input_statement', name: 'DO' }],
        style: 'vatra_event',
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
      if (a.hasArg) {
        P.forBlock[actionType(puzzle.id, a.id)] = (block, gen) => `${a.id}(${gen.valueToCode(block, 'ARG', 0) || '0'})\n`;
      } else {
        P.forBlock[actionType(puzzle.id, a.id)] = () => `${a.id}()\n`;
      }
    }
    for (const c of puzzle.conditions ?? []) {
      P.forBlock[condType(puzzle.id, c.id)] = () => [c.id, 0] as [string, number];
    }
    for (const s of puzzle.sensors ?? []) {
      P.forBlock[sensorType(puzzle.id, s.id)] = () => [`${s.id}()`, 0] as [string, number];
    }
    if (puzzle.events && puzzle.events.length > 0) {
      P.forBlock[whenType(puzzle.id)] = (block, gen) => {
        const evt = String(block.getFieldValue('EVENT') ?? '');
        const body = gen.statementToCode(block, 'DO') || gen.INDENT + 'pass\n';
        return `@cand("${evt}")\ndef la_${evt}():\n${body}\n`;
      };
    }
  }
}

// Blockly's variable dialogs default to window.prompt/confirm, which look
// nothing like the village. This routes them through our own little panel.
function installDialogs(host: HTMLElement): void {
  const ask = (message: string, withInput: boolean, defaultValue: string, done: (v: string | null) => void) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'tabla-dialog-backdrop';
    const box = document.createElement('div');
    box.className = 'tabla-dialog';
    const text = document.createElement('div');
    text.className = 'tabla-dialog-text';
    text.textContent = message;
    box.appendChild(text);
    let input: HTMLInputElement | null = null;
    if (withInput) {
      input = document.createElement('input');
      input.className = 'tabla-dialog-input';
      input.value = defaultValue;
      input.maxLength = 24;
      box.appendChild(input);
    }
    const row = document.createElement('div');
    row.className = 'tabla-dialog-row';
    const ok = document.createElement('button');
    ok.className = 'tabla-run';
    ok.textContent = 'Gata';
    const cancel = document.createElement('button');
    cancel.className = 'tabla-reset';
    cancel.textContent = 'Renunță';
    row.appendChild(ok);
    row.appendChild(cancel);
    box.appendChild(row);
    backdrop.appendChild(box);
    host.appendChild(backdrop);
    const finish = (value: string | null) => {
      backdrop.remove();
      done(value);
    };
    ok.addEventListener('click', () => finish(input ? input.value.trim() : 'ok'));
    cancel.addEventListener('click', () => finish(null));
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(input!.value.trim());
      if (e.key === 'Escape') finish(null);
    });
    input?.focus();
    input?.select();
  };
  Blockly.dialog.setPrompt((message, defaultValue, callback) => ask(message, true, defaultValue, callback));
  Blockly.dialog.setConfirm((message, callback) => ask(message, false, '', (v) => callback(v !== null)));
  Blockly.dialog.setAlert((message, callback) => ask(message, false, '', () => callback?.()));
}

// Blockly's JSON block state, as much of it as we build
interface BlockState {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockState; shadow?: BlockState }>;
  next?: { block: BlockState };
  extraState?: unknown;
}

export class BlocklyPanel {
  isOpen = false;
  // Tests drain the animation instantly instead of waiting a second a block
  fastMode = false;
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
  private varsEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private codeEl!: HTMLElement;
  private runBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private relearnBtn!: HTMLButtonElement;
  private nodeIds = new Map<ProgramNode, string>();
  private liveVars = new Map<string, number>();

  constructor(
    container: HTMLElement,
    private cb: BlocklyCallbacks,
  ) {
    this.root = container;
    this.root.innerHTML = '';
    defineAllBlocks();
    this.buildChrome();
    installDialogs(this.panel);
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

    // Cutiuțe: the variables' live values while the program runs
    this.varsEl = document.createElement('div');
    this.varsEl.className = 'tabla-vars hidden';
    this.panel.appendChild(this.varsEl);

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
      this.clearWorkspace();
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
      this.clearWorkspace();
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
    this.liveVars.clear();
    this.renderVars();

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
      this.workspace.setScale(narrow ? 0.65 : 0.95);
    }
    this.clearWorkspace();
    if (puzzle.starterProgram) this.loadProgram(puzzle.starterProgram);
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

  // Empties the canvas and puts the lesson's named boxes back
  private clearWorkspace(): void {
    if (!this.workspace) return;
    this.workspace.clear();
    for (const name of this.puzzle?.variables ?? []) this.workspace.getVariableMap().createVariable(name, '', `var_${name}`);
  }

  // Whether the lesson needs Blockly's dynamic categories (variables and
  // procedures can only live in a category toolbox)
  private needsCategories(puzzle: VatraPuzzle): boolean {
    return !!(
      puzzle.allowVariables ||
      puzzle.allowProcedures ||
      puzzle.allowEvents ||
      puzzle.allowLogic ||
      puzzle.allowCompare ||
      puzzle.allowMath ||
      puzzle.allowRandom ||
      (puzzle.sensors && puzzle.sensors.length > 0)
    );
  }

  private buildToolbox(puzzle: VatraPuzzle): Blockly.utils.toolbox.ToolboxDefinition {
    type Item = Blockly.utils.toolbox.ToolboxItemInfo;
    const actions: Item[] = puzzle.actions.map((a) =>
      a.hasArg
        ? ({ kind: 'block', type: actionType(puzzle.id, a.id), inputs: { ARG: NUM_SHADOW(1) } } as Item)
        : ({ kind: 'block', type: actionType(puzzle.id, a.id) } as Item),
    );
    const control: Item[] = [];
    if (puzzle.allowRepeat) control.push({ kind: 'block', type: REPEAT, inputs: { TIMES: NUM_SHADOW(4) } } as Item);
    if (puzzle.allowWhile) control.push({ kind: 'block', type: WHILE });
    if (puzzle.allowIf) control.push({ kind: 'block', type: IF });
    const conds: Item[] = (puzzle.conditions ?? []).map((c) => ({
      kind: 'block',
      type: condType(puzzle.id, c.id),
    }));
    if (puzzle.allowLogic) {
      conds.push({ kind: 'block', type: 'logic_operation' } as Item, { kind: 'block', type: 'logic_negate' } as Item);
    }
    if (puzzle.allowCompare) {
      conds.push({ kind: 'block', type: 'logic_compare', inputs: { A: NUM_SHADOW(0), B: NUM_SHADOW(0) } } as Item);
    }
    const sensors: Item[] = (puzzle.sensors ?? []).map((s) => ({ kind: 'block', type: sensorType(puzzle.id, s.id) }));
    const numbers: Item[] = [];
    if (puzzle.allowMath) {
      numbers.push(
        { kind: 'block', type: 'math_number', fields: { NUM: 1 } } as Item,
        { kind: 'block', type: 'math_arithmetic', inputs: { A: NUM_SHADOW(1), B: NUM_SHADOW(1) } } as Item,
      );
    }
    if (puzzle.allowRandom) {
      numbers.push({ kind: 'block', type: 'math_random_int', inputs: { FROM: NUM_SHADOW(1), TO: NUM_SHADOW(3) } } as Item);
    }
    const events: Item[] = puzzle.allowEvents && puzzle.events?.length ? [{ kind: 'block', type: whenType(puzzle.id) }] : [];

    // On a phone a permanently-open flyout would eat most of the width, so
    // there we use category buttons whose flyout opens over the canvas and
    // closes after a drag. On a wide screen the palette just stays open —
    // unless the lesson uses boxes or procedures, whose palettes Blockly
    // can only build as categories.
    if (window.innerWidth < 720 || this.needsCategories(puzzle)) {
      const cats: Item[] = [{ kind: 'category', name: 'Acțiuni', categorystyle: 'actiuni', contents: actions } as Item];
      if (control.length) cats.push({ kind: 'category', name: 'Control', categorystyle: 'control', contents: control } as Item);
      if (conds.length) cats.push({ kind: 'category', name: 'Condiții', categorystyle: 'conditii', contents: conds } as Item);
      if (sensors.length) cats.push({ kind: 'category', name: 'Senzori', categorystyle: 'senzori', contents: sensors } as Item);
      if (puzzle.allowVariables) cats.push({ kind: 'category', name: 'Cutiuțe', categorystyle: 'variabile', custom: 'VARIABLE' } as Item);
      if (numbers.length) cats.push({ kind: 'category', name: 'Numere', categorystyle: 'numere', contents: numbers } as Item);
      if (puzzle.allowProcedures) cats.push({ kind: 'category', name: 'Proceduri', categorystyle: 'proceduri', custom: 'PROCEDURE' } as Item);
      if (events.length) cats.push({ kind: 'category', name: 'Evenimente', categorystyle: 'evenimente', contents: events } as Item);
      return { kind: 'categoryToolbox', contents: cats } as Blockly.utils.toolbox.ToolboxDefinition;
    }
    const flat: Item[] = [...actions];
    if (control.length) flat.push({ kind: 'sep', gap: 16 } as Item, ...control);
    if (conds.length) flat.push({ kind: 'sep', gap: 16 } as Item, ...conds);
    return { kind: 'flyoutToolbox', contents: flat };
  }

  // ---- Blockly workspace -> the ProgramNode[] tree VatraModule grades

  // Every top-level stack, top to bottom: statement stacks make up the main
  // program (in order), while "definește" and "când" hats become their own
  // top-level nodes. Loose value blocks lying on the canvas are ignored.
  toProgram(): ProgramNode[] {
    this.nodeIds.clear();
    if (!this.workspace || !this.puzzle) return [];
    const tops = this.workspace.getTopBlocks(true).filter((b) => !b.isShadow());
    const main: ProgramNode[] = [];
    const hats: ProgramNode[] = [];
    for (const b of tops) {
      if (b.type === DEFINE || b.type === whenType(this.puzzle.id)) {
        const node = this.blockToNode(b);
        if (node) {
          hats.push(node);
          this.nodeIds.set(node, b.id);
        }
      } else if (b.previousConnection) {
        main.push(...this.chainToNodes(b));
      }
    }
    return [...main, ...hats];
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

  private varNameOf(b: Blockly.Block, field = 'VAR'): string {
    return b.getField(field)?.getText() ?? '';
  }

  private blockToNode(b: Blockly.Block): ProgramNode | null {
    const pid = this.puzzle!.id;
    if (b.type === REPEAT || b.type === 'controls_repeat') {
      const timesBlock = b.getInputTargetBlock('TIMES');
      let count: Expr;
      if (timesBlock) count = this.exprOf(timesBlock);
      else count = Math.max(1, Math.floor(Number(b.getFieldValue('TIMES')) || 1));
      if (typeof count === 'number') count = Math.max(1, Math.floor(count));
      return { kind: 'repeat', count, body: this.chainToNodes(b.getInputTargetBlock('DO')) };
    }
    if (b.type === WHILE) {
      return { kind: 'while', cond: this.condOf(b.getInputTargetBlock('COND')), body: this.chainToNodes(b.getInputTargetBlock('DO')) };
    }
    if (b.type === IF) {
      return {
        kind: 'if',
        cond: this.condOf(b.getInputTargetBlock('COND')),
        body: this.chainToNodes(b.getInputTargetBlock('DO')),
        elseBody: this.chainToNodes(b.getInputTargetBlock('ELSE')),
      };
    }
    if (b.type === 'variables_set') {
      return { kind: 'set', name: this.varNameOf(b), value: this.exprOf(b.getInputTargetBlock('VALUE')) };
    }
    if (b.type === 'math_change') {
      return { kind: 'change', name: this.varNameOf(b), delta: this.exprOf(b.getInputTargetBlock('DELTA')) };
    }
    if (b.type === DEFINE) {
      const [name, params] = (b as unknown as { getProcedureDef(): [string, string[], boolean] }).getProcedureDef();
      return { kind: 'define', name, params: [...params], body: this.chainToNodes(b.getInputTargetBlock('STACK')) };
    }
    if (b.type === CALL) {
      const name = (b as unknown as { getProcedureCall(): string }).getProcedureCall();
      const args: Expr[] = [];
      for (let i = 0; b.getInput(`ARG${i}`); i++) args.push(this.exprOf(b.getInputTargetBlock(`ARG${i}`)));
      return { kind: 'call', name, args };
    }
    if (b.type === whenType(pid)) {
      return { kind: 'when', event: String(b.getFieldValue('EVENT') ?? ''), body: this.chainToNodes(b.getInputTargetBlock('DO')) };
    }
    if (b.type.startsWith(`vatra_${pid}__`)) {
      const id = idFromType(b.type);
      const def = this.puzzle!.actions.find((a) => a.id === id);
      if (def?.hasArg) return { kind: 'action', id, arg: this.exprOf(b.getInputTargetBlock('ARG')) };
      return { kind: 'action', id };
    }
    return null;
  }

  // A number-shaped socket: an empty one reads as 0
  private exprOf(b: Blockly.Block | null): Expr {
    if (!b) return 0;
    switch (b.type) {
      case 'math_number':
        return Number(b.getFieldValue('NUM')) || 0;
      case 'variables_get':
        return { kind: 'var', name: this.varNameOf(b) };
      case 'math_arithmetic': {
        const op = String(b.getFieldValue('OP'));
        const kind = op === 'MINUS' ? 'sub' : op === 'MULTIPLY' || op === 'POWER' ? 'mul' : op === 'DIVIDE' ? 'div' : 'add';
        return { kind, a: this.exprOf(b.getInputTargetBlock('A')), b: this.exprOf(b.getInputTargetBlock('B')) };
      }
      case 'math_random_int':
        return { kind: 'random', min: this.exprOf(b.getInputTargetBlock('FROM')), max: this.exprOf(b.getInputTargetBlock('TO')) };
    }
    if (b.type.startsWith(`sensor_${this.puzzle!.id}__`)) return { kind: 'sensor', id: idFromType(b.type) };
    return 0;
  }

  // An empty condition socket yields '', which is never true and matches no
  // solution — the child gets the lesson's fail text rather than a silent
  // wrong answer.
  private condOf(b: Blockly.Block | null): Cond {
    if (!b) return '';
    switch (b.type) {
      case 'logic_operation':
        return {
          kind: String(b.getFieldValue('OP')) === 'AND' ? 'and' : 'or',
          a: this.condOf(b.getInputTargetBlock('A')),
          b: this.condOf(b.getInputTargetBlock('B')),
        };
      case 'logic_negate':
        return { kind: 'not', a: this.condOf(b.getInputTargetBlock('BOOL')) };
      case 'logic_compare': {
        const ops: Record<string, '<' | '>' | '=' | '!=' | '<=' | '>='> = { EQ: '=', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
        return { kind: 'cmp', op: ops[String(b.getFieldValue('OP'))] ?? '=', a: this.exprOf(b.getInputTargetBlock('A')), b: this.exprOf(b.getInputTargetBlock('B')) };
      }
    }
    if (b.type.startsWith(`cond_${this.puzzle!.id}__`)) return idFromType(b.type);
    return '';
  }

  // ---- ProgramNode[] -> Blockly workspace (starter programs, tests)

  loadProgram(nodes: ProgramNode[]): void {
    if (!this.workspace || !this.puzzle) return;
    const pid = this.puzzle.id;
    const variables = new Map<string, string>();
    const varRef = (name: string) => {
      const id = `var_${name}`;
      variables.set(name, id);
      return { id, name };
    };
    const expr = (e: Expr): { block?: BlockState; shadow?: BlockState } => {
      if (typeof e === 'number') return NUM_SHADOW(e);
      let block: BlockState;
      switch (e.kind) {
        case 'var':
          block = { type: 'variables_get', fields: { VAR: varRef(e.name) } };
          break;
        case 'sensor':
          block = { type: sensorType(pid, e.id) };
          break;
        case 'random':
          block = { type: 'math_random_int', inputs: { FROM: expr(e.min), TO: expr(e.max) } };
          break;
        default: {
          const op = { add: 'ADD', sub: 'MINUS', mul: 'MULTIPLY', div: 'DIVIDE' }[e.kind];
          block = { type: 'math_arithmetic', fields: { OP: op }, inputs: { A: expr(e.a), B: expr(e.b) } };
        }
      }
      return { ...NUM_SHADOW(1), block };
    };
    const cond = (c: Cond): BlockState | undefined => {
      if (typeof c === 'string') return c ? { type: condType(pid, c) } : undefined;
      switch (c.kind) {
        case 'and':
        case 'or': {
          const inputs: BlockState['inputs'] = {};
          const a = cond(c.a);
          const b = cond(c.b);
          if (a) inputs.A = { block: a };
          if (b) inputs.B = { block: b };
          return { type: 'logic_operation', fields: { OP: c.kind.toUpperCase() }, inputs };
        }
        case 'not': {
          const a = cond(c.a);
          return { type: 'logic_negate', inputs: a ? { BOOL: { block: a } } : {} };
        }
        case 'cmp': {
          const ops = { '=': 'EQ', '!=': 'NEQ', '<': 'LT', '<=': 'LTE', '>': 'GT', '>=': 'GTE' };
          return { type: 'logic_compare', fields: { OP: ops[c.op] }, inputs: { A: expr(c.a), B: expr(c.b) } };
        }
      }
    };
    const chain = (list: ProgramNode[]): BlockState | undefined => {
      let head: BlockState | undefined;
      let tail: BlockState | undefined;
      for (const n of list) {
        const s = node(n);
        if (!s) continue;
        if (!head) head = s;
        else tail!.next = { block: s };
        tail = s;
      }
      return head;
    };
    const stmt = (list: ProgramNode[]): { block: BlockState } | undefined => {
      const head = chain(list);
      return head ? { block: head } : undefined;
    };
    const node = (n: ProgramNode): BlockState | undefined => {
      switch (n.kind) {
        case 'action': {
          const def = this.puzzle!.actions.find((a) => a.id === n.id);
          const s: BlockState = { type: actionType(pid, n.id) };
          if (def?.hasArg) s.inputs = { ARG: expr(n.arg ?? 0) };
          return s;
        }
        case 'repeat': {
          const inputs: BlockState['inputs'] = { TIMES: expr(n.count) };
          const body = stmt(n.body);
          if (body) inputs.DO = body;
          return { type: REPEAT, inputs };
        }
        case 'while':
        case 'if': {
          const inputs: BlockState['inputs'] = {};
          const c = cond(n.cond);
          if (c) inputs.COND = { block: c };
          const body = stmt(n.body);
          if (body) inputs.DO = body;
          if (n.kind === 'if') {
            const elseBody = stmt(n.elseBody);
            if (elseBody) inputs.ELSE = elseBody;
          }
          return { type: n.kind === 'while' ? WHILE : IF, inputs };
        }
        case 'set':
          return { type: 'variables_set', fields: { VAR: varRef(n.name) }, inputs: { VALUE: expr(n.value) } };
        case 'change':
          return { type: 'math_change', fields: { VAR: varRef(n.name) }, inputs: { DELTA: expr(n.delta) } };
        case 'define': {
          const inputs: BlockState['inputs'] = {};
          const body = stmt(n.body);
          if (body) inputs.STACK = body;
          return {
            type: DEFINE,
            fields: { NAME: n.name },
            extraState: { params: n.params.map((p) => varRef(p)) },
            inputs,
          };
        }
        case 'call': {
          const inputs: BlockState['inputs'] = {};
          n.args.forEach((a, i) => (inputs[`ARG${i}`] = expr(a)));
          const def = nodes.find((d) => d.kind === 'define' && d.name === n.name);
          const params = def && def.kind === 'define' ? def.params : n.args.map((_, i) => `p${i}`);
          return { type: CALL, extraState: { name: n.name, params }, inputs };
        }
        case 'when': {
          const inputs: BlockState['inputs'] = {};
          const body = stmt(n.body);
          if (body) inputs.DO = body;
          return { type: whenType(pid), fields: { EVENT: n.event }, inputs };
        }
      }
    };

    // Definitions load first so the calls to them find them; main sits at
    // the top-left, procedures to its right, event hats underneath
    const blocks: BlockState[] = [];
    const defs = nodes.filter((n) => n.kind === 'define');
    const whens = nodes.filter((n) => n.kind === 'when');
    const main = nodes.filter((n) => n.kind !== 'define' && n.kind !== 'when');
    defs.forEach((d, i) => {
      const s = node(d);
      if (s) blocks.push({ ...s, x: 380, y: 25 + i * 190 });
    });
    const mainHead = chain(main);
    if (mainHead) blocks.push({ ...mainHead, x: 30, y: 25 });
    whens.forEach((w, i) => {
      const s = node(w);
      if (s) blocks.push({ ...s, x: 30, y: 260 + i * 170 });
    });
    for (const name of this.puzzle.variables ?? []) varRef(name);

    this.workspace.clear();
    Blockly.serialization.workspaces.load(
      {
        variables: [...variables].map(([name, id]) => ({ name, id })),
        blocks: { languageVersion: 0, blocks },
      },
      this.workspace,
    );
    this.refresh();
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
      let code = '';
      try {
        code = pythonGenerator.workspaceToCode(this.workspace).trim();
      } catch {
        code = '';
      }
      this.codeEl.textContent = code || '# (încă niciun bloc)';
    }
  }

  private renderVars(): void {
    const show = !!this.puzzle?.allowVariables;
    this.varsEl.classList.toggle('hidden', !show);
    if (!show) return;
    if (this.liveVars.size === 0) {
      this.varsEl.textContent = '🧮 Cutiuțe: (goale — pornește programul ca să le vezi umplându-se)';
      return;
    }
    this.varsEl.textContent = '🧮 Cutiuțe: ' + [...this.liveVars].map(([n, v]) => `${n} = ${v}`).join('   ·   ');
  }

  private setStatus(text: string, ok = true): void {
    this.status = { text, ok };
    this.statusEl.className = 'tabla-status' + (ok ? ' ok' : ' bad');
    this.statusEl.textContent = text;
  }

  private wait(ms: number): Promise<void> {
    if (this.fastMode) return Promise.resolve();
    return new Promise((r) => setTimeout(r, ms));
  }

  // Test hook (window.__game.solveLesson): loads a program, runs it with no
  // pauses and reports the verdict exactly as the child would see it
  async runForTest(program?: ProgramNode[]): Promise<{ success: boolean; text: string } | null> {
    if (program) this.loadProgram(program);
    const wasFast = this.fastMode;
    this.fastMode = true;
    try {
      await this.run();
    } finally {
      this.fastMode = wasFast;
    }
    return this.status ? { success: this.status.ok, text: this.status.text } : null;
  }

  // ---- step-by-step execution, highlighting each block as it runs

  private async run(): Promise<void> {
    if (!this.puzzle || this.running) return;
    const puzzle = this.puzzle;
    const program = this.toProgram();
    if (program.length === 0) return;
    this.running = true;
    this.status = null;
    this.liveVars.clear();
    this.renderVars();
    this.refresh();

    this.cb.onRunStart(puzzle.id);
    const gen = execute(puzzle, program);
    let completed = true;
    let steps = 0;
    for (;;) {
      if (!this.isOpen) {
        completed = false;
        break;
      }
      const next = gen.next();
      if (next.done) break;
      const ev = next.value;
      switch (ev.type) {
        case 'scenario': {
          this.cb.onScenario(puzzle.id, ev.label, ev.index, ev.total);
          this.liveVars.clear();
          this.renderVars();
          this.setStatus(`Încercarea ${ev.index + 1}/${ev.total}: ${ev.label}…`);
          await this.wait(SCENARIO_PAUSE_MS);
          break;
        }
        case 'node': {
          const id = this.nodeIds.get(ev.node);
          if (id) this.workspace?.highlightBlock(id);
          if (ev.node.kind === 'if' || ev.node.kind === 'while') await this.wait(ev.inLoop ? 0 : 400); // a beat to show the condition being checked
          if (ev.node.kind === 'action') await this.wait(ev.inLoop ? LOOP_STEP_MS : STEP_MS);
          break;
        }
        case 'action':
          this.cb.onStep(puzzle.id, ev.id, ev.arg);
          break;
        case 'event': {
          const label = puzzle.events?.find((e) => e.id === ev.id)?.label ?? ev.id;
          this.setStatus(`⚡ Se întâmplă: ${label}`);
          this.cb.onEvent(puzzle.id, ev.id);
          await this.wait(EVENT_PAUSE_MS);
          break;
        }
        case 'var':
          this.liveVars.set(ev.name, ev.value);
          this.renderVars();
          break;
        case 'infinite':
          this.setStatus('Bucla nu se mai oprește — tăblița s-a oprit singură…', false);
          await this.wait(SCENARIO_PAUSE_MS);
          break;
      }
      // In fast mode nothing above ever yields to the browser; give it a
      // breath now and then so the page stays responsive
      if (this.fastMode && ++steps % 200 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    this.workspace?.highlightBlock(null);
    this.cb.onRunEnd(puzzle.id);
    if (!this.isOpen) return; // closed mid-run — abort quietly
    if (!completed) {
      this.running = false;
      this.refresh();
      return;
    }

    const result = this.cb.onFinish(puzzle.id, program);
    this.running = false;
    this.status = { text: result.text, ok: result.success };
    this.refresh();
  }
}
