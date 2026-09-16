import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenActions, programEquivalent, VATRA_PUZZLES } from '../src/vatra/VatraPuzzles.ts';
import { MOUNTAIN_ROUTES, mountainRoutePoints } from '../src/world/Structures.ts';

const LESSONS = ['iedul_la_izvor', 'iedul_printre_stanci', 'iedul_pe_creasta'];

test('mountain sequence lessons grow gradually and use only direction actions', () => {
  assert.deepEqual(LESSONS.map((id) => MOUNTAIN_ROUTES[id].steps.length), [8, 11, 14]);
  for (const id of LESSONS) {
    const puzzle = VATRA_PUZZLES[id];
    assert.ok(puzzle);
    assert.deepEqual(flattenActions(puzzle.solution), MOUNTAIN_ROUTES[id].steps);
    assert.equal(puzzle.solution.every((node) => node.kind === 'action'), true);
    assert.equal(puzzle.allowRepeat, undefined);
    assert.equal(puzzle.allowIf, undefined);
    assert.equal(puzzle.allowWhile, undefined);
  }
});

test('every mountain route starts on white marker and ends at a distinct goal', () => {
  const goals = new Set();
  for (const id of LESSONS) {
    const route = MOUNTAIN_ROUTES[id];
    const points = mountainRoutePoints(route);
    assert.equal(points.length, route.steps.length + 1);
    const goal = points.at(-1);
    goals.add(goal.join(','));
  }
  assert.equal(goals.size, LESSONS.length);
});

test('changing one direction no longer matches the lesson solution', () => {
  const puzzle = VATRA_PUZZLES.iedul_la_izvor;
  const wrong = puzzle.solution.map((node, index) =>
    index === 0 ? { kind: 'action', id: 'vest' } : node,
  );
  assert.equal(programEquivalent(wrong, puzzle.solution), false);
});
