// The one interpreter for lesson programs. It really evaluates: variables
// hold numbers, conditions and sensors are answered by the lesson's
// scenario, events fire after the main program, procedures are called with
// arguments, "la întâmplare" draws from a seeded generator. The same code
// drives the tabla's animation (drained slowly, with highlights) and the
// grading in VatraModule.finish() (drained in one go), so what the child
// watches and what gets marked can never disagree.
//
// It's written as a generator: every step of interest is yielded as an
// event, and whoever drains it decides whether to pause between them.

import type { Cond, Expr, ProgramNode, Scenario, VatraPuzzle } from './VatraPuzzles';

export type TraceItem = { t: 'act'; id: string; arg?: number } | { t: 'evt'; id: string };

export interface ScenarioResult {
  label: string;
  trace: TraceItem[];
  vars: Record<string, number>; // final values, for the Cutiuțe panel and requirements
  infinite: boolean; // a loop hit the step ceiling
}

export interface RunResult {
  scenarios: ScenarioResult[];
  infinite: boolean;
  steps: number;
}

export type StepEvent =
  | { type: 'scenario'; index: number; total: number; label: string }
  | { type: 'node'; node: ProgramNode; inLoop: boolean } // about to execute this node
  | { type: 'action'; id: string; arg?: number }
  | { type: 'event'; id: string }
  | { type: 'var'; name: string; value: number }
  | { type: 'infinite' };

// Ceilings: a runaway loop ends the run as "infinite" instead of hanging
// the page, and a mistyped huge count can't stall the animation either.
const MAX_REPEAT = 400;
const MAX_WHILE = 200;
const MAX_STEPS = 6000;
const MAX_CALL_DEPTH = 50;
// How many times a "cât timp" loop runs in a lesson that has no scenarios:
// exactly the demo count the old animation used, so nothing changes there
const DEMO_WHILE_ITERATIONS = 5;

class Infinite extends Error {}

// Same small generator TextureAtlas uses, so seeded runs are repeatable
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Reads a scenario's answers one at a time, remembering how far each list
// has been consumed
class ScenarioReader {
  private condCursor = new Map<string, number>();
  private sensorCursor = new Map<string, number>();
  readonly rand: () => number;

  constructor(
    private scenario: Scenario,
    private implicit: boolean,
  ) {
    this.rand = mulberry32(scenario.seed ?? 7);
  }

  cond(id: string): boolean {
    const v = this.scenario.conds?.[id];
    if (v === undefined) {
      // Not something this scenario knows about: in an implicit (scenario-
      // less) lesson a loop still demos a few turns; in a real scenario an
      // unknown condition is simply false
      if (!this.implicit) return false;
      const i = this.condCursor.get(id) ?? 0;
      this.condCursor.set(id, i + 1);
      return i < DEMO_WHILE_ITERATIONS;
    }
    if (typeof v === 'boolean') return v;
    const i = this.condCursor.get(id) ?? 0;
    this.condCursor.set(id, i + 1);
    return v[Math.min(i, v.length - 1)] ?? false;
  }

  sensor(id: string): number {
    const v = this.scenario.sensors?.[id];
    if (v === undefined) return 0;
    if (typeof v === 'number') return v;
    const i = this.sensorCursor.get(id) ?? 0;
    this.sensorCursor.set(id, i + 1);
    return v[Math.min(i, v.length - 1)] ?? 0;
  }

  get events(): string[] {
    return this.scenario.events ?? [];
  }
}

// The scenarios a program is run through: the lesson's own, or one implicit
// run when the lesson has none
function scenariosOf(puzzle: VatraPuzzle): { list: Scenario[]; implicit: boolean } {
  if (puzzle.scenarios && puzzle.scenarios.length > 0) return { list: puzzle.scenarios, implicit: false };
  return { list: [{ label: '' }], implicit: true };
}

