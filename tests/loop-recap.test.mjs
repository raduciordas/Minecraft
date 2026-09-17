import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenActions, VATRA_PUZZLES } from '../src/vatra/VatraPuzzles.ts';
import { BlockType } from '../src/world/Block.ts';
import { ZONE_DEFS } from '../src/vatra/VatraModule.ts';
import {
  BUCLA_ORIGIN,
  LOOP_RECAP_ROUTES,
  MUNTE_ORIGIN,
  PADUREA_ORIGIN,
  VATRA_ORIGIN,
  buildMunteZone,
  buildVatraSatului,
  buildBuclaBridge,
  buildBuclaZone,
  mountainRouteStates,
} from '../src/world/Structures.ts';

const LESSONS = [
  'tup_la_morcovi',
  'tup_la_pod',
  'tup_in_poiana',
  'tup_la_stup',
  'tup_pe_coasta',
  'tup_acasa',
];

function containsRepeat(nodes) {
  return nodes.some((node) =>
    node.kind === 'repeat' || (node.body && containsRepeat(node.body)),
  );
}

test('loop recap routes match their expanded lesson programs', () => {
  assert.deepEqual(LESSONS.map((id) => LOOP_RECAP_ROUTES[id].steps.length), [8, 12, 16, 20, 24, 30]);
  for (const id of LESSONS) {
    const puzzle = VATRA_PUZZLES[id];
    assert.ok(puzzle, id);
    assert.equal(puzzle.allowRepeat, true, id);
    assert.equal(containsRepeat(puzzle.solution), true, id);
    assert.deepEqual(flattenActions(puzzle.solution), LOOP_RECAP_ROUTES[id].steps, id);
    assert.equal(LOOP_RECAP_ROUTES[id].steps.includes('inapoi'), false, id);
  }
});

test('the six rabbit routes finish at distinct golden stones', () => {
  const goals = LESSONS.map((id) => mountainRouteStates(LOOP_RECAP_ROUTES[id]).at(-1));
  assert.equal(new Set(goals.map((goal) => `${goal.x},${goal.z}`)).size, LESSONS.length);
});

test('the clarified routes never retrace a movement stone', () => {
  for (const id of ['tup_in_poiana', 'tup_la_stup', 'tup_acasa']) {
    const route = LOOP_RECAP_ROUTES[id];
    let [x, z] = route.start;
    let heading = 0;
    const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const visited = new Set([`${x},${z}`]);
    for (const step of route.steps) {
      if (step === 'stanga') heading = (heading + 3) % 4;
      else if (step === 'dreapta') heading = (heading + 1) % 4;
      else {
        x += vectors[heading][0];
        z += vectors[heading][1];
        const key = `${x},${z}`;
        assert.equal(visited.has(key), false, `${id} retraces ${key}`);
        visited.add(key);
      }
    }
  }
});

test('Bunicul and Caliman platforms use deep soil facings', () => {
  const vatra = buildVatraSatului(VATRA_ORIGIN.x, VATRA_ORIGIN.z);
  const munte = buildMunteZone(MUNTE_ORIGIN.x, MUNTE_ORIGIN.z);
  assert.ok(vatra.edgeSoilDepth >= 6);
  assert.ok(munte.edgeSoilDepth >= 6);
  assert.ok(vatra.edgeTerraceDepth >= 6);
  assert.ok(munte.edgeTerraceDepth >= 6);
});

test('the home route stays outside Muma Padurii crossroads', () => {
  const route = LOOP_RECAP_ROUTES.tup_acasa;
  const states = mountainRouteStates(route);
  for (const state of states) {
    const wx = BUCLA_ORIGIN.x + state.x;
    const wz = BUCLA_ORIGIN.z + state.z;
    const insideCrossroads =
      wx >= PADUREA_ORIGIN.x + 5 && wx <= PADUREA_ORIGIN.x + 17 &&
      wz >= PADUREA_ORIGIN.z && wz <= PADUREA_ORIGIN.z + 7;
    assert.equal(insideCrossroads, false, `home route overlaps crossroads at ${wx},${wz}`);
  }
});

test('the final rabbit lesson contains a nested loop', () => {
  const outer = VATRA_PUZZLES.tup_acasa.solution[0];
  assert.equal(outer.kind, 'repeat');
  assert.equal(outer.body[0].kind, 'repeat');
});

test('each loop recap lesson awards one existing weapon type', () => {
  assert.deepEqual(
    LESSONS.map((id) => VATRA_PUZZLES[id].rewardItems.map((item) => item.id)),
    [[100], [101], [102], [103], [104], [105]],
  );
  assert.deepEqual(VATRA_PUZZLES.tup_acasa.rewardItems[0], { id: 105, count: 20, refill: true });
});

test('the lower meadow clears the orphaned tree corridor and bridges back uphill', () => {
  assert.ok(Math.hypot(BUCLA_ORIGIN.x, BUCLA_ORIGIN.z) < Math.hypot(MUNTE_ORIGIN.x, MUNTE_ORIGIN.z));
  const zone = buildBuclaZone(BUCLA_ORIGIN.x, BUCLA_ORIGIN.z);
  const bridge = buildBuclaBridge(BUCLA_ORIGIN.x, BUCLA_ORIGIN.z);
  assert.equal(bridge.blocks.filter((block) => block.block === BlockType.Plank).length, 24);
  assert.ok(zone.clearAbove >= 8);
  assert.ok(bridge.clearAbove >= 8);
  assert.deepEqual(zone.levelOrigin, PADUREA_ORIGIN);
  assert.deepEqual(bridge.levelOrigin, PADUREA_ORIGIN);
  assert.deepEqual(ZONE_DEFS.find((item) => item.id === 'bucla').levelOrigin, PADUREA_ORIGIN);
});
