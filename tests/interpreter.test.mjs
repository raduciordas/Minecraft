import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, tracesEqual } from '../src/vatra/Interpreter.ts';
import { A, ADD, AND, CALL, CHG, CMP, DEF, IF, NOT, OR, REPEAT, RND, S, SET, V, WHEN, WHILE } from '../src/vatra/VatraPuzzles.ts';

const puzzle = (overrides = {}) => ({
  id: 'test', title: 'Test', intro: '', success: '', reward: '', rewardItems: [], actions: [], solution: [], fails: [], ...overrides,
});

const actions = (result) => result.scenarios[0].trace.filter((x) => x.t === 'act');

test('executes actions, arithmetic, variables, and repeat loops in order', () => {
  const result = evaluate(puzzle(), [SET('n', 2), CHG('n', 1), REPEAT(V('n'), [A('pas')]), A('gata', ADD(V('n'), 4))]);
  assert.deepEqual(actions(result), [
    { t: 'act', id: 'pas' }, { t: 'act', id: 'pas' }, { t: 'act', id: 'pas' }, { t: 'act', id: 'gata', arg: 7 },
  ]);
  assert.equal(result.scenarios[0].vars.n, 3);
});

test('evaluates comparisons and boolean operators', () => {
  const condition = AND(CMP(3, '>', 2), OR(CMP(1, '=', 0), NOT(CMP(4, '!=', 4))));
  assert.deepEqual(actions(evaluate(puzzle(), [IF(condition, [A('da')], [A('nu')])])), [{ t: 'act', id: 'da' }]);
});

test('consumes scenario conditions and sensors deterministically', () => {
  const p = puzzle({ scenarios: [{ label: 'drum', conds: { liber: [true, true, false] }, sensors: { distanta: 4 } }] });
  const result = evaluate(p, [WHILE('liber', [A('pas')]), A('citit', S('distanta'))]);
  assert.deepEqual(actions(result), [
    { t: 'act', id: 'pas' }, { t: 'act', id: 'pas' }, { t: 'act', id: 'citit', arg: 4 },
  ]);
});

test('runs matching event handlers after the main program', () => {
  const p = puzzle({ scenarios: [{ label: 'seara', events: ['apus'] }] });
  const result = evaluate(p, [A('pregateste'), WHEN('apus', [A('aprinde')])]);
  assert.deepEqual(result.scenarios[0].trace, [
    { t: 'act', id: 'pregateste' }, { t: 'evt', id: 'apus' }, { t: 'act', id: 'aprinde' },
  ]);
});

test('evaluates procedure arguments before binding any parameters', () => {
  const program = [
    SET('x', 1), SET('y', 2),
    DEF('schimba', ['x', 'y'], [A('pereche', ADD({ kind: 'mul', a: V('x'), b: 10 }, V('y')))]),
    CALL('schimba', [V('y'), V('x')]),
  ];
  assert.deepEqual(actions(evaluate(puzzle(), program)), [{ t: 'act', id: 'pereche', arg: 21 }]);
});

test('restores variables shadowed by procedure parameters', () => {
  const result = evaluate(puzzle(), [SET('x', 7), DEF('f', ['x'], [CHG('x', 5)]), CALL('f', [1]), A('x', V('x'))]);
  assert.deepEqual(actions(result).at(-1), { t: 'act', id: 'x', arg: 7 });
});

test('seeded random expressions are repeatable and inclusive', () => {
  const p = puzzle({ scenarios: [{ label: 'zar', seed: 42 }] });
  const program = [REPEAT(20, [A('zar', RND(2, 4))])];
  const first = evaluate(p, program);
  const second = evaluate(p, program);
  assert.ok(tracesEqual(first, second));
  assert.ok(actions(first).every((x) => x.arg >= 2 && x.arg <= 4));
});

test('division by zero returns zero', () => {
  const result = evaluate(puzzle(), [A('cat', { kind: 'div', a: 10, b: 0 })]);
  assert.equal(actions(result)[0].arg, 0);
});

test('recursive programs stop at the safety ceiling', () => {
  const result = evaluate(puzzle(), [DEF('mereu', [], [CALL('mereu')]), CALL('mereu')]);
  assert.equal(result.infinite, true);
  assert.equal(result.scenarios[0].infinite, true);
});

test('different traces are not equivalent', () => {
  assert.equal(tracesEqual(evaluate(puzzle(), [A('a')]), evaluate(puzzle(), [A('b')])), false);
});

