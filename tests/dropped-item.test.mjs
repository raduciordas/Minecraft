import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/player/Inventory.ts';

test('inventory remove and add for dropped item mechanics', () => {
  const inv = new Inventory();
  const itemId = 1; // Dirt

  inv.add(itemId, 5);
  assert.equal(inv.count(itemId), 5);

  // Dropping 1 item reduces inventory count
  const removed = inv.remove(itemId, 1);
  assert.equal(removed, true);
  assert.equal(inv.count(itemId), 4);

  // Picking up item restores inventory count
  inv.add(itemId, 1);
  assert.equal(inv.count(itemId), 5);
});

test('dropping item when inventory empty fails', () => {
  const inv = new Inventory();
  const itemId = 10;

  assert.equal(inv.count(itemId), 0);
  const removed = inv.remove(itemId, 1);
  assert.equal(removed, false);
  assert.equal(inv.count(itemId), 0);
});
