// Satul Codat puzzle data. Content is data, not code: each puzzle defines
// its available action/condition blocks, its canonical solution tree, and
// scripted comic fails; the Tabla de Blocuri and VatraModule interpret this.
//
// Programs are trees, not flat lists — 'repeat'/'while'/'if' are generic,
// reusable containers (like Scratch) that hold other nodes, including other
// loops. This is what actually teaches the concept: a loop that repeats a
// single action is the same block as a loop that repeats five actions or
// another loop.

import { BlockType } from '../world/Block';
import { WeaponId } from '../items/Weapon';
import { ToolId } from '../items/Tool';
import { ThrowableId } from '../items/Throwable';
import type { RunResult } from './Interpreter';

// ---- The program model ----------------------------------------------------
//
// A number is a valid Expr and a plain string is a valid Cond, so the
// sequence/loop/if lessons written before variables and logic existed are
// still valid data, unchanged.

export type Expr =
  | number
  | { kind: 'var'; name: string }
  | { kind: 'sensor'; id: string } // a number the world reports (steps to the pasture…)
  | { kind: 'add' | 'sub' | 'mul' | 'div'; a: Expr; b: Expr }
  | { kind: 'random'; min: Expr; max: Expr };

export type Cond =
  | string // a named condition the lesson offers ('e_noapte')
  | { kind: 'and' | 'or'; a: Cond; b: Cond }
  | { kind: 'not'; a: Cond }
  | { kind: 'cmp'; op: '<' | '>' | '=' | '!=' | '<=' | '>='; a: Expr; b: Expr };

export type ProgramNode =
  | { kind: 'action'; id: string; arg?: Expr }
  | { kind: 'repeat'; count: Expr; body: ProgramNode[] }
  | { kind: 'while'; cond: Cond; body: ProgramNode[] }
  | { kind: 'if'; cond: Cond; body: ProgramNode[]; elseBody: ProgramNode[] }
  | { kind: 'set'; name: string; value: Expr }
  | { kind: 'change'; name: string; delta: Expr }
  // define/when only ever sit at the top level of a program
  | { kind: 'define'; name: string; params: string[]; body: ProgramNode[] }
  | { kind: 'call'; name: string; args: Expr[] }
  | { kind: 'when'; event: string; body: ProgramNode[] };

export interface VatraAction {
  id: string;
  label: string; // may contain %1 when the action takes a number (hasArg)
  hasArg?: boolean;
}

export interface VatraCondition {
  id: string;
  label: string;
}

// A number the lesson's world can be asked for ('câți pași până la pășune')
export interface VatraSensor {
  id: string;
  label: string;
}

// Something that happens in the lesson's world on its own ('vine ursul')
export interface VatraEvent {
  id: string;
  label: string;
}

// One run-through of the world the program is tested in: what every named
// condition answers (a list is consumed one value per read; after the last
// one, it keeps repeating it), what every sensor reports, and which events
// fire, in order, once the main program has run.
export interface Scenario {
  label: string;
  conds?: Record<string, boolean | boolean[]>;
  sensors?: Record<string, number | number[]>;
  events?: string[];
  seed?: number; // fixes the "la întâmplare" block so the run is repeatable
}

export interface VatraFail {
  text: string; // the guide's comic verdict
  anim: 'bucket' | 'coal' | 'dark' | 'splash' | 'none';
  // The run result is only there for lessons graded on behaviour; the older
  // predicates just ignore it
  matches: (program: ProgramNode[], result: RunResult) => boolean;
}

// A rule a behaviourally-correct program must also satisfy to pass — "you
// have to use a loop", "the count must come from the box, not a number" —
// so that a solution unrolled by hand doesn't get the same praise as one
// that actually uses the concept being taught.
export interface VatraRequirement {
  text: string;
  check: (program: ProgramNode[], result: RunResult) => boolean;
}

export interface VatraPuzzle {
  id: string;
  title: string;
  intro: string; // the guide's guidance shown when the tabla opens
  success: string;
  // What solving it actually hands over. VatraModule pays exactly this out,
  // the Ajutor panel reads it to say where a material comes from, and
  // `reward` is the same list written out for a child to read — keep the
  // three in step (test_reward_truth.js checks the prose against the grant).
  rewardItems: { id: number; count: number }[];
  reward: string; // rewardItems in words, shown under the intro
  rewardRepeats?: boolean; // paid out on every solve, not just the first
  actions: VatraAction[]; // atomic action blocks available in the palette
  conditions?: VatraCondition[]; // available for while/if, when allowed
  sensors?: VatraSensor[];
  events?: VatraEvent[];
  variables?: string[]; // boxes pre-created in the workspace
  allowRepeat?: boolean; // shows the generic "repetă de N ori" container
  allowWhile?: boolean; // shows the generic "cât timp <condiție>" container
  allowIf?: boolean; // shows the generic "dacă <condiție> / altfel" container
  allowLogic?: boolean; // ȘI / SAU / NU
  allowCompare?: boolean; // < > =
  allowVariables?: boolean; // pune / schimbă / citește
  allowMath?: boolean; // numbers, + −
  allowRandom?: boolean; // "la întâmplare între"
  allowProcedures?: boolean; // definește / cheamă
  allowEvents?: boolean; // "când se întâmplă…"
  solution: ProgramNode[];
  // When present, the lesson is graded on what the program DOES in each
  // scenario (its trace) rather than on its exact shape — any program that
  // behaves like the solution everywhere, and meets the requirements, passes.
  scenarios?: Scenario[];
  requirements?: VatraRequirement[];
  starterProgram?: ProgramNode[]; // a broken program pre-loaded for the child to fix
  fails: VatraFail[]; // checked in order; first match wins
}

// How often a lesson pays out, spelled out for the reward line the tabla and
// Bunicul's lesson list both show under the brief
export function rewardWhen(puzzle: VatraPuzzle): string {
  return puzzle.rewardRepeats ? 'la fiecare rezolvare' : 'o singură dată, la prima rezolvare';
}

