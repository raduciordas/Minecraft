import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenActions, VATRA_PUZZLES } from '../src/vatra/VatraPuzzles.ts';
import { BlockType } from '../src/world/Block.ts';
import { ZONE_DEFS } from '../src/vatra/VatraModule.ts';
import {
  BUCLA_ORIGIN,
  BUCLA_HOME_TREE_ORIGIN,
  LOOP_RECAP_ROUTES,
  MUNTE_ORIGIN,
  PADUREA_ORIGIN,
  VATRA_ORIGIN,
  buildMunteZone,
  buildPadureaZone,
  buildVatraSatului,
  buildBuclaBridge,
  buildBuclaHomeTree,
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
  assert.ok(vatra.edgeTerraceDepth >= 12);
  assert.ok(munte.edgeTerraceDepth >= 12);
  assert.equal(munte.pad, 4);
  assert.equal(vatra.naturalClearance, 8);
  assert.equal(munte.naturalClearance, 8);
});

test('Bunicul tree has a complete trunk and the crossroads front is filled', () => {
  const vatra = buildVatraSatului(VATRA_ORIGIN.x, VATRA_ORIGIN.z);
  const trunk = vatra.blocks.filter((block) =>
    block.dx === 13 && block.dz === 8 && block.block === BlockType.Log
  );
  assert.deepEqual(trunk.map((block) => block.dy), [1, 2, 3, 4, 5]);

  const padurea = buildPadureaZone(PADUREA_ORIGIN.x, PADUREA_ORIGIN.z);
  const apron = padurea.blocks.filter((block) =>
    block.dx >= 5 && block.dx <= 17 &&
    block.dz >= 4 && block.dz <= 8 &&
    block.dy === 0 && block.block === BlockType.Grass
  );
  assert.equal(apron.length, 65);
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
  const homeTree = buildBuclaHomeTree(BUCLA_HOME_TREE_ORIGIN.x, BUCLA_HOME_TREE_ORIGIN.z);
  assert.equal(bridge.blocks.filter((block) => block.block === BlockType.Plank).length, 24);
  assert.ok(zone.clearAbove >= 8);
  assert.equal(zone.naturalClearance, 8);
  assert.ok(bridge.clearAbove >= 8);
  assert.equal(bridge.pad, 0);

  const [turnX, turnZ] = LOOP_RECAP_ROUTES.tup_in_poiana.start;
  assert.ok(zone.blocks.some((block) =>
    block.dx === turnX && block.dz === turnZ && block.dy === 0 && block.block === BlockType.Snow
  ));
  assert.ok(zone.blocks.some((block) =>
    block.dx === turnX && block.dz === turnZ - 1 && block.dy === 0 && block.block === BlockType.RiverStone
  ));
  const bridgeMinX = Math.min(...bridge.blocks.map((block) => block.dx)) - bridge.pad;
  const bridgeMaxX = Math.max(...bridge.blocks.map((block) => block.dx)) + bridge.pad;
  const bridgeMinZ = Math.min(...bridge.blocks.map((block) => block.dz)) - bridge.pad;
  const bridgeMaxZ = Math.max(...bridge.blocks.map((block) => block.dz)) + bridge.pad;
  assert.equal(
    turnX >= bridgeMinX && turnX <= bridgeMaxX && turnZ >= bridgeMinZ && turnZ <= bridgeMaxZ,
    false,
  );

  const trunk = homeTree.blocks.filter((block) =>
    block.dx === 0 && block.dz === 0 && block.block === BlockType.Log
  );
  assert.deepEqual(trunk.map((block) => block.dy), [1, 2, 3, 4, 5]);
  const homeGoal = mountainRouteStates(LOOP_RECAP_ROUTES.tup_acasa).at(-1);
  assert.equal(
    Math.abs(BUCLA_HOME_TREE_ORIGIN.x - BUCLA_ORIGIN.x - homeGoal.x) +
      Math.abs(BUCLA_HOME_TREE_ORIGIN.z - BUCLA_ORIGIN.z - homeGoal.z),
    4,
  );

  assert.deepEqual(zone.levelOrigin, PADUREA_ORIGIN);
  assert.deepEqual(bridge.levelOrigin, PADUREA_ORIGIN);
  assert.deepEqual(homeTree.levelOrigin, PADUREA_ORIGIN);
  assert.deepEqual(ZONE_DEFS.find((item) => item.id === 'bucla').levelOrigin, PADUREA_ORIGIN);
});
