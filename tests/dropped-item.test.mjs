import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/player/Inventory.ts';
import { ThrowableId } from '../src/items/Throwable.ts';
import { VATRA_PUZZLES } from '../src/vatra/VatraPuzzles.ts';

test('dropping and picking up one item preserves inventory stock', () => {
  const inventory = new Inventory();
  inventory.add(1, 5);

  assert.equal(inventory.remove(1), true);
  assert.equal(inventory.count(1), 4);

  inventory.add(1);
  assert.equal(inventory.count(1), 5);
});

test('cannot drop an item that is not in the inventory', () => {
  const inventory = new Inventory();
  assert.equal(inventory.remove(10), false);
  assert.equal(inventory.count(10), 0);
});

test('Socoteala stanii rewards fermented socata instead of a map', () => {
  const reward = VATRA_PUZZLES.socoteala_stanii.rewardItems;
  assert.deepEqual(reward, [{ id: ThrowableId.SocataBottle, count: 10 }]);
});
