import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/vatra/Interpreter.ts';
import { VATRA_PUZZLES } from '../src/vatra/VatraPuzzles.ts';
import { ZONE_DEFS } from '../src/vatra/VatraModule.ts';
import { ZONES } from '../src/ui/LessonInfoPanel.ts';
import { buildHelpSections } from '../src/ui/HelpData.ts';
import { BlockType } from '../src/world/Block.ts';
import { ThrowableId } from '../src/items/Throwable.ts';
import { WeaponId } from '../src/items/Weapon.ts';
import { World, worldToChunk } from '../src/world/World.ts';
import { WORLD_SEED } from '../src/config.ts';
import {
  MUNTE_ORIGIN,
  STRAJA_ORIGIN,
  TARG_ORIGIN,
  buildMunteZone,
  buildStrajaZone,
  buildTargZone,
} from '../src/world/Structures.ts';

const CONDITIONALS = [
  'felinarul_din_defileu', 'podul_de_ceata', 'caruta_ratacita',
  'semnalele_strajii', 'tabara_drumetilor', 'poarta_castelului',
];
const VARIABLES = [
  'desagii_caravanei', 'sticlele_de_socata', 'proviziile_drumului',
  'lada_cu_huba', 'transportul_de_sare', 'socoteala_castelului',
];

function countKind(nodes, kind) {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === kind) count++;
    if (node.body) count += countKind(node.body, kind);
    if (node.elseBody) count += countKind(node.elseBody, kind);
  }
  return count;
}

test('the two consolidation phases expose six lessons each on the map', () => {
  assert.deepEqual(ZONE_DEFS.find((zone) => zone.id === 'straja').puzzles, CONDITIONALS);
  assert.deepEqual(ZONE_DEFS.find((zone) => zone.id === 'targ').puzzles, VARIABLES);
  assert.deepEqual(ZONES.straja.lessons, CONDITIONALS);
  assert.deepEqual(ZONES.targ.lessons, VARIABLES);
  assert.deepEqual(ZONE_DEFS.find((zone) => zone.id === 'straja').origin, STRAJA_ORIGIN);
  assert.deepEqual(ZONE_DEFS.find((zone) => zone.id === 'targ').origin, TARG_ORIGIN);
});

test('both new terraces contain six distinct lesson stations', () => {
  for (const structure of [buildStrajaZone(STRAJA_ORIGIN.x, STRAJA_ORIGIN.z), buildTargZone(TARG_ORIGIN.x, TARG_ORIGIN.z)]) {
    const markers = structure.blocks.filter((block) => block.dy === 1 && (block.block === BlockType.Lamp || block.block === BlockType.HorezuCeramic));
    assert.equal(markers.length, 6, structure.name);
    assert.equal(new Set(markers.map((block) => `${block.dx},${block.dz}`)).size, 6, structure.name);
  }
});

test('lesson plateaus blend into terrain with long grass terraces', () => {
  const straja = buildStrajaZone(STRAJA_ORIGIN.x, STRAJA_ORIGIN.z);
  const targ = buildTargZone(TARG_ORIGIN.x, TARG_ORIGIN.z);
  const munte = buildMunteZone(MUNTE_ORIGIN.x, MUNTE_ORIGIN.z);

  assert.equal(straja.edgeTerraceDepth, 12);
  assert.equal(targ.edgeTerraceDepth, 13);
  assert.equal(munte.edgeTerraceDepth, 22);
  for (const structure of [straja, targ, munte]) {
    assert.ok((structure.edgeSoilDepth ?? 0) >= 6, structure.name);
    assert.ok((structure.naturalClearance ?? 0) >= 8, structure.name);
  }
});

test('recap mountains have broad high crests and rocky crystal slopes', () => {
  const world = new World(WORLD_SEED);
  const peaks = [
    [MUNTE_ORIGIN.x, MUNTE_ORIGIN.z + 54, MUNTE_ORIGIN.z + 78],
    [TARG_ORIGIN.x, TARG_ORIGIN.z + 40, TARG_ORIGIN.z + 64],
  ];
  for (const [x, crestZ, outsideZ] of peaks) {
    assert.ok(world.generator.heightAt(x, crestZ) >= 62);
    assert.ok(world.generator.heightAt(x + 10, crestZ) >= 50);
    assert.ok(world.generator.heightAt(x, crestZ) > world.generator.heightAt(x, outsideZ) + 12);
    const cx = worldToChunk(x);
    const cz = worldToChunk(crestZ);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) world.generateChunk(cx + dx, cz + dz);
    }
    let rocky = 0;
    let crystals = 0;
    for (let wz = crestZ - 10; wz <= crestZ + 10; wz++) {
      for (let wx = x - 10; wx <= x + 10; wx++) {
        const top = world.highestSolidY(wx, wz);
        const block = world.getBlock(wx, top, wz);
        if (block === BlockType.Stone) rocky++;
        if (block === BlockType.Crystal) crystals++;
      }
    }
    assert.ok(rocky > 10, `rocky crown at ${x},${crestZ}`);
    assert.ok(crystals > 0, `crystals at ${x},${crestZ}`);
  }
});