// Lessons graded on behaviour (see VatraPuzzle.scenarios)
export function gradesByTrace(puzzle: VatraPuzzle): boolean {
  return !!puzzle.scenarios && puzzle.scenarios.length > 0;
}

// ---- Builders, so puzzle data reads like pseudocode ------------------------

export const A = (id: string, arg?: Expr): ProgramNode => (arg === undefined ? { kind: 'action', id } : { kind: 'action', id, arg });
export const REPEAT = (count: Expr, body: ProgramNode[]): ProgramNode => ({ kind: 'repeat', count, body });
export const WHILE = (cond: Cond, body: ProgramNode[]): ProgramNode => ({ kind: 'while', cond, body });
export const IF = (cond: Cond, body: ProgramNode[], elseBody: ProgramNode[] = []): ProgramNode => ({
  kind: 'if',
  cond,
  body,
  elseBody,
});
export const SET = (name: string, value: Expr): ProgramNode => ({ kind: 'set', name, value });
export const CHG = (name: string, delta: Expr): ProgramNode => ({ kind: 'change', name, delta });
export const DEF = (name: string, params: string[], body: ProgramNode[]): ProgramNode => ({ kind: 'define', name, params, body });
export const CALL = (name: string, args: Expr[] = []): ProgramNode => ({ kind: 'call', name, args });
export const WHEN = (event: string, body: ProgramNode[]): ProgramNode => ({ kind: 'when', event, body });
export const V = (name: string): Expr => ({ kind: 'var', name });
export const S = (id: string): Expr => ({ kind: 'sensor', id });
export const ADD = (a: Expr, b: Expr): Expr => ({ kind: 'add', a, b });
export const SUB = (a: Expr, b: Expr): Expr => ({ kind: 'sub', a, b });
export const RND = (min: Expr, max: Expr): Expr => ({ kind: 'random', min, max });
export const CMP = (a: Expr, op: '<' | '>' | '=' | '!=' | '<=' | '>=', b: Expr): Cond => ({ kind: 'cmp', op, a, b });
export const AND = (a: Cond, b: Cond): Cond => ({ kind: 'and', a, b });
export const OR = (a: Cond, b: Cond): Cond => ({ kind: 'or', a, b });
export const NOT = (a: Cond): Cond => ({ kind: 'not', a });

// The builders bundled for the browser console / test harness
// (window.__puzzleHelpers), so a test can write a program as pseudocode
export const PUZZLE_HELPERS = { A, REPEAT, WHILE, IF, SET, CHG, DEF, CALL, WHEN, V, S, ADD, SUB, RND, CMP, AND, OR, NOT };

// ---- Structural equality ---------------------------------------------------

export function exprEquals(a: Expr, b: Expr): boolean {
  if (typeof a === 'number' || typeof b === 'number') return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'var' && b.kind === 'var') return a.name === b.name;
  if (a.kind === 'sensor' && b.kind === 'sensor') return a.id === b.id;
  if (a.kind === 'random' && b.kind === 'random') return exprEquals(a.min, b.min) && exprEquals(a.max, b.max);
  if ((a.kind === 'add' || a.kind === 'sub' || a.kind === 'mul' || a.kind === 'div') && a.kind === b.kind) {
    return exprEquals(a.a, b.a) && exprEquals(a.b, b.b);
  }
  return false;
}

export function condEquals(a: Cond, b: Cond): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'not' && b.kind === 'not') return condEquals(a.a, b.a);
  if ((a.kind === 'and' || a.kind === 'or') && a.kind === b.kind) return condEquals(a.a, b.a) && condEquals(a.b, b.b);
  if (a.kind === 'cmp' && b.kind === 'cmp') return a.op === b.op && exprEquals(a.a, b.a) && exprEquals(a.b, b.b);
  return false;
}

export function programEquals(a: ProgramNode[], b: ProgramNode[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((n, i) => nodeEquals(n, b[i]));
}

function nodeEquals(a: ProgramNode, b: ProgramNode): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'action' && b.kind === 'action') {
    if (a.id !== b.id) return false;
    if (a.arg === undefined || b.arg === undefined) return a.arg === b.arg;
    return exprEquals(a.arg, b.arg);
  }
  if (a.kind === 'repeat' && b.kind === 'repeat') return exprEquals(a.count, b.count) && programEquals(a.body, b.body);
  if (a.kind === 'while' && b.kind === 'while') return condEquals(a.cond, b.cond) && programEquals(a.body, b.body);
  if (a.kind === 'if' && b.kind === 'if') {
    return condEquals(a.cond, b.cond) && programEquals(a.body, b.body) && programEquals(a.elseBody, b.elseBody);
  }
  if (a.kind === 'set' && b.kind === 'set') return a.name === b.name && exprEquals(a.value, b.value);
  if (a.kind === 'change' && b.kind === 'change') return a.name === b.name && exprEquals(a.delta, b.delta);
  if (a.kind === 'define' && b.kind === 'define') {
    return a.name === b.name && a.params.length === b.params.length && a.params.every((p, i) => p === b.params[i]) && programEquals(a.body, b.body);
  }
  if (a.kind === 'call' && b.kind === 'call') {
    return a.name === b.name && a.args.length === b.args.length && a.args.every((x, i) => exprEquals(x, b.args[i]));
  }
  if (a.kind === 'when' && b.kind === 'when') return a.event === b.event && programEquals(a.body, b.body);
  return false;
}

// ---- Equivalence up to naming ---------------------------------------------
//
// A child who calls the box "mieluțe" instead of "oi" has still understood
// variables, so names are canonicalised (v1, v2… / p1, p2… in order of first
// appearance) before comparing, and the top-level define/when blocks are
// sorted, since the order they sit on the canvas in carries no meaning.

