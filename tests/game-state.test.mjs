import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory } from '../src/player/Inventory.ts';
import { makeBody, stepBody } from '../src/player/Physics.ts';
import { Health, MAX_MAX_HP } from '../src/player/Health.ts';
import { StatusEffects } from '../src/player/StatusEffects.ts';
import { MAX_HP, MAX_OXYGEN_SECONDS } from '../src/config.ts';

test('inventory adds, removes, tops up, serializes, and reloads stock', () => {
  const inventory = new Inventory();
  let changes = 0;
  inventory.onChange(() => changes++);
  inventory.add(12, 3);
  assert.equal(inventory.remove(12, 2), true);
  assert.equal(inventory.remove(12, 2), false);
  inventory.ensureAtLeast(12, 5);
  inventory.ensureAtLeast(12, 4);
  assert.deepEqual(inventory.serialize(), { 12: 5 });
  inventory.load({ 7: 9 });
  assert.equal(inventory.count(12), 0);
  assert.equal(inventory.count(7), 9);
  assert.equal(changes, 4);
});

test('health applies invulnerability and emits death once', () => {
  const health = new Health();
  let deaths = 0;
  health.onDeath(() => deaths++);
  health.damage(4);
  health.damage(4);
  assert.equal(health.hp, MAX_HP - 4);
  health.update(0.51, false);
  health.damage(MAX_HP);
  assert.equal(health.dead, true);
  assert.equal(deaths, 1);
});

test('health regenerates after the delay and respawn restores capacity', () => {
  const health = new Health();
  health.damage(2);
  health.update(7.9, false);
  assert.equal(health.hp, MAX_HP - 2);
  health.update(0.2, false);
  health.update(3, false);
  assert.equal(health.hp, MAX_HP - 1);
  health.damage(MAX_HP);
  health.update(0.51, false);
  health.damage(MAX_HP);
  health.respawn();
  assert.equal(health.hp, health.maxHp);
  assert.equal(health.dead, false);
});

test('drowning consumes oxygen and damages the player', () => {
  const health = new Health();
  health.update(MAX_OXYGEN_SECONDS, true);
  assert.equal(health.oxygen, 0);
  assert.equal(health.hp, MAX_HP - 2);
  health.update(1, false);
  assert.equal(health.oxygen, 4);
});

test('maximum health grows to its cap and survives save restoration', () => {
  const health = new Health();
  health.raiseMaxHp(100);
  assert.equal(health.maxHp, MAX_MAX_HP);
  assert.equal(health.hp, MAX_MAX_HP);
  health.setMaxHp(MAX_HP + 4);
  health.setHp(999);
  assert.equal(health.hp, MAX_HP + 4);
  health.setHp(0);
  assert.equal(health.hp, 1);
});

test('status effects keep the strongest value, extend duration, and expire', () => {
  const effects = new StatusEffects();
  effects.apply({ kind: 'speed', seconds: 2, factor: 1.5 });
  effects.apply({ kind: 'speed', seconds: 5, factor: 1.2 });
  effects.apply({ kind: 'regen', seconds: 1, factor: 2 });
  assert.equal(effects.speedMul, 1.5);
  assert.equal(effects.regenMul, 2);
  assert.match(effects.summary, /iute 5s/);
  effects.update(1.1);
  assert.equal(effects.regenMul, 1);
  effects.update(4);
  assert.equal(effects.speedMul, 1);
  assert.equal(effects.summary, '');
});



test('a swimmer can step from the water onto a one-block bank', () => {
  const bank = new Set(['1,1,0']);
  const world = { getBlock: (x, y, z) => bank.has(`${x},${y},${z}`) ? 1 : 0 };
  const blocked = makeBody(0.3, 1.8);
  Object.assign(blocked, { x: 0.69, y: 1.001, z: 0.5, vx: 2 });
  stepBody(blocked, world, 0.1);
  assert.equal(blocked.hitWall, true);
  assert.ok(blocked.x < 0.8);

  const swimmer = makeBody(0.3, 1.8);
  Object.assign(swimmer, { x: 0.69, y: 1.001, z: 0.5, vx: 2 });
  stepBody(swimmer, world, 0.1, 1.05);
  assert.equal(swimmer.hitWall, false);
  assert.ok(swimmer.x > 0.8);
  assert.ok(swimmer.y > 2);
});