test('new trees around Anica grow from finished grass, outside lesson stations', () => {
  const world = new World(WORLD_SEED);
  const minX = TARG_ORIGIN.x - 24;
  const maxX = TARG_ORIGIN.x + 26;
  const minZ = TARG_ORIGIN.z - 25;
  const maxZ = TARG_ORIGIN.z + 28;
  for (let cz = worldToChunk(minZ); cz <= worldToChunk(maxZ); cz++) {
    for (let cx = worldToChunk(minX); cx <= worldToChunk(maxX); cx++) world.generateChunk(cx, cz);
  }
  let trees = 0;
  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      if (Math.abs(x - TARG_ORIGIN.x) <= 19 && Math.abs(z - TARG_ORIGIN.z) <= 15) continue;
      for (let y = 25; y < 70; y++) {
        if (world.getBlock(x, y, z) !== BlockType.Log || world.getBlock(x, y - 1, z) === BlockType.Log) continue;
        // Nearby buildings have log posts on plank floors; count only trees.
        if (world.getBlock(x, y - 1, z) !== BlockType.Grass) continue;
        if (![4, 5, 6].some((height) => world.getBlock(x, y + height, z) === BlockType.Leaves)) continue;
        trees++;
      }
    }
  }
  assert.ok(trees >= 3, `expected trees on the surrounding slopes, got ${trees}`);
});

test('conditional consolidation grows from two to five if blocks', () => {
  const expectedMinimums = [2, 2, 3, 4, 3, 5];
  CONDITIONALS.forEach((id, index) => {
    const puzzle = VATRA_PUZZLES[id];
    assert.equal(puzzle.allowIf, true, id);
    assert.ok(countKind(puzzle.solution, 'if') >= expectedMinimums[index], id);
    assert.ok((puzzle.scenarios?.length ?? 0) >= 3, id);
    const result = evaluate(puzzle, puzzle.solution);
    assert.equal(result.infinite, false, id);
  });
});

test('variable consolidation uses boxes, loops, and progressively richer programs', () => {
  VARIABLES.forEach((id) => {
    const puzzle = VATRA_PUZZLES[id];
    assert.equal(puzzle.allowVariables, true, id);
    assert.ok((puzzle.variables?.length ?? 0) >= 1, id);
    assert.ok(countKind(puzzle.solution, 'repeat') + countKind(puzzle.solution, 'while') >= 1, id);
    assert.ok(countKind(puzzle.solution, 'set') >= 1, id);
    const result = evaluate(puzzle, puzzle.solution);
    assert.equal(result.infinite, false, id);
  });
  assert.equal(VATRA_PUZZLES.socoteala_castelului.variables.length, 2);
  assert.equal(countKind(VATRA_PUZZLES.socoteala_castelului.solution, 'if'), 1);
});

test('new lessons grant one focused consumable weapon or non-natural material', () => {
  const allowed = new Set([
    WeaponId.Arc,
    ThrowableId.SocataBottle,
    ThrowableId.HubaBuba,
    BlockType.HorezuCeramic,
    BlockType.IeBlouse,
    BlockType.RockSalt,
    BlockType.Obsidian,
  ]);
  for (const id of [...CONDITIONALS, ...VARIABLES]) {
    const puzzle = VATRA_PUZZLES[id];
    assert.equal(puzzle.rewardItems.length, 1, id);
    assert.ok(allowed.has(puzzle.rewardItems[0].id), id);
    assert.match(puzzle.reward, /arc|socată|Huba|ceramică|ii tradiționale|sare|obsidian/i, id);
  }
});

test('Ajutor lists the new lesson sources for every focused reward', () => {
  const items = buildHelpSections().flatMap((section) => section.items);
  for (const rewardId of new Set([...CONDITIONALS, ...VARIABLES].map((id) => VATRA_PUZZLES[id].rewardItems[0].id))) {
    const item = items.find((entry) => entry.id === rewardId);
    assert.ok(item, `missing help item ${rewardId}`);
    assert.ok(item.sources.some((source) => source.includes('Răsplată la lecția')), `missing lesson source for ${rewardId}`);
  }
});