export function normalise(program: ProgramNode[]): ProgramNode[] {
  const vars = new Map<string, string>();
  const procs = new Map<string, string>();
  const varName = (n: string) => {
    if (!vars.has(n)) vars.set(n, `v${vars.size + 1}`);
    return vars.get(n)!;
  };
  const procName = (n: string) => {
    if (!procs.has(n)) procs.set(n, `p${procs.size + 1}`);
    return procs.get(n)!;
  };
  const expr = (e: Expr): Expr => {
    if (typeof e === 'number') return e;
    if (e.kind === 'var') return { kind: 'var', name: varName(e.name) };
    if (e.kind === 'sensor') return e;
    if (e.kind === 'random') return { kind: 'random', min: expr(e.min), max: expr(e.max) };
    return { kind: e.kind, a: expr(e.a), b: expr(e.b) };
  };
  const cond = (c: Cond): Cond => {
    if (typeof c === 'string') return c;
    if (c.kind === 'not') return { kind: 'not', a: cond(c.a) };
    if (c.kind === 'cmp') return { kind: 'cmp', op: c.op, a: expr(c.a), b: expr(c.b) };
    return { kind: c.kind, a: cond(c.a), b: cond(c.b) };
  };
  const node = (n: ProgramNode): ProgramNode => {
    switch (n.kind) {
      case 'action':
        return n.arg === undefined ? n : { kind: 'action', id: n.id, arg: expr(n.arg) };
      case 'repeat':
        return { kind: 'repeat', count: expr(n.count), body: n.body.map(node) };
      case 'while':
        return { kind: 'while', cond: cond(n.cond), body: n.body.map(node) };
      case 'if':
        return { kind: 'if', cond: cond(n.cond), body: n.body.map(node), elseBody: n.elseBody.map(node) };
      case 'set':
        return { kind: 'set', name: varName(n.name), value: expr(n.value) };
      case 'change':
        return { kind: 'change', name: varName(n.name), delta: expr(n.delta) };
      case 'define':
        return { kind: 'define', name: procName(n.name), params: n.params.map(varName), body: n.body.map(node) };
      case 'call':
        return { kind: 'call', name: procName(n.name), args: n.args.map(expr) };
      case 'when':
        return { kind: 'when', event: n.event, body: n.body.map(node) };
    }
  };
  // Procedures are named in the order they're first CALLED or defined, walking
  // main first, so a define placed above or below main doesn't change its name
  const main = program.filter((n) => n.kind !== 'define' && n.kind !== 'when').map(node);
  const defs = program.filter((n) => n.kind === 'define').map(node);
  const whens = program.filter((n) => n.kind === 'when').map(node);
  const key = (n: ProgramNode) => (n.kind === 'define' ? `d:${n.name}` : n.kind === 'when' ? `w:${n.event}` : '');
  defs.sort((x, y) => key(x).localeCompare(key(y)));
  whens.sort((x, y) => key(x).localeCompare(key(y)) || JSON.stringify(x).localeCompare(JSON.stringify(y)));
  return [...main, ...defs, ...whens];
}

export function programEquivalent(a: ProgramNode[], b: ProgramNode[]): boolean {
  return programEquals(normalise(a), normalise(b));
}

// ---- Helpers for fail predicates ------------------------------------------

// A repeat's count when it's a plain number, NaN when it's a box or a sensor
// (every comparison with NaN is false, so the numeric fails simply don't fire)
export function repeatCount(n: ProgramNode): number {
  return n.kind === 'repeat' && typeof n.count === 'number' ? n.count : NaN;
}

// The linear order actions would visually execute in — repeats fully
// unrolled (capped, so a mistyped huge count can't hang this), while capped
// to a small demo count, if running both branches in sequence. Used by fail
// predicates that only care about relative order, not tree shape.
export function flattenActions(nodes: ProgramNode[]): string[] {
  const out: string[] = [];
  const walk = (ns: ProgramNode[]) => {
    for (const n of ns) {
      if (n.kind === 'action') out.push(n.id);
      else if (n.kind === 'repeat') {
        const count = typeof n.count === 'number' ? n.count : 5;
        for (let i = 0; i < Math.min(Math.max(count, 0), 400); i++) walk(n.body);
      } else if (n.kind === 'while') for (let i = 0; i < 5; i++) walk(n.body);
      else if (n.kind === 'if') {
        walk(n.body);
        walk(n.elseBody);
      } else if (n.kind === 'define' || n.kind === 'when') walk(n.body);
    }
  };
  walk(nodes);
  return out;
}

// Recursively searches the whole tree (including inside loops/branches)
export function hasNode(nodes: ProgramNode[], pred: (n: ProgramNode) => boolean): boolean {
  for (const n of nodes) {
    if (pred(n)) return true;
    if (n.kind === 'repeat' || n.kind === 'while' || n.kind === 'define' || n.kind === 'when') {
      if (hasNode(n.body, pred)) return true;
    } else if (n.kind === 'if') {
      if (hasNode(n.body, pred) || hasNode(n.elseBody, pred)) return true;
    }
  }
  return false;
}

// True if an action with this id sits directly in `nodes` — not nested
// inside any container. Used to catch "did it unconditionally", bypassing
// the loop/condition the puzzle expects it to live inside.
export function hasTopLevelAction(nodes: ProgramNode[], id: string): boolean {
  return nodes.some((n) => n.kind === 'action' && n.id === id);
}

// Whether a condition tree mentions a named condition anywhere
export function condMentions(c: Cond, id: string): boolean {
  if (typeof c === 'string') return c === id;
  if (c.kind === 'not') return condMentions(c.a, id);
  if (c.kind === 'cmp') return false;
  return condMentions(c.a, id) || condMentions(c.b, id);
}

// The action ids a scenario's trace ran, in order — for behavioural fails
export function actionsIn(result: RunResult, scenarioLabel?: string): string[] {
  const runs = scenarioLabel ? result.scenarios.filter((s) => s.label === scenarioLabel) : result.scenarios;
  return runs.flatMap((s) => s.trace.filter((t) => t.t === 'act').map((t) => t.id));
}

const before = (program: ProgramNode[], a: string, b: string): boolean => {
  const flat = flattenActions(program);
  const ia = flat.indexOf(a);
  const ib = flat.indexOf(b);
  return ia >= 0 && ib >= 0 && ia < ib;
};