export function* execute(puzzle: VatraPuzzle, program: ProgramNode[]): Generator<StepEvent, RunResult, void> {
  const { list, implicit } = scenariosOf(puzzle);
  const results: ScenarioResult[] = [];
  let totalSteps = 0;

  for (let s = 0; s < list.length; s++) {
    const reader = new ScenarioReader(list[s], implicit);
    if (!implicit) yield { type: 'scenario', index: s, total: list.length, label: list[s].label };

    const vars = new Map<string, number>();
    const procs = new Map<string, { params: string[]; body: ProgramNode[] }>();
    for (const n of program) if (n.kind === 'define') procs.set(n.name, { params: n.params, body: n.body });
    const trace: TraceItem[] = [];
    let steps = 0;
    let infinite = false;

    const tick = () => {
      steps++;
      if (steps > MAX_STEPS) throw new Infinite();
    };

    const evalExpr = (e: Expr): number => {
      if (typeof e === 'number') return e;
      switch (e.kind) {
        case 'var':
          return vars.get(e.name) ?? 0;
        case 'sensor':
          return reader.sensor(e.id);
        case 'add':
          return evalExpr(e.a) + evalExpr(e.b);
        case 'sub':
          return evalExpr(e.a) - evalExpr(e.b);
        case 'mul':
          return evalExpr(e.a) * evalExpr(e.b);
        case 'div': {
          const d = evalExpr(e.b);
          return d === 0 ? 0 : Math.floor(evalExpr(e.a) / d);
        }
        case 'random': {
          const lo = Math.ceil(evalExpr(e.min));
          const hi = Math.floor(evalExpr(e.max));
          if (hi < lo) return lo;
          return lo + Math.floor(reader.rand() * (hi - lo + 1));
        }
      }
    };

    const evalCond = (c: Cond): boolean => {
      if (typeof c === 'string') return c === '' ? false : reader.cond(c);
      switch (c.kind) {
        case 'and':
          return evalCond(c.a) && evalCond(c.b);
        case 'or':
          return evalCond(c.a) || evalCond(c.b);
        case 'not':
          return !evalCond(c.a);
        case 'cmp': {
          const a = evalExpr(c.a);
          const b = evalExpr(c.b);
          switch (c.op) {
            case '<':
              return a < b;
            case '>':
              return a > b;
            case '=':
              return a === b;
            case '!=':
              return a !== b;
            case '<=':
              return a <= b;
            case '>=':
              return a >= b;
          }
        }
      }
    };

    // inLoop: whether we're inside a repeat/while body — the tabla animates
    // loop bodies at the computer's speed rather than the child's
    function* runList(nodes: ProgramNode[], inLoop: boolean, callDepth: number): Generator<StepEvent, void, void> {
      for (const node of nodes) {
        if (node.kind === 'define' || node.kind === 'when') continue; // hats only run when triggered
        yield { type: 'node', node, inLoop };
        switch (node.kind) {
          case 'action': {
            tick();
            const arg = node.arg === undefined ? undefined : evalExpr(node.arg);
            trace.push(arg === undefined ? { t: 'act', id: node.id } : { t: 'act', id: node.id, arg });
            yield arg === undefined ? { type: 'action', id: node.id } : { type: 'action', id: node.id, arg };
            break;
          }
          case 'repeat': {
            const n = Math.min(Math.max(Math.floor(evalExpr(node.count)), 0), MAX_REPEAT);
            for (let i = 0; i < n; i++) {
              tick();
              yield* runList(node.body, true, callDepth);
            }
            break;
          }
          case 'while': {
            let turns = 0;
            while (evalCond(node.cond)) {
              tick();
              if (++turns > MAX_WHILE) throw new Infinite();
              yield* runList(node.body, true, callDepth);
            }
            break;
          }
          case 'if': {
            tick();
            if (evalCond(node.cond)) yield* runList(node.body, inLoop, callDepth);
            else yield* runList(node.elseBody, inLoop, callDepth);
            break;
          }
          case 'set': {
            tick();
            const value = evalExpr(node.value);
            vars.set(node.name, value);
            yield { type: 'var', name: node.name, value };
            break;
          }
          case 'change': {
            tick();
            const value = (vars.get(node.name) ?? 0) + evalExpr(node.delta);
            vars.set(node.name, value);
            yield { type: 'var', name: node.name, value };
            break;
          }
          case 'call': {
            tick();
            const proc = procs.get(node.name);
            if (!proc) break; // calling a procedure that was never defined does nothing
            if (callDepth >= MAX_CALL_DEPTH) throw new Infinite();
            // Parameters shadow same-named boxes for the duration of the call
            const saved: [string, number | undefined][] = [];
            proc.params.forEach((p, i) => {
              saved.push([p, vars.get(p)]);
              const value = node.args[i] === undefined ? 0 : evalExpr(node.args[i]);
              vars.set(p, value);
            });
            for (const p of proc.params) yield { type: 'var', name: p, value: vars.get(p) ?? 0 };
            yield* runList(proc.body, inLoop, callDepth + 1);
            for (const [p, old] of saved) {
              if (old === undefined) vars.delete(p);
              else vars.set(p, old);
            }
            break;
          }
        }
      }
    }

    try {
      yield* runList(program, false, 0);
      // Then the world has its turn: every event of the scenario, in order,
      // wakes up each "când" block listening for it
      for (const evt of reader.events) {
        trace.push({ t: 'evt', id: evt });
        yield { type: 'event', id: evt };
        for (const n of program) {
          if (n.kind === 'when' && n.event === evt) {
            yield { type: 'node', node: n, inLoop: false };
            yield* runList(n.body, false, 0);
          }
        }
      }
    } catch (e) {
      if (!(e instanceof Infinite)) throw e;
      infinite = true;
      yield { type: 'infinite' };
    }

    totalSteps += steps;
    results.push({ label: list[s].label, trace, vars: Object.fromEntries(vars), infinite });
  }

  return { scenarios: results, infinite: results.some((r) => r.infinite), steps: totalSteps };
}

// Grades in one go — no pauses, no highlights
export function evaluate(puzzle: VatraPuzzle, program: ProgramNode[]): RunResult {
  const gen = execute(puzzle, program);
  for (;;) {
    const next = gen.next();
    if (next.done) return next.value;
  }
}

// True when the two runs did exactly the same things in every scenario
export function tracesEqual(a: RunResult, b: RunResult): boolean {
  if (a.scenarios.length !== b.scenarios.length) return false;
  return a.scenarios.every((sa, i) => {
    const sb = b.scenarios[i];
    if (sa.trace.length !== sb.trace.length) return false;
    return sa.trace.every((ta, j) => {
      const tb = sb.trace[j];
      if (ta.t !== tb.t || ta.id !== tb.id) return false;
      if (ta.t === 'act' && tb.t === 'act') return (ta.arg ?? null) === (tb.arg ?? null);
      return true;
    });
  });
}
