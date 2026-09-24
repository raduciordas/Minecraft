import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  TERRAIN_BASE_HEIGHT,
  TERRAIN_AMP_1,
  TERRAIN_FREQ_1,
  TERRAIN_AMP_2,
  TERRAIN_FREQ_2,
  SAND_HEIGHT,
  SEA_LEVEL,
  MOUNTAIN_RING_RADIUS,
  MOUNTAIN_RING_WIDTH,
  MOUNTAIN_GAP_ANGLE,
  MOUNTAIN_GAP_CENTER,
  MOUNTAIN_FREQ,
  MOUNTAIN_BASE_HEIGHT,
  MOUNTAIN_AMP,
  SNOW_LINE,
  CRYSTAL_LINE,
  CRYSTAL_SPIRE_PROBABILITY,
  CRYSTAL_VEIN_PROBABILITY,
} from '../config';
import { BlockType } from './Block';
import { Chunk } from './Chunk';
import {
  buildStanaZone,
  STANA_ORIGIN,
  buildMunteZone,
  MUNTE_ORIGIN,
  buildBuclaZone,
  buildBuclaBridge,
  buildBuclaHomeTree,
  BUCLA_ORIGIN,
  BUCLA_HOME_TREE_ORIGIN,
  buildVladCastle,
  buildVatraSatului,
  buildVatraStairs,
  VATRA_ORIGIN,
  VATRA_STAIRS_ORIGIN,
  buildLuncaZone,
  LUNCA_ORIGIN,
  buildPadureaZone,
  PADUREA_ORIGIN,
  buildStrajaZone,
  STRAJA_ORIGIN,
  buildTargZone,
  TARG_ORIGIN,
  type StructureTemplate,
} from './Structures';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic per-position hash in [0, 1), used for tree placement.
function hash2D(x: number, z: number, seed: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const TREE_PROBABILITY = 0.008;
const MAX_TREE_ELEVATION = 43;
const RECAP_RIDGES = [
  { x: MUNTE_ORIGIN.x, z: MUNTE_ORIGIN.z + 54, width: 31, depth: 26, rise: 40 },
  { x: TARG_ORIGIN.x, z: TARG_ORIGIN.z + 40, width: 29, depth: 25, rise: 38 },
  { x: STRAJA_ORIGIN.x + 49, z: STRAJA_ORIGIN.z, width: 25, depth: 29, rise: 37 },
] as const;

// World landmarks: fixed points of interest stamped into the terrain wherever
// their footprint overlaps a chunk (see placeStructures).
interface PlacedStructure extends StructureTemplate {
  groundY: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  flatMinX: number;
  flatMaxX: number;
  flatMinZ: number;
  flatMaxZ: number;
}

export class TerrainGenerator {
  private noise1: NoiseFunction2D;
  private noise2: NoiseFunction2D;
  private mountainNoise: NoiseFunction2D;
  private seed: number;
  private structures: PlacedStructure[];

  constructor(seed: number) {
    this.seed = seed;
    this.noise1 = createNoise2D(mulberry32(seed));
    this.noise2 = createNoise2D(mulberry32(seed + 1));
    this.mountainNoise = createNoise2D(mulberry32(seed + 2));

    // Satul Bunicii sits in the flatland just outside the mountain ring;
    // Castelul lui Vlad Tepes crowns a peak on the ring itself.
    this.structures = [
      buildStanaZone(STANA_ORIGIN.x, STANA_ORIGIN.z),
      buildMunteZone(MUNTE_ORIGIN.x, MUNTE_ORIGIN.z),
      buildBuclaZone(BUCLA_ORIGIN.x, BUCLA_ORIGIN.z),
      buildBuclaBridge(BUCLA_ORIGIN.x, BUCLA_ORIGIN.z),
      buildBuclaHomeTree(BUCLA_HOME_TREE_ORIGIN.x, BUCLA_HOME_TREE_ORIGIN.z),
      buildVladCastle(80, 0),
      buildVatraSatului(VATRA_ORIGIN.x, VATRA_ORIGIN.z),
      buildVatraStairs(VATRA_STAIRS_ORIGIN.x, VATRA_STAIRS_ORIGIN.z),
      buildLuncaZone(LUNCA_ORIGIN.x, LUNCA_ORIGIN.z),
      buildPadureaZone(PADUREA_ORIGIN.x, PADUREA_ORIGIN.z),
      buildStrajaZone(STRAJA_ORIGIN.x, STRAJA_ORIGIN.z),
      buildTargZone(TARG_ORIGIN.x, TARG_ORIGIN.z),
    ].map((t) => this.placeTemplate(t));
  }

  private placeTemplate(t: StructureTemplate): PlacedStructure {
    let minX = 0, maxX = 0, minZ = 0, maxZ = 0;
    for (const b of t.blocks) {
      minX = Math.min(minX, b.dx);
      maxX = Math.max(maxX, b.dx);
      minZ = Math.min(minZ, b.dz);
      maxZ = Math.max(maxZ, b.dz);
    }
    const levelOrigin = t.levelOrigin ?? { x: t.originX, z: t.originZ };
    const flatMinX = t.originX + minX - t.pad;
    const flatMaxX = t.originX + maxX + t.pad;
    const flatMinZ = t.originZ + minZ - t.pad;
    const flatMaxZ = t.originZ + maxZ + t.pad;
    const terrace = t.edgeTerraceDepth ?? 0;
    return {
      ...t,
      groundY: Math.max(1, this.heightAt(levelOrigin.x, levelOrigin.z) + (t.levelOffset ?? 0)),
      flatMinX,
      flatMaxX,
      flatMinZ,
      flatMaxZ,
      minX: flatMinX - terrace,
      maxX: flatMaxX + terrace,
      minZ: flatMinZ - terrace,
      maxZ: flatMaxZ + terrace,
    };
  }

  // 0 outside the mountain band, ramping to 1 along the Carpathian-style
  // ring; a wedge is faded out on one side so the ring reads as an open arc.
  arcFactor(wx: number, wz: number): number {
    const dist = Math.hypot(wx, wz);
    const ringDelta = Math.abs(dist - MOUNTAIN_RING_RADIUS);
    let radial = 1 - ringDelta / MOUNTAIN_RING_WIDTH;
    if (radial <= 0) return 0;
    radial = Math.min(1, radial);
    radial = radial * radial * (3 - 2 * radial); // smoothstep

    const angle = Math.atan2(wz, wx);
    let angleDelta = Math.abs(angle - MOUNTAIN_GAP_CENTER);
    if (angleDelta > Math.PI) angleDelta = 2 * Math.PI - angleDelta;
    if (angleDelta < MOUNTAIN_GAP_ANGLE) {
      const gapFactor = angleDelta / MOUNTAIN_GAP_ANGLE;
      radial *= gapFactor * gapFactor;
    }
    return radial;
  }

  private recapRidge(wx: number, wz: number): number {
    let rise = 0;
    for (const ridge of RECAP_RIDGES) {
      const dx = (wx - ridge.x) / ridge.width;
      const dz = (wz - ridge.z) / ridge.depth;
      const shoulder = Math.max(0, 1 - dx * dx - dz * dz);
      rise = Math.max(rise, ridge.rise * shoulder * shoulder);
    }
    return rise;
  }

  private valleyFloor(wx: number, wz: number, height: number): number {
    // Fill the low basin between Lunca, Vatra and Straja without moving their
    // lesson platforms. A ten-block fringe joins the meadow to native hills.
    const edge = Math.min(wx + 10, 52 - wx, wz + 58, 10 - wz);
    const t = Math.max(0, Math.min(1, edge / 10));
    const blend = t * t * (3 - 2 * t);
    return height + Math.max(0, 30 - height) * blend;
  }

  heightAt(wx: number, wz: number): number {
    const h =
      TERRAIN_BASE_HEIGHT +
      TERRAIN_AMP_1 * this.noise1(wx * TERRAIN_FREQ_1, wz * TERRAIN_FREQ_1) +
      TERRAIN_AMP_2 * this.noise2(wx * TERRAIN_FREQ_2, wz * TERRAIN_FREQ_2);

    let height = h;
    const arc = this.arcFactor(wx, wz);
    if (arc > 0) {
      // A gentler curve than ridge² — broad rounded massifs instead of
      // narrow "witch hat" spikes, while still keeping a ridged look
      const ridge = 1 - Math.abs(this.mountainNoise(wx * MOUNTAIN_FREQ, wz * MOUNTAIN_FREQ));
      const peak = MOUNTAIN_BASE_HEIGHT + Math.pow(ridge, 1.4) * MOUNTAIN_AMP;
      height = h + arc * (peak - h);
    }
    height += this.recapRidge(wx, wz);
    height = this.valleyFloor(wx, wz, height);
    return Math.max(1, Math.min(CHUNK_HEIGHT - 10, Math.floor(height)));
  }

  generate(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const height = this.heightAt(wx, wz);
        const sandy = height <= SAND_HEIGHT;
        const snowy = height >= SNOW_LINE;
        const arc = this.arcFactor(wx, wz);
        const ridge = this.recapRidge(wx, wz);
        const exposedRock = ridge > 9 && height > 46 && hash2D(wx, wz, this.seed + 31) < 0.5;

        for (let y = 0; y <= height; y++) {
          let id: BlockType;
          if (y === height) id = exposedRock ? BlockType.Stone : snowy ? BlockType.Snow : sandy ? BlockType.Sand : BlockType.Grass;
          else if (y >= height - 3) id = snowy ? BlockType.Stone : sandy ? BlockType.Sand : BlockType.Dirt;
          else {
            id = BlockType.Stone;
            // Crystal veins run through the deep rock inside the mountain band
            if ((arc > 0.35 || ridge > 9) && y < height - 6 && hash2D(wx, y * 131 + wz, this.seed + 3) < CRYSTAL_VEIN_PROBABILITY) {
              id = BlockType.Crystal;
            }
          }
          chunk.setBlock(lx, y, lz, id);
        }
        for (let y = height + 1; y <= SEA_LEVEL; y++) {
          chunk.setBlock(lx, y, lz, BlockType.Water);
        }
      }
    }

    this.placeCrystalSpires(chunk);
    this.placeStructures(chunk);
    this.placeTrees(chunk);
  }

  // Flattens each landmark's footprint (so it sits on a clean pad regardless
  // of the natural terrain underneath) and stamps its blocks, one chunk at a
  // time; a structure spanning several chunks is handled correctly since
  // every chunk only ever touches its own local slice of the shared template.
  private placeStructures(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (const s of this.structures) {
      if (baseX + CHUNK_SIZE <= s.minX || baseX >= s.maxX) continue;
      if (baseZ + CHUNK_SIZE <= s.minZ || baseZ >= s.maxZ) continue;

      const x0 = Math.max(baseX, s.minX);
      const x1 = Math.min(baseX + CHUNK_SIZE - 1, s.maxX);
      const z0 = Math.max(baseZ, s.minZ);
      const z1 = Math.min(baseZ + CHUNK_SIZE - 1, s.maxZ);
      for (let wx = x0; wx <= x1; wx++) {
        for (let wz = z0; wz <= z1; wz++) {
          const lx = wx - baseX;
          const lz = wz - baseZ;
          const insideFlat =
            wx >= s.flatMinX && wx <= s.flatMaxX &&
            wz >= s.flatMinZ && wz <= s.flatMaxZ;
          let targetY = s.groundY;
          let clearAbove = s.clearAbove;

          if (!insideFlat) {
            // Never let one platform's descending skirt cover another lesson.
            const belongsToAnotherPlatform = this.structures.some((other) =>
              other !== s &&
              wx >= other.flatMinX && wx <= other.flatMaxX &&
              wz >= other.flatMinZ && wz <= other.flatMaxZ
            );
            if (belongsToAnotherPlatform) continue;

            const ringX = wx < s.flatMinX ? s.flatMinX - wx : wx > s.flatMaxX ? wx - s.flatMaxX : 0;
            const ringZ = wz < s.flatMinZ ? s.flatMinZ - wz : wz > s.flatMaxZ ? wz - s.flatMaxZ : 0;
            const ring = Math.max(ringX, ringZ);
            const naturalY = this.heightAt(wx, wz);
            targetY = naturalY < s.groundY
              ? Math.max(naturalY, s.groundY - ring)
              : Math.min(naturalY, s.groundY + ring);
            clearAbove = 3;
          }

          // On jagged terrain, clear past the old column so no rock or canopy
          // remains suspended above the new flat or its grass-topped steps.
          const clearTop = Math.max(
            targetY + clearAbove,
            this.heightAt(wx, wz) + (s.naturalClearance ?? 2),
          );
          const soilStart = Math.max(1, targetY - (s.edgeSoilDepth ?? 0));
          for (let y = 1; y < targetY; y++) {
            chunk.setBlock(lx, y, lz, y >= soilStart ? BlockType.Dirt : BlockType.Stone);
          }
          chunk.setBlock(lx, targetY, lz, s.surface);
          for (let y = targetY + 1; y <= clearTop; y++) chunk.setBlock(lx, y, lz, BlockType.Air);
        }
      }

      for (const b of s.blocks) {
        const wx = s.originX + b.dx;
        const wz = s.originZ + b.dz;
        if (wx < baseX || wx >= baseX + CHUNK_SIZE || wz < baseZ || wz >= baseZ + CHUNK_SIZE) continue;
        chunk.setBlock(wx - baseX, s.groundY + b.dy, wz - baseZ, b.block);
      }
    }
  }

  // Trees are kept fully inside their own chunk (trunk at 2..13) so generation
  // never depends on neighboring chunks.
  private placeTrees(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let lx = 2; lx <= CHUNK_SIZE - 3; lx++) {
      for (let lz = 2; lz <= CHUNK_SIZE - 3; lz++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        // Keep trunks and crowns away from lesson props, while allowing trees
        // on the grass shoulders after their final ground level is known.
        const touchesLesson = this.structures.some((s) =>
          wx >= s.flatMinX - 2 && wx <= s.flatMaxX + 2 &&
          wz >= s.flatMinZ - 2 && wz <= s.flatMaxZ + 2
        );
        if (touchesLesson) continue;
        const nearRecap = [MUNTE_ORIGIN, STRAJA_ORIGIN, TARG_ORIGIN].some((o) =>
          Math.abs(wx - o.x) < 48 && Math.abs(wz - o.z) < 42
        );
        const inValley = wx >= -10 && wx <= 50 && wz >= -58 && wz <= 10;
        if (hash2D(wx, wz, this.seed) >= (inValley ? 0.018 : nearRecap ? 0.016 : TREE_PROBABILITY)) continue;

        let ground = CHUNK_HEIGHT - 3;
        while (ground > 0 && chunk.getBlock(lx, ground, lz) === BlockType.Air) ground--;
        if (chunk.getBlock(lx, ground, lz) !== BlockType.Grass) continue;
        if (ground > MAX_TREE_ELEVATION) continue;

        const trunkHeight = 4 + (hash2D(wx, wz, this.seed + 7) < 0.5 ? 0 : 1);
        const top = ground + trunkHeight;
        if (top + 2 >= CHUNK_HEIGHT) continue;

        for (let y = ground + 1; y <= top; y++) {
          chunk.setBlock(lx, y, lz, BlockType.Log);
        }
        // Leaf blob: 3x3 layers around the trunk top, plus a cap
        for (let dy = 0; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              const y = top + dy;
              if (dy === 0 && dx === 0 && dz === 0) continue; // trunk top stays log
              if (chunk.getBlock(lx + dx, y, lz + dz) === BlockType.Air) {
                chunk.setBlock(lx + dx, y, lz + dz, BlockType.Leaves);
              }
            }
          }
        }
        chunk.setBlock(lx, top + 2, lz, BlockType.Leaves);
      }
    }
  }

  // Tapering crystal spikes on the snowy Carpathian peaks, kept fully inside
  // their own chunk like trees are.
  private placeCrystalSpires(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let lx = 2; lx <= CHUNK_SIZE - 3; lx++) {
      for (let lz = 2; lz <= CHUNK_SIZE - 3; lz++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const ground = this.heightAt(wx, wz);
        if (ground < CRYSTAL_LINE) continue;
        if (this.arcFactor(wx, wz) < 0.5 && this.recapRidge(wx, wz) < 18) continue;
        if (hash2D(wx, wz, this.seed + 11) >= CRYSTAL_SPIRE_PROBABILITY) continue;
        if (chunk.getBlock(lx, ground, lz) !== BlockType.Snow) continue;

        const spireHeight = 3 + Math.floor(hash2D(wx, wz, this.seed + 13) * 4);
        for (let i = 0; i < spireHeight; i++) {
          const y = ground + 1 + i;
          if (y >= CHUNK_HEIGHT) break;
          const remaining = spireHeight - i;
          const radius = remaining > spireHeight * 0.6 ? 1 : 0;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (radius === 1 && Math.abs(dx) === 1 && Math.abs(dz) === 1 && hash2D(wx + dx, wz + dz + i, this.seed + 17) < 0.4) {
                continue; // ragged edges instead of a perfect box
              }
              // The spire's width is built from the center column's ground
              // height — on jagged terrain a neighbor a block over can sit
              // noticeably lower or higher, so its slice would float or bury
              // itself. Skip it there rather than stamp a disconnected chunk.
              if ((dx !== 0 || dz !== 0) && Math.abs(this.heightAt(wx + dx, wz + dz) - ground) > 1) {
                continue;
              }
              chunk.setBlock(lx + dx, y, lz + dz, BlockType.Crystal);
            }
          }
        }
      }
    }
  }
}