export const VATRA_PUZZLES: Record<string, VatraPuzzle> = {
  fantana: {
    id: 'fantana',
    title: 'Fântâna — prima secvență',
    intro:
      'BUNICUL FIERAR: „Fântâna-i secată de-un veac, copile. Leagă frânghia de găleată, apoi coboar-o, umple-o, urc-o și varsă apa în jgheab. Hai, arată-mi!"',
    success: 'APA CURGE! Fântâna-i vie iarăși, iar jgheabul e plin. Bunicul îți dă o Suliță de Gheață, uneltită din chiar gheața fântânii. (+1 Ice Spear)',
    rewardItems: [{ id: WeaponId.IceSpear, count: 1 }],
    reward: '1 suliță de gheață (Ice Spear)',
    rewardRepeats: true,
    actions: [
      { id: 'leaga', label: 'Leagă frânghia' },
      { id: 'umple', label: 'Umple găleata' },
      { id: 'varsa', label: 'Varsă în jgheab' },
      { id: 'coboara', label: 'Coboară găleata' },
      { id: 'urca', label: 'Urcă găleata' },
      { id: 'canta', label: 'Cântă un cântec' },
    ],
    solution: [A('leaga'), A('coboara'), A('umple'), A('urca'), A('varsa')],
    fails: [
      {
        text: 'Ai coborât găleata fără s-o legi de frânghie — a căzut în fântână cu bufnitură! Cartea Boacănelor se-ngroașă.',
        anim: 'bucket',
        matches: (p) => {
          const flat = flattenActions(p);
          return flat.includes('coboara') && flat[0] !== 'leaga';
        },
      },
      {
        text: 'Găleata a urcat GOALĂ și Bunicul a băut… aer! A doua boacănă din Cartea Boacănelor.',
        anim: 'bucket',
        matches: (p) => before(p, 'urca', 'umple') || before(p, 'varsa', 'umple'),
      },
      {
        text: 'Hmm, nu-i ordinea bună — apa n-a ajuns în jgheab. Mai încearcă!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  cuptor: {
    id: 'cuptor',
    title: 'Cuptorul de pâine — ordinea contează',
    intro:
      'BUNICUL FIERAR: „Șase porunci pentru un colac ca lumea. Da\' bagă de seamă: aluatul necopt nu-i pâine, iar pâinea nefrământată-i… cărbune!"',
    success: 'COLACI CALZI! Miroase-n tot satul. (+10 pâini în traistă)',
    rewardItems: [{ id: BlockType.Paine, count: 10 }],
    reward: '10 pâini',
    rewardRepeats: true,
    actions: [
      { id: 'dospeste', label: 'Lasă la dospit' },
      { id: 'baga', label: 'Bagă în cuptor' },
      { id: 'presara_faina', label: 'Presară făină pe masă' },
      { id: 'aprinde', label: 'Aprinde focul' },
      { id: 'scoate', label: 'Scoate din cuptor' },
      { id: 'unge_tava', label: 'Unge tava cu unt' },
      { id: 'framanta', label: 'Frământă aluatul' },
      { id: 'asteapta', label: 'Așteaptă' },
    ],
    solution: [A('aprinde'), A('framanta'), A('dospeste'), A('baga'), A('asteapta'), A('scoate')],
    fails: [
      {
        text: '«Bagă în cuptor» înainte de «frământă»?! Din cuptor a ieșit un BOLOVAN DE CĂRBUNE fumegând. Boacănă de aur!',
        anim: 'coal',
        matches: (p) => before(p, 'baga', 'framanta'),
      },
      {
        text: 'Bunicul clatină din cap: pași buni, dar în plus — nu-s în rețetă! Pâinea a ieșit ciudată.',
        anim: 'none',
        matches: (p) => flattenActions(p).some((a) => a === 'presara_faina' || a === 'unge_tava'),
      },
      {
        text: 'Din cuptor n-a ieșit nimic bun — nici colac, nici cărbune. Ordinea, dragul moșului, ordinea!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  ulita: {
    id: 'ulita',
    title: 'Ulița cu felinare — bucla te scapă de repetiție',
    intro:
      'BUNICUL FIERAR: „Verifică-ntâi untdelemnul, apoi spune tăbliței «repetă de atâtea ori» și pune înăuntru «aprinde felinarul». N-ai nevoie să-l apeși de cinci ori — bucla face treaba, tu doar alegi numărul."',
    success:
      'Ulița-i luminată dintr-o mișcare — bucla a aprins toate felinarele! Bunicul zâmbește: „Vezi? Nu mai trebuia s-o faci de cinci ori tu însuți." (+10 lămpi)',
    rewardItems: [{ id: BlockType.Lamp, count: 10 }],
    reward: '10 lămpi',
    rewardRepeats: true,
    actions: [
      { id: 'verifica', label: 'Verifică untdelemnul' },
      { id: 'aprinde_felinar', label: 'Aprinde felinarul' },
      { id: 'doina', label: 'Fluieră o doină' },
    ],
    allowRepeat: true,
    solution: [A('verifica'), REPEAT(5, [A('aprinde_felinar')])],
    fails: [
      {
        text: 'Frumoasă doina… dar felinarele nu se aprind cu fluierul, dragul moșului!',
        anim: 'dark',
        matches: (p) => flattenActions(p).includes('doina'),
      },
      {
        text: 'Bucla nu-i pusă cum trebuie — nu toate cele 5 felinare s-au aprins. Numără din nou!',
        anim: 'dark',
        matches: (p) => flattenActions(p).filter((a) => a === 'aprinde_felinar').length !== 5,
      },
      {
        text: 'Felinarele n-aveau untdelemn — s-au aprins și s-au stins imediat! Verifică untdelemnul întâi.',
        anim: 'dark',
        matches: (p) => !flattenActions(p).includes('verifica'),
      },
      {
        text: 'Mijlocul uliței a rămas BEZNĂ — paznicul s-a împiedicat de o găină! Ordinea corectă, cu bucla la locul ei.',
        anim: 'dark',
        matches: () => true,
      },
    ],
  },
  fierarie: {
    id: 'fierarie',
    title: 'Fierăria lui Bunicul — potcoava norocoasă',
    intro:
      'BUNICUL FIERAR: „Focul întâi, apoi fierul, apoi răbdare — să se-nroșească bine. Pune o buclă cu trei lovituri de ciocan, apoi călire-n apă rece, și gata potcoava. Nu sări nicio treaptă!"',
    success: 'POTCOAVA-I GATA, lucie și tare! Norocul satului crește. (+1 târnăcop)',
    rewardItems: [{ id: ToolId.Tarnacop, count: 1 }],
    reward: '1 târnăcop',
    rewardRepeats: true,
    actions: [
      { id: 'aprinde_forja', label: 'Aprinde forja' },
      { id: 'pune_fier', label: 'Pune fierul în foc' },
      { id: 'incalzeste', label: 'Așteaptă să se-nroșească' },
      { id: 'loveste', label: 'Lovește cu ciocanul' },
      { id: 'caleste', label: 'Călește în apă' },
      { id: 'scoate_potcoava', label: 'Scoate potcoava' },
      { id: 'canta', label: 'Cântă la nicovală' },
    ],
    allowRepeat: true,
    solution: [
      A('aprinde_forja'),
      A('pune_fier'),
      A('incalzeste'),
      REPEAT(3, [A('loveste')]),
      A('caleste'),
      A('scoate_potcoava'),
    ],
    fails: [
      {
        text: 'Ciocanul a lovit nicovala GOALĂ — doar zgomot și un ecou trist. Pune fierul întâi!',
        anim: 'none',
        matches: (p) => before(p, 'loveste', 'pune_fier'),
      },
      {
        text: 'Ai călit fierul RECE — a crăpat un ciob negru din el, ca vai de mama lui. Boacănă de fierar!',
        anim: 'coal',
        matches: (p) => before(p, 'caleste', 'incalzeste'),
      },
      {
        text: 'Bucla de ciocănit nu-i pusă bine — nici trei lovituri exacte. Potcoava-i strâmbă!',
        anim: 'none',
        matches: (p) => flattenActions(p).filter((a) => a === 'loveste').length !== 3,
      },
      {
        text: 'Din forjă n-a ieșit nicio potcoavă — doar fum și ciocănituri fără rost. Ordinea, ucenice!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  grajd: {
    id: 'grajd',
    title: 'Grajdul — calul flămând',
    intro:
      'BUNICUL FIERAR: „Calul așteaptă la poartă, flămând și însetat. Deschide poarta, adu-i fân și apă — pe rând, cum se cuvine — și abia apoi lasă-l să intre."',
    success: 'Calul nechează mulțumit și intră în grajd! (+10 fân și 10 socată fermentată)',
    rewardItems: [{ id: BlockType.Hay, count: 10 }, { id: ThrowableId.SocataBottle, count: 10 }],
    reward: '10 baloturi de fân și 10 sticle de socată fermentată',
    rewardRepeats: true,
    actions: [
      { id: 'deschide_poarta', label: 'Deschide poarta' },
      { id: 'adu_fan', label: 'Adu balot de fân' },
      { id: 'pune_in_iesle', label: 'Pune fânul în iesle' },
      { id: 'adu_apa', label: 'Adu apă proaspătă' },
      { id: 'toarna_apa', label: 'Toarnă apa în adăpătoare' },
      { id: 'lasa_calul', label: 'Lasă calul să intre' },
      { id: 'mangaie', label: 'Mângâie calul' },
    ],
    solution: [
      A('deschide_poarta'),
      A('adu_fan'),
      A('pune_in_iesle'),
      A('adu_apa'),
      A('toarna_apa'),
      A('lasa_calul'),
    ],
    fails: [
      {
        text: 'Calul s-a lovit de poarta ÎNCHISĂ și a nechezat supărat! Deschide poarta întâi.',
        anim: 'none',
        matches: (p) => before(p, 'lasa_calul', 'deschide_poarta'),
      },
      {
        text: 'Ai turnat apă în adăpătoarea goală — de unde n-a adus-o nimeni! Doar o baltă pe jos.',
        anim: 'bucket',
        matches: (p) => before(p, 'toarna_apa', 'adu_apa'),
      },
      {
        text: 'Calul a rămas nemulțumit — nici mâncare, nici apă la vreme. Ordinea, flăcăule!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  spalatorie: {
    id: 'spalatorie',
    title: 'Spălătoria la pârâu — rufele curate',
    intro:
      'BUNICUL FIERAR: „Rufele nu se spală oricum, copile. Adu-le, înmoaie-le-n pârâu, freacă-le cu săpun, clătește-le-n apă curată, stoarce-le bine și abia apoi întinde-le pe frânghie."',
    success: 'Rufele flutură curate-n vânt, albe ca zăpada! (+10 ii tradiționale și 10 sticlă)',
    // Deliberately shuffled: listed in solution order the puzzle solves
    // itself just by dragging the palette down in the order it's given
    rewardItems: [{ id: BlockType.IeBlouse, count: 10 }, { id: BlockType.Glass, count: 10 }],
    reward: '10 ii tradiționale și 10 blocuri de sticlă (Glass)',
    rewardRepeats: true,
    actions: [
      { id: 'stoarce', label: 'Stoarce hainele' },
      { id: 'adu_haine', label: 'Adu hainele murdare' },
      { id: 'freaca', label: 'Freacă cu săpun' },
      { id: 'canta_la_rau', label: 'Cântă la marginea râului' },
      { id: 'intinde', label: 'Întinde pe frânghie' },
      { id: 'clateste', label: 'Clătește în apă curată' },
      { id: 'inmoaie', label: 'Înmoaie în pârâu' },
    ],
    solution: [A('adu_haine'), A('inmoaie'), A('freaca'), A('clateste'), A('stoarce'), A('intinde')],
    fails: [
      {
        text: 'Ai întins hainele UDE LEOARCĂ — apa curge pe toată ulița! Stoarce-le întâi.',
        anim: 'bucket',
        matches: (p) => before(p, 'intinde', 'stoarce'),
      },
      {
        text: 'Ai frecat haine USCATE, nici măcar înmuiate — praf peste tot, nicio pată n-a ieșit!',
        anim: 'none',
        matches: (p) => before(p, 'freaca', 'inmoaie'),
      },
      {
        text: 'Hainele au rămas murdare pe frânghie... Bunica ar avea ceva de spus despre asta!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  gard: {
    id: 'gard',
    title: 'Gardul Luncii — momentul AHA',
    intro:
      'BACIUL LUNCII: „Lunca are nevoie de exact 30 de stâlpi de gard, copile. Pune o buclă «repetă de N ori» cu «pune un stâlp» înăuntru și scrie tu numărul potrivit — nu-l aleg eu pentru tine!"',
    success: 'GARDUL S-A RIDICAT SINGUR, stâlp după stâlp! Oile pot intra în Lunca. (+12 lână și 1 Crystal Sword)',
    rewardItems: [{ id: BlockType.Wool, count: 12 }, { id: WeaponId.CrystalSword, count: 1 }],
    reward: '12 lână și 1 Crystal Sword',
    rewardRepeats: true,
    actions: [
      { id: 'pune_stalp', label: 'Pune un stâlp' },
      { id: 'prinde_capatul', label: 'Prinde capătul gardului' },
      { id: 'fluiera_oi', label: 'Fluieră la oi' },
    ],
    allowRepeat: true,
    solution: [REPEAT(30, [A('pune_stalp')]), A('prinde_capatul')],
    fails: [
      {
        text: 'Ai pus prea mulți! Gardul a ieșit din sat, peste deal, prin curtea vecinului — o boacănă legendară.',
        anim: 'dark',
        matches: (p) => hasNode(p, (n) => repeatCount(n) > 30),
      },
      {
        text: 'Prea puțini stâlpi înfipți — restul gardului e o gaură cât toată Lunca! Oile ies la plimbare.',
        anim: 'dark',
        matches: (p) => hasNode(p, (n) => repeatCount(n) > 0 && repeatCount(n) < 30),
      },
      {
        text: 'Gardul stă pe jumătate, dar capătul flutură-n vânt — nu-i priponit! Ordinea corectă, cu tot ce trebuie.',
        anim: 'dark',
        matches: () => true,
      },
    ],
  },
  camp_grau: {
    id: 'camp_grau',
    title: 'Câmpul de grâu — bucle în bucle',
    intro:
      'BACIUL LUNCII: „Patru rânduri, șase spice pe rând — o buclă ÎN altă buclă, ca niște cutii una-n alta. Cea dinăuntru plantează un rând întreg; cea din afară o repetă pentru toate cele patru rânduri."',
    success: 'CÂMPUL S-A ÎNVERZIT dintr-o dată, rând cu rând! (+12 grâu și 12 Huba Bubă)',
    rewardItems: [{ id: BlockType.Wheat, count: 12 }, { id: ThrowableId.HubaBuba, count: 12 }],
    reward: '12 grâu și 12 Huba Bubă',
    rewardRepeats: true,
    actions: [
      { id: 'planteaza_spic', label: 'Plantează spicul' },
      { id: 'canta_ciocarlia', label: 'Cântă ciocârliei' },
    ],
    allowRepeat: true,
    solution: [REPEAT(4, [REPEAT(6, [A('planteaza_spic')])])],
    fails: [
      {
        text: 'Buclele-s inversate — a ieșit UN SINGUR RÂND absurd de lung, care trece dincolo de hartă!',
        anim: 'dark',
        matches: (p) =>
          hasNode(
            p,
            (n) => n.kind === 'repeat' && repeatCount(n) === 6 && hasNode(n.body, (m) => repeatCount(m) === 4),
          ),
      },
      {
        text: 'Câmpul a rămas pe jumătate gol — numerele buclelor nu se potrivesc cu 4 rânduri și 6 spice. Încearcă din nou!',
        anim: 'dark',
        matches: () => true,
      },
    ],
  },
  moara: {
    id: 'moara',
    title: 'Moara de apă — bucla infinită',
    intro:
      'BACIUL LUNCII: „Pornește șuvoiul, apoi pune o buclă «cât timp curge apa» cu «macină» înăuntru. Asta-i o buclă fără capăt — moara nu se oprește niciodată singură, cât timp apa curge."',
    success: 'MOARA MACINĂ ÎNTRUNA, roata nu se mai oprește! (+12 făină și 1 Magma Hammer)',
    rewardItems: [{ id: BlockType.Flour, count: 12 }, { id: WeaponId.MagmaHammer, count: 1 }],
    reward: '12 făină și 1 Magma Hammer',
    rewardRepeats: true,
    actions: [
      { id: 'porneste_apa', label: 'Pornește șuvoiul de apă' },
      { id: 'macina', label: 'Macină' },
      { id: 'opreste_apa', label: 'Oprește apa' },
    ],
    conditions: [{ id: 'apa_curge', label: 'curge apa' }],
    allowWhile: true,
    solution: [A('porneste_apa'), WHILE('apa_curge', [A('macina')])],
    fails: [
      {
        text: 'Ai oprit apa, dar bucla ta zicea «cât timp curge apa» — morarul nu înțelege de ce te-ai oprit TU, nu bucla!',
        anim: 'none',
        matches: (p) => flattenActions(p).includes('opreste_apa'),
      },
      {
        text: 'Moara macină în gol — scârțâie, scoate fum, iar morarul iese afară furios! Fără apă, nu-i bucla ta.',
        anim: 'coal',
        matches: (p) => !flattenActions(p).includes('porneste_apa') && flattenActions(p).includes('macina'),
      },
      {
        text: 'Moara stă neclintită... pune macinatul ÎN bucla care curge, măcar o dată!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  livada: {
    id: 'livada',
    title: 'Livada de meri — bucla cu mai mulți pași',
    intro:
      'BACIUL LUNCII: „Până acum ai pus câte-o singură poruncă în buclă. Da\' un pom nu se sădește dintr-o mișcare: sapi groapa, pui puietul, îl uzi. Bagă toți trei pașii ÎN buclă, în ordinea lor, și repetă pentru fiecare din cei patru pomi — nu uita sapa la-nceput și gardul la sfârșit."',
    success: 'LIVADA S-A ÎNVERZIT — patru meri, sădiți unul după altul de aceeași buclă! (+12 bușteni și 12 obsidian)',
    rewardItems: [{ id: BlockType.Log, count: 12 }, { id: BlockType.Obsidian, count: 12 }],
    reward: '12 bușteni și 12 obsidian',
    rewardRepeats: true,
    actions: [
      { id: 'uda_puietul', label: 'Udă puietul' },
      { id: 'ia_sapa', label: 'Ia sapa din șură' },
      { id: 'ingradeste_livada', label: 'Îngrădește livada' },
      { id: 'sapa_groapa', label: 'Sapă groapa' },
      { id: 'sperie_ciorile', label: 'Sperie ciorile' },
      { id: 'pune_puietul', label: 'Pune puietul' },
    ],
    allowRepeat: true,
    solution: [
      A('ia_sapa'),
      REPEAT(4, [A('sapa_groapa'), A('pune_puietul'), A('uda_puietul')]),
      A('ingradeste_livada'),
    ],
    fails: [
      {
        text: 'Ai udat gropile GOALE — patru bălți frumoase și niciun pom în ele! Pune puietul înainte să torni apa.',
        anim: 'splash',
        matches: (p) => before(p, 'uda_puietul', 'pune_puietul'),
      },
      {
        text: 'Ai înfipt puieții în pământ NESĂPAT — s-au îndoit toți patru ca niște cârlige. Sapă groapa întâi!',
        anim: 'dark',
        matches: (p) => before(p, 'pune_puietul', 'sapa_groapa'),
      },
      {
        text: 'Numărul buclei nu-i bun — livada are loc de exact patru meri, nici mai mulți, nici mai puțini.',
        anim: 'dark',
        matches: (p) => hasNode(p, (n) => n.kind === 'repeat' && repeatCount(n) !== 4),
      },
      {
        text: 'Ai pus pașii pe rând, pe dinafara buclei — merge, dar e trudă de pomana. Bagă toți trei pașii ÎNĂUNTRUL buclei.',
        anim: 'none',
        matches: (p) => hasTopLevelAction(p, 'sapa_groapa') || hasTopLevelAction(p, 'pune_puietul'),
      },
      {
        text: 'Livada a rămas pe jumătate sădită. Sapa întâi, apoi bucla cu cei trei pași, apoi gardul — încearcă din nou!',
        anim: 'dark',
        matches: () => true,
      },
    ],
  },
  capite: {
    id: 'capite',
    title: 'Căpițele de fân — bucla din buclă, cu pași',
    intro:
      'BACIUL LUNCII: „Asta-i cea mai grea din luncă, copile. Trei căpițe, și fiecare se face la fel: înfigi parul, arunci fânul de patru ori, legi vârful. Va să zică o buclă mică de aruncat fân, băgată într-o buclă mare care face toate cele trei căpițe — și amândouă cu pași înainte și după. Coasa întâi!"',
    success: 'TREI CĂPIȚE ÎNALTE, legate ca la carte — bucla din buclă le-a ridicat pe toate! (+20 baloturi de fân și 12 cristal)',
    rewardItems: [{ id: BlockType.Hay, count: 20 }, { id: BlockType.Crystal, count: 12 }],
    reward: '20 baloturi de fân și 12 cristal',
    rewardRepeats: true,
    actions: [
      { id: 'arunca_fanul', label: 'Aruncă fânul cu furca' },
      { id: 'leaga_capita', label: 'Leagă vârful căpiței' },
      { id: 'coseste_iarba', label: 'Cosește iarba' },
      { id: 'infige_parul', label: 'Înfige parul' },
      { id: 'bea_apa', label: 'Bea o gură de apă' },
    ],
    allowRepeat: true,
    solution: [
      A('coseste_iarba'),
      REPEAT(3, [A('infige_parul'), REPEAT(4, [A('arunca_fanul')]), A('leaga_capita')]),
    ],
    fails: [
      {
        text: 'Ai aruncat fânul fără PAR în mijloc — s-a împrăștiat tot, de l-a luat vântul peste luncă!',
        anim: 'dark',
        matches: (p) => before(p, 'arunca_fanul', 'infige_parul'),
      },
      {
        text: 'Ai legat vârful ÎNAINTE să arunci fânul — ai legat un par gol, frumos și singur. Fânul întâi!',
        anim: 'dark',
        matches: (p) => before(p, 'leaga_capita', 'arunca_fanul'),
      },
      {
        text: 'Bucla dinăuntru n-are numărul bun — o căpiță se face din exact patru furci de fân, altfel iese o movilă strâmbă.',
        anim: 'dark',
        matches: (p) =>
          hasNode(
            p,
            (n) =>
              n.kind === 'repeat' &&
              repeatCount(n) !== 4 &&
              n.body.length === 1 &&
              n.body[0].kind === 'action' &&
              n.body[0].id === 'arunca_fanul',
          ),
      },
      {
        text: 'Bucla din afară n-are numărul bun — lunca are loc de exact trei căpițe.',
        anim: 'dark',
        matches: (p) =>
          hasNode(
            p,
            (n) =>
              n.kind === 'repeat' &&
              repeatCount(n) !== 3 &&
              n.body.some((m) => m.kind === 'action' && m.id === 'infige_parul'),
          ),
      },
      {
        text: 'Cositul se face O SINGURĂ DATĂ, la început — nu la fiecare căpiță. Scoate-l din buclă!',
        anim: 'dark',
        matches: (p) =>
          hasNode(p, (n) => n.kind === 'repeat' && hasNode(n.body, (m) => m.kind === 'action' && m.id === 'coseste_iarba')),
      },
      {
        text: 'Căpițele-s strâmbe. Cosește, apoi o buclă de trei cu: par, patru furci de fân, legat vârful. Mai încearcă!',
        anim: 'dark',
        matches: () => true,
      },
    ],
  },
  poteca: {
    id: 'poteca',
    title: 'Poteca Mumei Pădurii — prima decizie',
    intro:
      'MUMA PĂDURII: „Hâhâhî! Vrei să treci prin pădurea mea, copile? Pune un bloc «dacă / altfel»: DACĂ e noapte, aprinde felinarul; ALTFEL, stinge-l. Alege bine condiția, ori te-ncurc în potecă!"',
    success:
      'Felinarul ascultă de noapte și de zi, cum se cuvine! Muma Pădurii chicotește mulțumită — poteca-i deschisă. (+8 ciuperci)',
    rewardItems: [{ id: BlockType.Mushroom, count: 8 }],
    reward: '8 ciuperci',
    actions: [
      { id: 'aprinde', label: 'Aprinde felinarul' },
      { id: 'stinge', label: 'Stinge felinarul' },
    ],
    conditions: [
      { id: 'e_noapte', label: 'e noapte' },
      { id: 'e_zi', label: 'e zi' },
    ],
    allowIf: true,
    solution: [IF('e_noapte', [A('aprinde')], [A('stinge')])],
    fails: [
      {
        text: 'Felinar aprins ZIUA?! Muma Pădurii râde de tine și-ți încurcă poteca — te trezești înapoi la intrare!',
        anim: 'dark',
        matches: (p) => hasNode(p, (n) => n.kind === 'if' && n.cond === 'e_zi'),
      },
      {
        text: 'Felinarul arde și ziua, și noaptea — l-ai aprins în afara oricărei condiții! Risipă mare.',
        anim: 'none',
        matches: (p) => hasTopLevelAction(p, 'aprinde'),
      },
      {
        text: 'Condiția-i pe jumătate — lipsește ori DACĂ, ori ALTFEL. Muma Pădurii așteaptă, răbdătoare.',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  pod: {
    id: 'pod',
    title: 'Podul mișcător — senzori',
    intro:
      'BUNICUL FIERAR: „Râul crește și scade fără veste, copile. Verifică semnul de nivel, apoi pune: DACĂ apa-i peste semn, ridică podul. Greșești comparația, și-i vai de cel care trece!"',
    success:
      'PODUL RĂSPUNDE LA RÂU, ca un senzor adevărat! Drum sigur peste apă, ploaie sau secetă. (+10 bolovani de râu)',
    rewardItems: [{ id: BlockType.RiverStone, count: 10 }],
    reward: '10 bolovani de râu',
    actions: [
      { id: 'verifica_semnul', label: 'Verifică semnul de nivel' },
      { id: 'ridica', label: 'Ridică podul' },
      { id: 'coboara_mereu', label: 'Lasă podul jos mereu' },
    ],
    conditions: [
      { id: 'apa_peste_semn', label: 'apa > semn' },
      { id: 'apa_sub_semn', label: 'apa < semn' },
    ],
    allowIf: true,
    solution: [A('verifica_semnul'), IF('apa_peste_semn', [A('ridica')])],
    fails: [
      {
        text: 'Comparația-i pe dos — podul s-a ridicat FIX când trecea boierul cu căruța. Pleosc! Fail-ul suprem.',
        anim: 'splash',
        matches: (p) => hasNode(p, (n) => n.kind === 'if' && n.cond === 'apa_sub_semn'),
      },
      {
        text: 'Podul stă jos orice-ar fi — la prima viitură, satul rămâne fără drum.',
        anim: 'none',
        matches: (p) => hasTopLevelAction(p, 'coboara_mereu'),
      },
      {
        text: 'Fără semnul verificat întâi, podul reacționează aiurea. Ordinea, copile!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
  capcana: {
    id: 'capcana',
    title: 'Capcana de lup — ȘI logic',
    intro:
      'BUNICUL FIERAR: „Verifică urmele, apoi pune: DACĂ e lup ȘI e noapte, declanșează capcana. Alege bine condiția din listă — oile care trec ziua nu-s treaba capcanei!"',
    success: 'CAPCANA-I ISCUSITĂ — prinde lupul, cruță oile! Turma-i pe deplin ocrotită. (+10 lână și 3 comori dacice)',
    rewardItems: [{ id: BlockType.Wool, count: 10 }, { id: BlockType.DacianGold, count: 3 }],
    reward: '10 lână și 3 comori dacice',
    actions: [
      { id: 'verifica_urme', label: 'Verifică urmele' },
      { id: 'declanseaza', label: 'Declanșează capcana' },
    ],
    conditions: [
      { id: 'lup_si_noapte', label: 'e lup ȘI e noapte' },
      { id: 'lup', label: 'e lup' },
      { id: 'noapte', label: 'e noapte' },
    ],
    allowIf: true,
    solution: [A('verifica_urme'), IF('lup_si_noapte', [A('declanseaza')])],
    fails: [
      {
        text: 'Fără «ȘI noapte» — capcana a prins OAIA SATULUI la amiază! Behăit dramatic, sătenii nemulțumiți.',
        anim: 'dark',
        matches: (p) => hasNode(p, (n) => n.kind === 'if' && n.cond === 'lup'),
      },
      {
        text: 'Capcana s-a declanșat noaptea... dar fără lup — doar un iepuraș speriat! Lipsește condiția lupului.',
        anim: 'none',
        matches: (p) => hasNode(p, (n) => n.kind === 'if' && n.cond === 'noapte'),
      },
      {
        text: 'Capcana-i moartă — nici urmă de lup prins. Verifică urmele și pune condiția întreagă!',
        anim: 'none',
        matches: () => true,
      },
    ],
  },
};
