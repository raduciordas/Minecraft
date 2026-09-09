import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/vatra/Interpreter.ts';
import { VATRA_PUZZLES } from '../src/vatra/VatraPuzzles.ts';
import { ALL_ITEM_IDS, canMineBlock, isKnownItem, itemName } from '../src/items/Items.ts';
import { ToolId } from '../src/items/Tool.ts';
import { BOW_QUIVER_SIZE, WEAPONS, WeaponId } from '../src/items/Weapon.ts';
import { BlockType } from '../src/world/Block.ts';

function visit(nodes, fn) {
  for (const node of nodes) {
    fn(node);
    if (node.body) visit(node.body, fn);
    if (node.elseBody) visit(node.elseBody, fn);
  }
}

test('hard blocks require an owned pickaxe', () => {
  assert.equal(canMineBlock(BlockType.Stone, ToolId.Tarnacop, 0), false);
  assert.equal(canMineBlock(BlockType.Stone, ToolId.Tarnacop, 1), true);
  assert.equal(canMineBlock(BlockType.Stone, ToolId.Lopata, 1), false);
  assert.equal(canMineBlock(BlockType.Dirt, ToolId.Lopata, 0), true);
});

test('the item catalogue contains unique, named, known IDs', () => {
  assert.equal(new Set(ALL_ITEM_IDS).size, ALL_ITEM_IDS.length);
  for (const id of ALL_ITEM_IDS) {
    assert.equal(isKnownItem(id), true, `unknown item ${id}`);
    assert.notEqual(itemName(id), String(id), `unnamed item ${id}`);
  }
});

test('every puzzle solution terminates in every scenario', () => {
  for (const puzzle of Object.values(VATRA_PUZZLES)) {
    const result = evaluate(puzzle, puzzle.solution);
    assert.equal(result.infinite, false, `${puzzle.id}: solution did not terminate`);
    assert.equal(result.scenarios.length, puzzle.scenarios?.length || 1, `${puzzle.id}: scenario count`);
  }
});

test('puzzle programs reference declared actions and events', () => {
  for (const puzzle of Object.values(VATRA_PUZZLES)) {
    const actions = new Set(puzzle.actions.map((x) => x.id));
    const events = new Set((puzzle.events || []).map((x) => x.id));
    const programs = [puzzle.solution, puzzle.starterProgram || []];
    for (const program of programs) {
      visit(program, (node) => {
        if (node.kind === 'action') assert.ok(actions.has(node.id), `${puzzle.id}: undeclared action ${node.id}`);
        if (node.kind === 'when') assert.ok(events.has(node.event), `${puzzle.id}: undeclared event ${node.event}`);
      });
    }
  }
});

test('every reward is a positive quantity of a known item', () => {
  for (const puzzle of Object.values(VATRA_PUZZLES)) {
    assert.ok(puzzle.rewardItems.length > 0, `${puzzle.id}: no reward`);
    for (const reward of puzzle.rewardItems) {
      assert.equal(isKnownItem(reward.id), true, `${puzzle.id}: unknown reward ${reward.id}`);
      assert.ok(Number.isInteger(reward.count) && reward.count > 0, `${puzzle.id}: invalid reward count`);
    }
  }
});

test('puzzle IDs and declared IDs are unique', () => {
  const ids = Object.values(VATRA_PUZZLES).map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const puzzle of Object.values(VATRA_PUZZLES)) {
    const actionIds = puzzle.actions.map((x) => x.id);
    const conditionIds = (puzzle.conditions || []).map((x) => x.id);
    const sensorIds = (puzzle.sensors || []).map((x) => x.id);
    const eventIds = (puzzle.events || []).map((x) => x.id);
    for (const [kind, values] of [['action', actionIds], ['condition', conditionIds], ['sensor', sensorIds], ['event', eventIds]]) {
      assert.equal(new Set(values).size, values.length, `${puzzle.id}: duplicate ${kind}`);
    }
  }
});



test('the mushroom lesson refills a twenty-shot bow', () => {
  const bow = VATRA_PUZZLES.ciuperci.rewardItems.find((item) => item.id === WeaponId.Arc);
  assert.deepEqual(bow, { id: WeaponId.Arc, count: BOW_QUIVER_SIZE, refill: true });
  assert.equal(BOW_QUIVER_SIZE, 20);
  assert.equal(WEAPONS[WeaponId.Arc].ammoPerUse, 1);
});
