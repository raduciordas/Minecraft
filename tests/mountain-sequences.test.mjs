import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenActions, programEquivalent, VATRA_PUZZLES } from '../src/vatra/VatraPuzzles.ts';
import {
  MOUNTAIN_ROUTES,
  MUNTE_LEVEL_OFFSET,
  MUNTE_ORIGIN,
  VATRA_ORIGIN,
  buildMunteZone,
  mountainRouteStates,
} from '../src/world/Structures.ts';
import { ZONE_DEFS } from '../src/vatra/VatraModule.ts';

const LESSONS = [
  'iedul_la_izvor',
  'iedul_printre_stanci',
  'iedul_pe_creasta',
  'iedul_la_sare',
  'iedul_la_refugiu',
  'iedul_la_clopot',
];

test('mountain sequence lessons grow gradually and use only relative movement commands', () => {
  assert.deepEqual(LESSONS.map((id) => MOUNTAIN_ROUTES[id].steps.length), [8, 11, 14, 17, 20, 24]);
  const allowed = new Set(['inainte', 'inapoi', 'stanga', 'dreapta']);
  for (const id of LESSONS) {
    const puzzle = VATRA_PUZZLES[id];
    assert.ok(puzzle);
    assert.deepEqual(flattenActions(puzzle.solution), MOUNTAIN_ROUTES[id].steps);
    assert.equal(puzzle.solution.every((node) => node.kind === 'action' && allowed.has(node.id)), true);
    assert.equal(puzzle.allowRepeat, undefined);
    assert.equal(puzzle.allowIf, undefined);
    assert.equal(puzzle.allowWhile, undefined);
  }
});

test('turns change orientation while forward and backward move relative to it', () => {
  const states = mountainRouteStates({
    start: [0, 0],
    steps: ['dreapta', 'inainte', 'stanga', 'inapoi'],
  });
  assert.deepEqual(states, [
    { x: 0, z: 0, heading: 0 },
    { x: 0, z: 0, heading: 1 },
    { x: 1, z: 0, heading: 1 },
    { x: 1, z: 0, heading: 0 },
    { x: 1, z: 1, heading: 0 },
  ]);
});

test('all mountain routes end at distinct goals and the final routes never step backward', () => {
  const goals = new Set();
  for (const id of LESSONS) {
    const route = MOUNTAIN_ROUTES[id];
    const states = mountainRouteStates(route);
    const goal = states.at(-1);
    goals.add(`${goal.x},${goal.z}`);
  }
  assert.equal(goals.size, LESSONS.length);

  for (const id of LESSONS.slice(3)) {
    assert.equal(MOUNTAIN_ROUTES[id].steps.includes('inapoi'), false);
    assert.deepEqual(new Set(MOUNTAIN_ROUTES[id].steps), new Set(['inainte', 'stanga', 'dreapta']));
  }
});

test('changing one command no longer matches the lesson solution', () => {
  const puzzle = VATRA_PUZZLES.iedul_la_izvor;
  const wrong = puzzle.solution.map((node, index) =>
    index === 0 ? { kind: 'action', id: 'inapoi' } : node,
  );
  assert.equal(programEquivalent(wrong, puzzle.solution), false);
});


test('mountain practice platform sits five blocks lower and reconnects to the massif', () => {
  assert.equal(MUNTE_LEVEL_OFFSET, -5);
  assert.equal(ZONE_DEFS.find((zone) => zone.id === 'munte').levelOffset, MUNTE_LEVEL_OFFSET);
  const platform = buildMunteZone(MUNTE_ORIGIN.x, MUNTE_ORIGIN.z);
  assert.equal(platform.levelOffset, MUNTE_LEVEL_OFFSET);
  assert.ok(platform.edgeTerraceDepth >= 12);
  assert.equal(platform.pad, 4);
  assert.equal(platform.naturalClearance, 8);
  assert.ok(Math.hypot(MUNTE_ORIGIN.x, MUNTE_ORIGIN.z) < 70);
  assert.ok(Math.hypot(MUNTE_ORIGIN.x - VATRA_ORIGIN.x, MUNTE_ORIGIN.z - VATRA_ORIGIN.z) < 45);
});
