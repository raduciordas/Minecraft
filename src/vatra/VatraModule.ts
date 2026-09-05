import * as THREE from 'three';
import { BlockType } from '../world/Block';
import { ToolId, buildToolModel, disposeModel } from '../items/Tool';
import {
  VATRA_ORIGIN,
  LUNCA_ORIGIN,
  PADUREA_ORIGIN,
  ORCHARD_DX,
  ORCHARD_DZ,
  HAYSTACK_DX,
  HAYSTACK_DZ,
} from '../world/Structures';
import { VATRA_PUZZLES, programEquivalent, gradesByTrace, type ProgramNode } from './VatraPuzzles';
import { evaluate, tracesEqual } from './Interpreter';
import type { World } from '../world/World';
import type { Inventory } from '../player/Inventory';
import type { SoundManager } from '../Sound';

const SAVE_KEY = 'cuburia-vatra-v1';

// Lantern glass positions, relative to the vatra origin (dy above ground)
const LANTERNS: [number, number, number][] = [
  [4, 3, 1],
  [6, 3, 1],
  [8, 3, 1],
  [10, 3, 1],
  [12, 3, 1],
];
const TROUGH_Z = [2, 3, 4];
const OVEN_CAVITY: [number, number, number] = [-6, 2, 0];
const FORGE_CAVITY: [number, number, number] = [-7, 2, -7];
const STABLE_TROUGH: [number, number, number] = [0, 1, -6];
const LAUNDRY_SPOT: [number, number, number] = [6, 2, -7];

// Gardul Luncii's 30-post gap, relative to the Lunca origin
const FENCE_DX = Array.from({ length: 30 }, (_, i) => i - 14);
// The Nth fence post's dx — beyond 30 it keeps going east past the anchor,
// "over the hill, through the neighbor's yard" for an overshot repeat count.
function fencePostPos(index: number): number {
  return index < FENCE_DX.length ? FENCE_DX[index] : 17 + (index - FENCE_DX.length);
}
// Câmpul de grâu's 6×4 tilled field
const FIELD_POS: [number, number, number][] = [];
for (let x = 20; x <= 25; x++) for (let z = -2; z <= 1; z++) FIELD_POS.push([x, 1, z]);
const MILL_FLOUR: [number, number, number] = [22, 1, 8];
// The mill's static log wheel, swapped out for the spinning prop on success
const MILL_WHEEL_LOGS: [number, number, number][] = [
  [19, 1, 8],
  [19, 2, 8],
  [19, 3, 8],
  [19, 2, 7],
  [19, 2, 9],
];
// One orchard tree: a 2-block trunk under a leaf cross with a cap. The
// planting mound (dy 1) is Dirt until the tree takes root.
type Rel = [number, number, number];
function orchardTree(x: number): { trunk: Rel[]; canopy: Rel[] } {
  const z = ORCHARD_DZ;
  return {
    trunk: [
      [x, 1, z],
      [x, 2, z],
    ],
    canopy: [
      [x, 3, z],
      [x - 1, 3, z],
      [x + 1, 3, z],
      [x, 3, z - 1],
      [x, 3, z + 1],
      [x, 4, z],
    ],
  };
}

// One haystack: a pole with hay heaped round it, narrowing toward the top.
// The hay goes on in four forkfuls, so it's split into four equal batches.
function haystack(x: number): { pole: Rel[]; forkfuls: Rel[][]; cap: Rel } {
  const z = HAYSTACK_DZ;
  const lower: Rel[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx !== 0 || dz !== 0) lower.push([x + dx, 1, z + dz]);
    }
  }
  const upper: Rel[] = [
    [x - 1, 2, z],
    [x + 1, 2, z],
    [x, 2, z - 1],
    [x, 2, z + 1],
  ];
  const hay = [...lower, ...upper]; // 8 + 4 = 12, four forkfuls of three
  return {
    pole: [
      [x, 1, z],
      [x, 2, z],
    ],
    forkfuls: [hay.slice(0, 3), hay.slice(3, 6), hay.slice(6, 9), hay.slice(9, 12)],
    cap: [x, 3, z],
  };
}

// Where the sheep graze once the fence closes, relative to the Luncă origin
const SHEEP_SPOTS: [number, number][] = [
  [-6, -4],
  [-3, -3.2],
  [6, -4.5],
];

// Pădurea's conditional-puzzle markers, relative to the Pădurea origin
const LANTERN_POTECA: [number, number, number] = [0, 3, -6];
const BRIDGE_RAIL: [number, number, number] = [0, 2, 3];
const TRAP_CENTER: [number, number, number] = [13, 1, -4];

const BUCKET_HIGH = 3.4;
const BUCKET_LOW = 1.3;

// A low wooden signpost planted well clear of the activity's walls (past
// the building's outer edge, not just past its center), so the board
// never clips into brick/plank geometry behind it. `yaw` turns the board to
// face whichever side a player actually walks up from: 0 looks south (+z),
// which is the usual approach, ±PI/2 east/west, PI north.
const LESSON_SIGNS: Record<string, { dx: number; dz: number; label: string; yaw?: number }> = {
  fantana: { dx: 0, dz: 5.5, label: 'Fântâna' },
  cuptor: { dx: -6, dz: 2.5, label: 'Cuptorul' },
  ulita: { dx: 8, dz: 2.5, label: 'Ulița cu felinare' },
  fierarie: { dx: -7, dz: -4.5, label: 'Fierăria' },
  grajd: { dx: 0, dz: -3.5, label: 'Grajdul' },
  spalatorie: { dx: 7.5, dz: -3.5, label: 'Spălătoria' },
  gard: { dx: 0.5, dz: -3, label: 'Gardul Luncii' },
  // West of the field, turned to face the open meadow you cross to reach it
  camp_grau: { dx: 18.5, dz: -0.5, label: 'Câmpul de grâu', yaw: -Math.PI / 2 },
  // Outside the mill's south wall, off to the side of its doorway — the old
  // spot was inside the building, buried in the north wall
  moara: { dx: 20.5, dz: 11, label: 'Moara de apă' },
  livada: { dx: -9.5, dz: 5.5, label: 'Livada de meri' },
  capite: { dx: -10, dz: 10.5, label: 'Căpițele de fân' },
  poteca: { dx: 0, dz: -3, label: 'Poteca Mumei Pădurii' },
  pod: { dx: 0, dz: 2, label: 'Podul mișcător' },
  capcana: { dx: 13, dz: -1, label: 'Capcana de lup' },
};

// Draws the wood-plank canvas texture shared by both the big lesson
// signposts and Bunicul's small personal nametag.
function drawSignCanvas(text: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(0, 0, 320, 96);
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 312, 88);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontSize = 32;
  do {
    ctx.font = `bold ${fontSize}px monospace`;
    fontSize -= 2;
  } while (ctx.measureText(text).width > 292 && fontSize > 14);
  ctx.fillStyle = '#f4e6c8';
  ctx.fillText(text, 160, 50);
  return canvas;
}

// Bunicul's personal nametag: a small billboard that always faces the
// camera and stays legible from a distance, like a player's nametag.
function makeSign(text: string, width = 2.6): THREE.Sprite {
  const texture = new THREE.CanvasTexture(drawSignCanvas(text));
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, width * 0.3, 1);
  sprite.renderOrder = 999;
  return sprite;
}

// A lesson-location signpost: a sturdy wood-block base with a post rising
// out of it and the board mounted well above both, with a fixed orientation
// (not a billboard) and normal depth-testing/fog, so it only reads up close
// — unlike Bunicul's always-visible nametag, it doesn't shout across the map.
function makeSignBoard(text: string): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x4a2f16 }),
  );
  base.position.set(0, 0.25, 0);
  group.add(base);

  // Post top sits at 1.8 — the board is mounted right on top of it, not
  // sunk down inside it
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 1.3, 0.14),
    new THREE.MeshLambertMaterial({ color: 0x4a2f16 }),
  );
  post.position.set(0, 1.15, 0);
  group.add(post);

  // A solid backing block right behind the board, so it always has its own
  // wood backdrop instead of whatever wall happens to be further back
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(1.34, 0.44, 0.16),
    new THREE.MeshLambertMaterial({ color: 0x4a2f16 }),
  );
  backing.position.set(0, 2, -0.09);
  group.add(backing);

  const texture = new THREE.CanvasTexture(drawSignCanvas(text));
  texture.minFilter = THREE.LinearFilter;
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.4),
    new THREE.MeshLambertMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  board.position.set(0, 2, 0.01);
  group.add(board);
  return group;
}

// Which puzzles live in Zona 2 (Lunca) or Zona 3 (Pădurea) rather than the
// Vatra square — their world positions are relative to a different origin.
const LUNCA_PUZZLES = new Set(['gard', 'camp_grau', 'moara', 'livada', 'capite']);
const PADUREA_PUZZLES = new Set(['poteca', 'pod', 'capcana']);

// The persistent world change each puzzle makes on success, and what it
// reverts to when the lesson is reset — data-driven so both applying and
// undoing (and re-applying on world load) share one table.
interface PuzzleEffect {
  pos: [number, number, number];
  solved: BlockType;
  unsolved: BlockType;
}
const PUZZLE_EFFECTS: Record<string, PuzzleEffect[]> = {
  fantana: TROUGH_Z.map((z) => ({ pos: [0, 2, z], solved: BlockType.Water, unsolved: BlockType.Air })),
  // Cuptor's and fierarie's "solved" states aren't blocks — they're a
  // permanent fire + chimney smoke (and, for fierarie, a pickaxe prop); see
  // applySuccess/resetPuzzle/update for the ovenLight/forgeLight visuals.
  ulita: LANTERNS.map((pos) => ({ pos, solved: BlockType.Lamp, unsolved: BlockType.Glass })),
  grajd: [{ pos: STABLE_TROUGH, solved: BlockType.Hay, unsolved: BlockType.Plank }],
  spalatorie: [{ pos: LAUNDRY_SPOT, solved: BlockType.IeBlouse, unsolved: BlockType.Air }],
  gard: FENCE_DX.map((x) => ({ pos: [x, 1, -6] as [number, number, number], solved: BlockType.Log, unsolved: BlockType.Air })),
  camp_grau: FIELD_POS.map((pos) => ({ pos, solved: BlockType.Wheat, unsolved: BlockType.Dirt })),
  moara: [
    { pos: MILL_FLOUR, solved: BlockType.Flour, unsolved: BlockType.Air },
    // The log wheel gives way to the turning prop (see setMillWheelProp)
    ...MILL_WHEEL_LOGS.map((pos) => ({ pos, solved: BlockType.Air, unsolved: BlockType.Log })),
  ],
  livada: ORCHARD_DX.flatMap((x) => {
    const t = orchardTree(x);
    return [
      // the dug mound becomes the trunk's foot, so it reverts to Dirt
      { pos: t.trunk[0], solved: BlockType.Log, unsolved: BlockType.Dirt },
      { pos: t.trunk[1], solved: BlockType.Log, unsolved: BlockType.Air },
      ...t.canopy.map((pos) => ({ pos, solved: BlockType.Leaves, unsolved: BlockType.Air })),
    ];
  }),
  capite: HAYSTACK_DX.flatMap((x) => {
    const h = haystack(x);
    return [
      ...h.pole.map((pos) => ({ pos, solved: BlockType.Log, unsolved: BlockType.Air })),
      ...h.forkfuls.flat().map((pos) => ({ pos, solved: BlockType.Hay, unsolved: BlockType.Air })),
      { pos: h.cap, solved: BlockType.Hay, unsolved: BlockType.Air },
    ];
  }),
  poteca: [{ pos: LANTERN_POTECA, solved: BlockType.Lamp, unsolved: BlockType.Glass }],
  pod: [{ pos: BRIDGE_RAIL, solved: BlockType.Log, unsolved: BlockType.Air }],
  capcana: [{ pos: TRAP_CENTER, solved: BlockType.Hay, unsolved: BlockType.Plank }],
};

interface Flying {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  floorY: number;
}

interface Smoke {
  mesh: THREE.Mesh;
  age: number;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// A simple blocky horse standing in the stable once Grajdul is solved
function buildHorse(): THREE.Group {
  const horse = new THREE.Group();
  const BODY = 0x6b4226;
  const MANE = 0x3a2414;
  box(horse, 0.9, 0.5, 0.35, BODY, 0, 0.75, 0); // body
  box(horse, 0.28, 0.35, 0.28, BODY, 0.55, 0.85, 0); // neck
  const head = box(horse, 0.22, 0.22, 0.4, BODY, 0.8, 1.05, 0); // head
  box(head, 0.06, 0.14, 0.06, BODY, 0.09, 0.15, 0.15); // ear
  box(head, 0.06, 0.14, 0.06, BODY, -0.09, 0.15, 0.15); // ear
  box(horse, 0.08, 0.28, 0.36, MANE, 0.38, 1.05, 0); // mane
  for (const [dx, dz] of [
    [-0.32, -0.13],
    [-0.32, 0.13],
    [0.32, -0.13],
    [0.32, 0.13],
  ] as const) {
    box(horse, 0.12, 0.5, 0.12, BODY, dx, 0.25, dz); // legs
  }
  box(horse, 0.08, 0.32, 0.08, MANE, -0.48, 0.72, 0); // tail
  return horse;
}

// The washing hung out on the clothesline once Spălătoria is solved. Each
// shirt is its own group pivoting at the line, so it can swing in the wind.
function buildLaundryLine(): THREE.Group {
  const line = new THREE.Group();
  const CLOTH = 0xf2efe6;
  const TRIM = 0xb03a2e;
  // dz 0 is skipped — that's where the solved-state ie block itself hangs
  for (const dz of [-1, 1, 2]) {
    const shirt = new THREE.Group();
    shirt.position.set(0, 0, dz);
    box(shirt, 0.06, 0.62, 0.42, CLOTH, 0, -0.36, 0); // body of the ie
    box(shirt, 0.06, 0.1, 0.42, TRIM, 0, -0.72, 0); // embroidered hem
    box(shirt, 0.06, 0.3, 0.14, CLOTH, 0, -0.2, 0.26); // sleeve
    box(shirt, 0.06, 0.3, 0.14, CLOTH, 0, -0.2, -0.26); // sleeve
    line.add(shirt);
  }
  return line;
}

// One of the sheep let into the Luncă once its fence finally closes
function buildSheep(): THREE.Group {
  const sheep = new THREE.Group();
  const WOOL = 0xf0ece0;
  const SKIN = 0x4a4038;
  box(sheep, 0.85, 0.55, 0.42, WOOL, 0, 0.72, 0); // fleecy body
  const head = box(sheep, 0.28, 0.3, 0.26, SKIN, 0.53, 0.82, 0);
  box(head, 0.3, 0.16, 0.28, WOOL, -0.04, 0.14, 0); // woolly forehead
  for (const [dx, dz] of [
    [-0.28, -0.14],
    [-0.28, 0.14],
    [0.28, -0.14],
    [0.28, 0.14],
  ] as const) {
    box(sheep, 0.11, 0.45, 0.11, SKIN, dx, 0.22, dz); // legs
  }
  box(sheep, 0.1, 0.16, 0.1, WOOL, -0.45, 0.78, 0); // tail
  return sheep;
}

// The mill's paddle wheel, which starts turning for good once the "while"
// loop is solved — the moment the endless loop becomes visible. Its axle
// runs along X, so it turns in the Y-Z plane (rotation about X).
function buildMillWheel(): THREE.Group {
  const wheel = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a26 });
  const paddleMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
  const R = 1.5;
  wheel.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.32), wood)); // hub
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.14, R, 0.12), wood);
    spoke.position.set(0, (Math.cos(a) * R) / 2, (Math.sin(a) * R) / 2);
    spoke.rotation.x = a;
    wheel.add(spoke);
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.44), paddleMat);
    paddle.position.set(0, Math.cos(a) * R, Math.sin(a) * R);
    paddle.rotation.x = a;
    wheel.add(paddle);
  }
  return wheel;
}

// Satul Codat, phase 0: six Vatra buildings as interactive coding puzzles
// (pure sequences — Zone 1 of the design doc). Owns the puzzle state (which
// are solved, persisted locally), the step-by-step 3D animations, the
// one-time rewards, and the ability to reset a solved lesson so it can be
// replayed. The Tabla de Blocuri UI drives it via beginRun/performStep/finish.
export class VatraModule {
  private readonly ox = VATRA_ORIGIN.x;
  private readonly oz = VATRA_ORIGIN.z;
  private readonly groundY: number;
  private readonly lox = LUNCA_ORIGIN.x;
  private readonly loz = LUNCA_ORIGIN.z;
  private readonly lunGroundY: number;
  private readonly pox = PADUREA_ORIGIN.x;
  private readonly poz = PADUREA_ORIGIN.z;
  private readonly paduGroundY: number;

  private done = new Set<string>();
  private effectsApplied = false;
  private lunEffectsApplied = false;
  private padEffectsApplied = false;

  // Animation state
  private bucket: THREE.Group;
  private bucketWater: THREE.Mesh;
  private bucketTargetY: number;
  private ovenLight: THREE.PointLight;
  private forgeLight: THREE.PointLight;
  private ovenSmokeTimer = 0;
  private forgeSmokeTimer = 0;
  private ovenLitThisRun = false;
  private doughMesh: THREE.Mesh | null = null;
  private pickaxeProp: THREE.Group | null = null;
  private horseProp: THREE.Group | null = null;
  private laundryProp: THREE.Group | null = null;
  private sheepProps: THREE.Group[] = [];
  private sheepGraze = 0;
  private sheepBaseY = 0;
  private millWheelProp: THREE.Group | null = null;
  private laundryWind = 0; // drives the swaying of the hung washing
  private laundryFxTimer = 0; // soap-bubble celebration right after a solve
  private laundryBubbleTimer = 0;
  private readonly guides: { zone: string; pos: THREE.Vector3 }[] = [];
  private flyings: Flying[] = [];
  private smokes: Smoke[] = [];
  private litCount = 0;
  private revertTimer = 0;
  private revertPuzzleId: string | null = null;

  // Every block placed mid-run by a loop puzzle is tracked here, so a
  // failed attempt (wrong repeat count, wrong nesting…) can be wiped clean
  // before the next one — the tree interpreter itself provides the pacing
  // now, so each action just places its next block immediately.
  private tempBlocks: { x: number; y: number; z: number; revertTo: BlockType }[] = [];
  private gardIndex = 0; // which fence post 'pune_stalp' places next
  private campIndex = 0; // which field tile 'planteaza_spic' places next
  private livadaIndex = 0; // which orchard spot the loop body is working on
  private capitaIndex = 0; // which haystack the outer loop is on
  private forkIndex = 0; // which forkful of hay within that haystack

  constructor(
    private scene: THREE.Scene,
    private world: World,
    private sound: SoundManager,
    private inventory: Inventory,
    private setBlock: (x: number, y: number, z: number, id: number) => void,
  ) {
    this.groundY = world.generator.heightAt(this.ox, this.oz);
    this.lunGroundY = world.generator.heightAt(this.lox, this.loz);
    this.paduGroundY = world.generator.heightAt(this.pox, this.poz);
    this.load();

    // The well bucket, hanging under the roof
    this.bucket = new THREE.Group();
    box(this.bucket, 0.3, 0.24, 0.3, 0x6b4a26, 0, 0, 0);
    this.bucketWater = box(this.bucket, 0.22, 0.06, 0.22, 0x3a78d8, 0, 0.14, 0);
    this.bucketWater.visible = false;
    this.bucketTargetY = this.groundY + BUCKET_HIGH;
    this.bucket.position.set(this.ox + 0.5, this.bucketTargetY, this.oz + 0.5);
    scene.add(this.bucket);

    // Oven fire glow (flares up on the "aprinde focul" step; stays lit for
    // good once the lesson is solved — see applySuccess/update)
    this.ovenLight = new THREE.PointLight(0xff8a30, this.done.has('cuptor') ? 1.8 : 0, 7, 1);
    this.ovenLight.position.set(this.ox - 6 + 0.5, this.groundY + 2.5, this.oz + 0.5);
    scene.add(this.ovenLight);

    // Forge fire glow (flares up on the "aprinde forja" step; stays lit for
    // good once the lesson is solved — see applySuccess/update)
    this.forgeLight = new THREE.PointLight(0xff8a30, this.done.has('fierarie') ? 1.8 : 0, 6, 1);
    this.forgeLight.position.set(this.ox - 7 + 0.5, this.groundY + 2.5, this.oz - 7 + 0.5);
    scene.add(this.forgeLight);

    this.buildBunicul();
    this.buildBaciul();
    this.buildMumaPadurii();
    this.buildSigns();
    if (this.done.has('fierarie')) this.setPickaxeProp(true);
    if (this.done.has('grajd')) this.setHorseProp(true);
    if (this.done.has('spalatorie')) this.setLaundryProp(true);
    if (this.done.has('gard')) this.setSheepProps(true);
    if (this.done.has('moara')) this.setMillWheelProp(true);
  }

  // Baciul Luncii: the shepherd who teaches loops, standing in the meadow
  // between the fence line and the field. Clickable, like Bunicul.
  private buildBaciul(): void {
    const npc = new THREE.Group();
    const COJOC = 0xe8e0cc; // sheepskin waistcoat
    const SHIRT = 0xf4f1e4;
    box(npc, 0.5, 0.75, 0.3, SHIRT, 0, 1.05, 0); // shirt
    box(npc, 0.54, 0.5, 0.34, COJOC, 0, 1.15, 0); // sheepskin waistcoat over it
    const head = box(npc, 0.42, 0.42, 0.42, 0xd8a878, 0, 1.66, 0);
    for (const side of [-1, 1]) {
      box(head, 0.09, 0.09, 0.05, 0xfaf6ea, side * 0.11, 0.05, -0.21); // eye whites
      box(head, 0.045, 0.045, 0.05, 0x241a0e, side * 0.11, 0.05, -0.23); // pupils
    }
    box(head, 0.26, 0.16, 0.06, 0x4a3a26, 0, -0.16, -0.22); // moustache
    box(head, 0.44, 0.3, 0.44, 0x2e2318, 0, 0.32, 0); // căciulă (tall wool hat)
    for (const side of [-1, 1]) {
      box(npc, 0.14, 0.5, 0.14, SHIRT, side * 0.32, 0.85, 0); // arms
      box(npc, 0.16, 0.16, 0.16, 0xd8a878, side * 0.32, 0.55, 0); // hands
      box(npc, 0.16, 0.7, 0.16, 0x3a2e1e, side * 0.14, 0.35, 0); // legs
    }
    box(npc, 0.09, 1.7, 0.09, 0x8a6a3a, 0.44, 0.85, 0.1); // bâta (shepherd's staff)

    npc.position.set(this.lox + 2 + 0.5, this.lunGroundY + 1, this.loz - 2 + 0.5);
    npc.rotation.y = Math.PI; // facing south, toward the player coming in
    this.scene.add(npc);
    this.registerGuide('lunca', npc.position.x, this.lunGroundY + 1.9, npc.position.z);

    const nameSign = makeSign('Baciul Luncii', 1.6);
    nameSign.position.set(npc.position.x, npc.position.y + 2.35, npc.position.z);
    this.scene.add(nameSign);
  }

  // Muma Pădurii: a gaunt forest-witch figure watching over her threshold
  private buildMumaPadurii(): void {
    const npc = new THREE.Group();
    box(npc, 0.46, 0.85, 0.34, 0x2e3a24, 0, 1.1, 0); // dark mossy robe
    const head = box(npc, 0.34, 0.34, 0.34, 0xb8a888, 0, 1.86, 0);
    box(head, 0.4, 0.12, 0.4, 0x3a2e1a, 0, 0.2, 0); // twiggy hood band
    for (const side of [-1, 1]) {
      box(npc, 0.1, 0.5, 0.1, 0x4a3a24, side * 0.3, 0.6, -0.1); // gnarled arms
    }
    npc.position.set(this.pox - 6 + 0.5, this.paduGroundY + 1, this.poz - 6 + 0.5);
    npc.rotation.y = Math.PI / 3; // facing the lantern
    this.scene.add(npc);
  }

  // Bunicul Fierar: a static villager figure watching over the square
  private buildBunicul(): void {
    const npc = new THREE.Group();
    box(npc, 0.5, 0.75, 0.3, 0x6b4a2a, 0, 1.05, 0); // coat
    const head = box(npc, 0.42, 0.42, 0.42, 0xe0b088, 0, 1.66, 0);
    for (const side of [-1, 1]) {
      box(head, 0.09, 0.09, 0.05, 0xfaf6ea, side * 0.11, 0.05, -0.21); // eye whites
      box(head, 0.045, 0.045, 0.05, 0x241a0e, side * 0.11, 0.05, -0.23); // pupils
    }
    box(head, 0.3, 0.2, 0.06, 0xd8d8d0, 0, -0.16, -0.22); // beard
    box(head, 0.46, 0.1, 0.46, 0x3a2a1a, 0, 0.26, 0); // hat brim
    box(head, 0.3, 0.16, 0.3, 0x3a2a1a, 0, 0.36, 0); // hat top
    for (const side of [-1, 1]) {
      box(npc, 0.14, 0.5, 0.14, 0x6b4a2a, side * 0.32, 0.85, 0); // arms (sleeves)
      box(npc, 0.16, 0.16, 0.16, 0xe0b088, side * 0.32, 0.55, 0); // hands
      box(npc, 0.16, 0.7, 0.16, 0x4a3420, side * 0.14, 0.35, 0); // legs
    }
    npc.position.set(this.ox - 2 + 0.5, this.groundY + 1, this.oz + 3 + 0.5);
    npc.rotation.y = -Math.PI / 4; // facing the well
    this.scene.add(npc);
    this.registerGuide('vatra', npc.position.x, this.groundY + 1.9, npc.position.z);

    const nameSign = makeSign('Bunicul Fierar', 1.6);
    nameSign.position.set(npc.position.x, npc.position.y + 2.35, npc.position.z);
    this.scene.add(nameSign);
  }

  // One signpost per lesson location, planted at ground level right in
  // front of the activity
  private buildSigns(): void {
    for (const [puzzleId, info] of Object.entries(LESSON_SIGNS)) {
      const [ox, gy, oz] = this.originFor(puzzleId);
      const sign = makeSignBoard(info.label);
      sign.position.set(ox + info.dx + 0.5, gy, oz + info.dz + 0.5);
      sign.rotation.y = info.yaw ?? 0;
      this.scene.add(sign);
    }
  }

  // Each zone's teacher NPC, for the click hit-test below
  private registerGuide(zone: string, x: number, y: number, z: number): void {
    this.guides.push({ zone, pos: new THREE.Vector3(x, y, z) });
  }

  // Which zone's guide a camera ray (within reach) hits, if any — opens that
  // zone's lesson popup. They're decorative NPCs, not voxel blocks, so
  // puzzleAt()'s block-grid lookup can't see them; this is a ray-sphere test.
  guideAt(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    maxDist: number,
  ): string | null {
    const ray = new THREE.Ray(
      new THREE.Vector3(origin.x, origin.y, origin.z),
      new THREE.Vector3(dir.x, dir.y, dir.z).normalize(),
    );
    const hitPoint = new THREE.Vector3();
    let best: { zone: string; dist: number } | null = null;
    for (const guide of this.guides) {
      if (!ray.intersectSphere(new THREE.Sphere(guide.pos, 0.9), hitPoint)) continue;
      const dist = ray.origin.distanceTo(hitPoint);
      if (dist > maxDist) continue;
      if (!best || dist < best.dist) best = { zone: guide.zone, dist };
    }
    return best ? best.zone : null;
  }

  // Which puzzle (if any) the targeted block belongs to — drives right-click
  puzzleAt(bx: number, by: number, bz: number): string | null {
    const dx = bx - this.ox;
    const dy = by - this.groundY;
    const dz = bz - this.oz;
    if (dy >= 0 && dy <= 5) {
      if (dx >= -1 && dx <= 1 && dz >= -1 && dz <= 4) return 'fantana';
      if (dx >= -8 && dx <= -4 && dz >= -2 && dz <= 1) return 'cuptor';
      if (dx >= 3 && dx <= 13 && dz >= -1 && dz <= 1) return 'ulita';
      if (dx >= -9 && dx <= -5 && dz >= -8 && dz <= -6) return 'fierarie';
      if (dx >= -3 && dx <= 3 && dz >= -8 && dz <= -5) return 'grajd';
      if (dx >= 5 && dx <= 10 && dz >= -8 && dz <= -5) return 'spalatorie';
    }

    const lx = bx - this.lox;
    const ly = by - this.lunGroundY;
    const lz = bz - this.loz;
    if (ly >= 0 && ly <= 5) {
      if (lx >= -15 && lx <= 16 && lz >= -6 && lz <= -6) return 'gard';
      if (lx >= 20 && lx <= 25 && lz >= -2 && lz <= 1) return 'camp_grau';
      if (lx >= 19 && lx <= 24 && lz >= 6 && lz <= 10) return 'moara';
      if (lx >= -16 && lx <= -3 && lz >= 2 && lz <= 4) return 'livada';
      if (lx >= -15 && lx <= -5 && lz >= 7 && lz <= 9) return 'capite';
    }

    const px = bx - this.pox;
    const py = by - this.paduGroundY;
    const pz = bz - this.poz;
    if (py >= 0 && py <= 5) {
      if (px >= -8 && px <= 8 && pz >= -8 && pz <= -5) return 'poteca';
      if (px >= -3 && px <= 3 && pz >= 0 && pz <= 6) return 'pod';
      if (px >= 10 && px <= 16 && pz >= -8 && pz <= -2) return 'capcana';
    }
    return null;
  }

  // The whole square is protected from mining so the puzzles stay intact
  isProtected(bx: number, by: number, bz: number): boolean {
    const dx = bx - this.ox;
    const dy = by - this.groundY;
    const dz = bz - this.oz;
    if (dx >= -10 && dx <= 16 && dz >= -9 && dz <= 7 && dy >= 0 && dy <= 8) return true;

    const lx = bx - this.lox;
    const ly = by - this.lunGroundY;
    const lz = bz - this.loz;
    if (lx >= -16 && lx <= 26 && lz >= -7 && lz <= 11 && ly >= 0 && ly <= 6) return true;

    const px = bx - this.pox;
    const py = by - this.paduGroundY;
    const pz = bz - this.poz;
    return px >= -9 && px <= 17 && pz >= -9 && pz <= 7 && py >= 0 && py <= 6;
  }

  isDone(puzzleId: string): boolean {
    return this.done.has(puzzleId);
  }

  // Zona 3 (Pădurea) is built and playable in code, but not yet opened to
  // players — Game.ts shows a "coming soon" toast for it instead of opening
  // the tabla. Zona 1 (Vatra) and Zona 2 (Lunca) are live.
  isComingSoon(puzzleId: string): boolean {
    return PADUREA_PUZZLES.has(puzzleId);
  }

  beginRun(puzzleId: string): void {
    // Wipe any half-built leftovers from a previous failed loop-puzzle run
    this.clearTempBlocks();

    if (puzzleId === 'fantana') {
      this.bucketTargetY = this.groundY + BUCKET_HIGH;
      this.bucketWater.visible = false;
    }
    if (puzzleId === 'ulita') this.litCount = 0;
    if (puzzleId === 'cuptor') {
      // Only zero the flame out if it's not the solved lesson's permanent fire
      if (!this.done.has('cuptor')) this.ovenLight.intensity = 0;
      this.ovenLitThisRun = false;
      this.setDough(false);
    }
    // Only zero the flame out if it's not the solved lesson's permanent fire
    if (puzzleId === 'fierarie' && !this.done.has('fierarie')) this.forgeLight.intensity = 0;
    if (puzzleId === 'gard') this.gardIndex = 0;
    if (puzzleId === 'camp_grau') this.campIndex = 0;
    if (puzzleId === 'livada') this.livadaIndex = 0;
    if (puzzleId === 'capite') {
      this.capitaIndex = 0;
      this.forkIndex = 0;
    }
  }

  // Something happened in the lesson's world (an event a "când" block may be
  // listening for): the zone's prop reacts. Nothing yet — the event lessons
  // come with Prisaca.
  performEvent(_puzzleId: string, _eventId: string): void {
    this.sound.clink();
  }

  // One program block executes: animate the matching mechanism
  performStep(puzzleId: string, blockId: string, _arg?: number): void {
    if (puzzleId === 'fantana') {
      if (blockId === 'coboara') {
        this.bucketTargetY = this.groundY + BUCKET_LOW;
        this.sound.stepTick();
      } else if (blockId === 'umple') {
        // Only actually fills if the bucket is down the (dry-ish) well
        if (this.bucket.position.y < this.groundY + BUCKET_LOW + 0.4) {
          this.bucketWater.visible = true;
          this.spawnFlyingBits(this.bucket.position.x, this.bucket.position.y, this.bucket.position.z, 0x3a78d8, 3);
          this.sound.splash();
        } else {
          this.sound.stepTick();
        }
      } else if (blockId === 'urca') {
        this.bucketTargetY = this.groundY + BUCKET_HIGH;
        this.sound.stepTick();
      } else if (blockId === 'varsa') {
        if (this.bucketWater.visible) {
          this.spawnFlyingBits(this.bucket.position.x, this.bucket.position.y, this.bucket.position.z, 0x3a78d8, 4);
        }
        this.bucketWater.visible = false;
        this.sound.stepTick();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'cuptor') {
      if (blockId === 'aprinde') {
        this.ovenLight.intensity = 3;
        this.ovenLitThisRun = true;
        this.sound.fireballCast();
      } else if (blockId === 'baga') {
        // The dough goes pale into the oven — golden only if the fire was
        // lit earlier this run, so a wrong-order run visibly never actually bakes
        this.setDough(true, this.ovenLitThisRun ? 0xd9a24a : 0xe8d8a8);
        this.sound.place();
      } else if (blockId === 'scoate') {
        const baked = this.doughMesh !== null && (this.doughMesh.material as THREE.MeshLambertMaterial).color.getHex() === 0xd9a24a;
        this.setDough(false);
        if (baked) this.spawnFlyingBits(this.ox - 6 + 0.5, this.groundY + 2.6, this.oz + 0.5, 0xd9a24a, 2);
        this.sound.stepTick();
      } else {
        this.spawnSmoke(this.ox - 6 + 0.5, this.groundY + 4.6, this.oz - 1 + 0.5, 0x9a9a9a, 0.18);
        this.sound.stepTick();
      }
    } else if (puzzleId === 'ulita') {
      if (blockId === 'aprinde_felinar' && this.litCount < LANTERNS.length) {
        const [lx, dy, lz] = LANTERNS[this.litCount];
        if (this.world.getBlock(this.ox + lx, this.groundY + dy, this.oz + lz) === BlockType.Glass) {
          this.setBlock(this.ox + lx, this.groundY + dy, this.oz + lz, BlockType.Lamp);
          this.spawnFlyingBits(this.ox + lx + 0.5, this.groundY + dy + 0.5, this.oz + lz + 0.5, 0xffe14d, 1);
        }
        this.litCount++;
        this.sound.place();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'fierarie') {
      if (blockId === 'aprinde_forja') {
        this.forgeLight.intensity = 3;
        this.sound.fireballCast();
      } else if (blockId === 'loveste') {
        this.spawnSmoke(this.ox - 5 + 0.5, this.groundY + 2.3, this.oz - 5 + 0.5, 0xffb04a, 0.14);
        this.sound.clink();
      } else if (blockId === 'caleste') {
        this.sound.splash();
      } else if (blockId === 'pune_fier') {
        this.sound.place();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'grajd') {
      if (blockId === 'toarna_apa' || blockId === 'adu_apa') {
        this.spawnFlyingBits(this.ox + 0.5, this.groundY + 1.4, this.oz - 6 + 0.5, 0x3a78d8, 2);
        this.sound.splash();
      } else if (blockId === 'deschide_poarta') {
        this.sound.doorToggle();
      } else if (blockId === 'pune_in_iesle') {
        this.spawnFlyingBits(this.ox + 0.5, this.groundY + 1.4, this.oz - 6 + 0.5, 0xd9c27a, 2);
        this.sound.place();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'spalatorie') {
      if (blockId === 'inmoaie' || blockId === 'clateste') {
        this.spawnFlyingBits(this.ox + 6 + 0.5, this.groundY + 2.3, this.oz - 7 + 0.5, 0x3a78d8, 2);
        this.sound.splash();
      } else if (blockId === 'intinde') {
        this.spawnFlyingBits(this.ox + 6 + 0.5, this.groundY + 2.3, this.oz - 7 + 0.5, 0xe8e8e8, 2);
        this.sound.place();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'gard') {
      if (blockId === 'pune_stalp') {
        const dx = fencePostPos(this.gardIndex);
        this.placeTemp(this.lox + dx, this.lunGroundY + 1, this.loz - 6, BlockType.Log, BlockType.Air);
        this.gardIndex++;
        if (this.gardIndex % 5 === 0) this.sound.place();
      } else if (blockId === 'prinde_capatul') {
        this.spawnFlyingBits(this.lox + 16 + 0.5, this.lunGroundY + 2, this.loz - 6 + 0.5, 0x8a6a3a, 2, this.lunGroundY);
        this.sound.clink();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'camp_grau') {
      if (blockId === 'planteaza_spic') {
        if (this.campIndex < FIELD_POS.length) {
          const [dx, dy, dz] = FIELD_POS[this.campIndex];
          this.placeTemp(this.lox + dx, this.lunGroundY + dy, this.loz + dz, BlockType.Wheat, BlockType.Dirt);
        }
        this.campIndex++;
        if (this.campIndex % 4 === 0) this.sound.place();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'moara') {
      if (blockId === 'porneste_apa') {
        this.sound.splash();
      } else if (blockId === 'macina') {
        this.placeTemp(
          this.lox + MILL_FLOUR[0],
          this.lunGroundY + MILL_FLOUR[1],
          this.loz + MILL_FLOUR[2],
          BlockType.Flour,
          BlockType.Air,
        );
        this.spawnSmoke(this.lox + 22 + 0.5, this.lunGroundY + 2, this.loz + 8 + 0.5, 0xe8e0d0, 0.2);
        this.sound.place();
      } else if (blockId === 'opreste_apa') {
        this.sound.splash();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'livada') {
      const spot = ORCHARD_DX[Math.min(this.livadaIndex, ORCHARD_DX.length - 1)];
      const tree = orchardTree(spot);
      if (blockId === 'sapa_groapa') {
        this.spawnFlyingBits(this.lox + spot + 0.5, this.lunGroundY + 1.6, this.loz + ORCHARD_DZ + 0.5, 0x8a6a4a, 3, this.lunGroundY);
        this.sound.stepTick();
      } else if (blockId === 'pune_puietul') {
        if (this.livadaIndex < ORCHARD_DX.length) {
          for (const [x, y, z] of tree.trunk) {
            this.placeTemp(this.lox + x, this.lunGroundY + y, this.loz + z, BlockType.Log, y === 1 ? BlockType.Dirt : BlockType.Air);
          }
        }
        this.sound.place();
      } else if (blockId === 'uda_puietul') {
        if (this.livadaIndex < ORCHARD_DX.length) {
          for (const [x, y, z] of tree.canopy) {
            this.placeTemp(this.lox + x, this.lunGroundY + y, this.loz + z, BlockType.Leaves, BlockType.Air);
          }
        }
        this.livadaIndex++; // the tree is finished; the next pass digs the next hole
        this.sound.splash();
      } else if (blockId === 'ingradeste_livada') {
        this.spawnFlyingBits(this.lox - 9 + 0.5, this.lunGroundY + 1.6, this.loz + ORCHARD_DZ + 0.5, 0x8a6a3a, 3, this.lunGroundY);
        this.sound.clink();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'capite') {
      const spot = HAYSTACK_DX[Math.min(this.capitaIndex, HAYSTACK_DX.length - 1)];
      const stack = haystack(spot);
      const inRange = this.capitaIndex < HAYSTACK_DX.length;
      if (blockId === 'coseste_iarba') {
        this.spawnFlyingBits(this.lox - 10 + 0.5, this.lunGroundY + 1.3, this.loz + HAYSTACK_DZ + 0.5, 0x8fb54a, 3, this.lunGroundY);
        this.sound.stepTick();
      } else if (blockId === 'infige_parul') {
        if (inRange) {
          for (const [x, y, z] of stack.pole) {
            this.placeTemp(this.lox + x, this.lunGroundY + y, this.loz + z, BlockType.Log, BlockType.Air);
          }
        }
        this.forkIndex = 0;
        this.sound.place();
      } else if (blockId === 'arunca_fanul') {
        if (inRange && this.forkIndex < stack.forkfuls.length) {
          for (const [x, y, z] of stack.forkfuls[this.forkIndex]) {
            this.placeTemp(this.lox + x, this.lunGroundY + y, this.loz + z, BlockType.Hay, BlockType.Air);
          }
        }
        this.forkIndex++;
        this.spawnFlyingBits(this.lox + spot + 0.5, this.lunGroundY + 2.2, this.loz + HAYSTACK_DZ + 0.5, 0xd9c27a, 2, this.lunGroundY);
        this.sound.place();
      } else if (blockId === 'leaga_capita') {
        if (inRange) {
          const [x, y, z] = stack.cap;
          this.placeTemp(this.lox + x, this.lunGroundY + y, this.loz + z, BlockType.Hay, BlockType.Air);
        }
        this.capitaIndex++; // on to the next haystack
        this.forkIndex = 0;
        this.sound.clink();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'poteca') {
      if (blockId === 'aprinde') {
        this.placeTemp(
          this.pox + LANTERN_POTECA[0],
          this.paduGroundY + LANTERN_POTECA[1],
          this.poz + LANTERN_POTECA[2],
          BlockType.Lamp,
          BlockType.Glass,
        );
        this.sound.place();
      } else if (blockId === 'stinge') {
        this.placeTemp(
          this.pox + LANTERN_POTECA[0],
          this.paduGroundY + LANTERN_POTECA[1],
          this.poz + LANTERN_POTECA[2],
          BlockType.Glass,
          BlockType.Glass,
        );
        this.sound.stepTick();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'pod') {
      if (blockId === 'ridica') {
        this.placeTemp(
          this.pox + BRIDGE_RAIL[0],
          this.paduGroundY + BRIDGE_RAIL[1],
          this.poz + BRIDGE_RAIL[2],
          BlockType.Log,
          BlockType.Air,
        );
        this.sound.place();
      } else {
        this.sound.stepTick();
      }
    } else if (puzzleId === 'capcana') {
      if (blockId === 'declanseaza') {
        this.placeTemp(
          this.pox + TRAP_CENTER[0],
          this.paduGroundY + TRAP_CENTER[1],
          this.poz + TRAP_CENTER[2],
          BlockType.Hay,
          BlockType.Plank,
        );
        this.sound.clink();
      } else {
        this.sound.stepTick();
      }
    }
  }

  // Places a block and remembers what it was before, so a failed attempt
  // (wrong repeat count, wrong nesting…) can be wiped clean before the next
  private placeTemp(x: number, y: number, z: number, id: BlockType, revertTo: BlockType): void {
    this.setBlock(x, y, z, id);
    this.tempBlocks.push({ x, y, z, revertTo });
  }

  // Wipes every block placed during the current/last loop-puzzle attempt
  // back to its pre-attempt state (Air for a fence gap, Dirt for a field…).
  private clearTempBlocks(): void {
    for (const t of this.tempBlocks) this.setBlock(t.x, t.y, t.z, t.revertTo);
    this.tempBlocks = [];
  }

  // Program ended: evaluate, play the success/fail act, grant one-time rewards.
  // A program passes when it has the solution's shape (up to how the child
  // named boxes and procedures), or — in a lesson graded on behaviour — when
  // it does exactly what the solution does in every scenario and meets the
  // lesson's requirements. Otherwise the first matching comic fail speaks.
  finish(puzzleId: string, program: ProgramNode[]): { success: boolean; text: string } {
    const puzzle = VATRA_PUZZLES[puzzleId];
    const result = evaluate(puzzle, program);
    let solved = programEquivalent(program, puzzle.solution);
    let failText: string | null = null;
    if (!solved && gradesByTrace(puzzle) && !result.infinite) {
      const expected = evaluate(puzzle, puzzle.solution);
      if (tracesEqual(result, expected)) {
        const missing = (puzzle.requirements ?? []).find((r) => !r.check(program, result));
        if (missing) failText = missing.text;
        else solved = true;
      }
    }

    if (solved) {
      this.applySuccess(puzzleId);
      this.sound.success();
      return { success: true, text: puzzle.success };
    }

    const fail =
      puzzle.fails.find((f) => f.matches(program, result)) ?? puzzle.fails[puzzle.fails.length - 1];
    if (failText) {
      this.sound.failTrombone();
      return { success: false, text: failText };
    }
    if (fail.anim === 'coal') this.coalFail(puzzleId);
    if (fail.anim === 'bucket') this.bucketWater.visible = false;
    if (fail.anim === 'splash') this.splashFail();
    if (fail.anim === 'dark') {
      this.revertTimer = 1.2; // the lit lanterns (or a loop puzzle's build) flicker back out
      this.revertPuzzleId = puzzleId;
    }
    this.sound.failTrombone();
    return { success: false, text: fail.text };
  }

  private applySuccess(puzzleId: string): void {
    const firstTime = !this.done.has(puzzleId);
    this.applyEffects(puzzleId);
    this.tempBlocks = []; // whatever the loop just built is now permanent — stop tracking it for revert
    if (puzzleId === 'cuptor') {
      this.ovenLight.intensity = 1.8; // a fire keeps burning in the oven from now on, not just a lamp block
      this.spawnFlyingBits(this.ox - 6 + 0.5, this.groundY + 2.3, this.oz + 1.2, 0xc98d3a, 3);
    }
    if (puzzleId === 'fierarie') {
      this.forgeLight.intensity = 1.8; // the forge keeps burning for good, not just a lamp block
      this.setPickaxeProp(true);
      this.spawnFlyingBits(this.ox - 7 + 0.5, this.groundY + 2.3, this.oz - 6 + 0.5, 0xb0b0b0, 1);
    }
    if (puzzleId === 'grajd') {
      this.setHorseProp(true);
      this.spawnFlyingBits(this.ox + 0.5, this.groundY + 1.3, this.oz - 6 + 0.5, 0xd9c27a, 2);
    }
    if (puzzleId === 'spalatorie') {
      this.setLaundryProp(true);
      this.spawnFlyingBits(this.ox + 6 + 0.5, this.groundY + 2.3, this.oz - 7 + 0.5, 0xe8e8e8, 2);
      this.laundryFxTimer = 3; // soap bubbles boil up off the stream for a beat
      this.laundryBubbleTimer = 0;
    }
    if (puzzleId === 'gard') {
      this.setSheepProps(true);
      this.spawnFlyingBits(this.lox + 0.5, this.lunGroundY + 1.3, this.loz - 6 + 0.5, 0xf0ece0, 3, this.lunGroundY);
    }
    if (puzzleId === 'camp_grau') this.spawnFlyingBits(this.lox + 22 + 0.5, this.lunGroundY + 1.3, this.loz - 0.5, 0xd8b840, 3, this.lunGroundY);
    if (puzzleId === 'moara') {
      this.setMillWheelProp(true);
      this.spawnFlyingBits(this.lox + 22 + 0.5, this.lunGroundY + 2, this.loz + 8 + 0.5, 0xe8e0d0, 2, this.lunGroundY);
    }
    if (puzzleId === 'livada') this.spawnFlyingBits(this.lox - 9 + 0.5, this.lunGroundY + 3, this.loz + ORCHARD_DZ + 0.5, 0x5aa03a, 4, this.lunGroundY);
    if (puzzleId === 'capite') this.spawnFlyingBits(this.lox - 10 + 0.5, this.lunGroundY + 3, this.loz + HAYSTACK_DZ + 0.5, 0xd9c27a, 4, this.lunGroundY);
    if (puzzleId === 'poteca') this.spawnFlyingBits(this.pox + 0.5, this.paduGroundY + 2.2, this.poz - 6 + 0.5, 0xffe14d, 2, this.paduGroundY);
    if (puzzleId === 'pod') this.spawnFlyingBits(this.pox + 0.5, this.paduGroundY + 2, this.poz + 3 + 0.5, 0x8a6a3a, 2, this.paduGroundY);
    if (puzzleId === 'capcana') this.spawnFlyingBits(this.pox + 13 + 0.5, this.paduGroundY + 1.3, this.poz - 4 + 0.5, 0xd9c27a, 2, this.paduGroundY);
    // The payout is the puzzle's own rewardItems list, so what a lesson
    // hands over, what its reward line says, and what the Ajutor panel lists
    // can't drift apart. Vatra's six pay on every solve; the Luncă and
    // Pădurea ones only the first time.
    const puzzle = VATRA_PUZZLES[puzzleId];
    if (puzzle && (puzzle.rewardRepeats || firstTime)) {
      for (const item of puzzle.rewardItems) this.inventory.add(item.id as BlockType, item.count);
    }
    if (firstTime) {
      this.done.add(puzzleId);
      this.save();
    }
  }

  // Revert a solved lesson back to its unsolved state (world blocks +
  // completion flag) so it can be replayed from scratch, rewards and all.
  resetPuzzle(puzzleId: string): void {
    if (!this.done.has(puzzleId)) return;
    this.revertEffects(puzzleId);
    if (puzzleId === 'cuptor') this.ovenLight.intensity = 0; // the permanent fire goes out too
    if (puzzleId === 'fierarie') {
      this.forgeLight.intensity = 0;
      this.setPickaxeProp(false);
    }
    if (puzzleId === 'grajd') this.setHorseProp(false);
    if (puzzleId === 'spalatorie') {
      this.setLaundryProp(false);
      this.laundryFxTimer = 0;
    }
    if (puzzleId === 'gard') this.setSheepProps(false);
    if (puzzleId === 'moara') this.setMillWheelProp(false);
    this.done.delete(puzzleId);
    this.save();
  }

  // Which zone a lesson belongs to
  zoneOf(puzzleId: string): string {
    if (LUNCA_PUZZLES.has(puzzleId)) return 'lunca';
    if (PADUREA_PUZZLES.has(puzzleId)) return 'padurea';
    return 'vatra';
  }

  // Zona 1 (Vatra), Zona 2 (Lunca) and Zona 3 (Pădurea) puzzles each use a
  // different world origin
  originFor(puzzleId: string): [number, number, number] {
    if (LUNCA_PUZZLES.has(puzzleId)) return [this.lox, this.lunGroundY, this.loz];
    if (PADUREA_PUZZLES.has(puzzleId)) return [this.pox, this.paduGroundY, this.poz];
    return [this.ox, this.groundY, this.oz];
  }

  private applyEffects(puzzleId: string): void {
    const [ox, gy, oz] = this.originFor(puzzleId);
    for (const e of PUZZLE_EFFECTS[puzzleId] ?? []) {
      this.setBlock(ox + e.pos[0], gy + e.pos[1], oz + e.pos[2], e.solved);
    }
  }

  private revertEffects(puzzleId: string): void {
    const [ox, gy, oz] = this.originFor(puzzleId);
    for (const e of PUZZLE_EFFECTS[puzzleId] ?? []) {
      this.setBlock(ox + e.pos[0], gy + e.pos[1], oz + e.pos[2], e.unsolved);
    }
  }

  // Reusable flying-prop flourish (colaci, a horseshoe, hay, laundry…)
  private spawnFlyingBits(x: number, y: number, z: number, color: number, count: number, floorY = this.groundY): void {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.12, 0.22),
        new THREE.MeshLambertMaterial({ color }),
      );
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.flyings.push({ mesh, vx: (Math.random() - 0.5) * 2, vy: 3.5 + i, vz: 2.5 + Math.random(), life: 2.2, floorY });
    }
  }

  // The flagship comic fail: a smoking coal boulder (or a puff of dry flour
  // dust for the mill) shoots out of the mechanism that ran without fuel
  private coalFail(puzzleId: string): void {
    let x: number, y: number, z: number, floorY: number;
    if (puzzleId === 'fierarie') [x, y, z, floorY] = [this.ox - 7 + 0.5, this.groundY + 2.3, this.oz - 7 + 0.5, this.groundY];
    else if (puzzleId === 'moara') [x, y, z, floorY] = [this.lox + 22 + 0.5, this.lunGroundY + 2.3, this.loz + 8 + 0.5, this.lunGroundY];
    else [x, y, z, floorY] = [this.ox - 6 + 0.5, this.groundY + 2.3, this.oz + 1.2, this.groundY];
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.45, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x1c1c1c }),
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.flyings.push({ mesh, vx: 0, vy: 5, vz: 4, life: 2.5, floorY });
    for (let i = 0; i < 4; i++) {
      this.spawnSmoke(x, y + 0.1 + i * 0.2, z, 0x333333, 0.3);
    }
  }

  // The bridge's comic fail: a cart tumbles into the river with a splash
  private splashFail(): void {
    const x = this.pox + 0.5;
    const y = this.paduGroundY + 1.6;
    const z = this.poz + 3 + 0.5;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.3, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x6b4a26 }),
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.flyings.push({ mesh, vx: 0.5, vy: 3, vz: 0, life: 1.8, floorY: this.paduGroundY });
    for (let i = 0; i < 3; i++) {
      this.spawnSmoke(x, this.paduGroundY + 0.5, z, 0x3a78d8, 0.22);
    }
    this.sound.splash();
  }

  // The dough/bread prop sitting inside the oven cavity — visible from
  // 'baga' (goes in pale) to 'scoate' (comes back out, or vanishes if never put in)
  private setDough(inOven: boolean, color = 0xe8d8a8): void {
    if (!inOven) {
      if (this.doughMesh) {
        this.scene.remove(this.doughMesh);
        this.doughMesh.geometry.dispose();
        (this.doughMesh.material as THREE.Material).dispose();
        this.doughMesh = null;
      }
      return;
    }
    if (this.doughMesh) {
      (this.doughMesh.material as THREE.MeshLambertMaterial).color.setHex(color);
      return;
    }
    this.doughMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.2, 0.46),
      new THREE.MeshLambertMaterial({ color }),
    );
    this.doughMesh.position.set(
      this.ox + OVEN_CAVITY[0] + 0.5,
      this.groundY + OVEN_CAVITY[1] + 0.2,
      this.oz + OVEN_CAVITY[2] + 0.5,
    );
    this.scene.add(this.doughMesh);
  }

  // The finished pickaxe sitting in the forge cavity once fierarie is
  // solved — replaces the old Lamp block. Gone again on reset.
  private setPickaxeProp(show: boolean): void {
    if (!show) {
      if (this.pickaxeProp) {
        this.scene.remove(this.pickaxeProp);
        disposeModel(this.pickaxeProp);
        this.pickaxeProp = null;
      }
      return;
    }
    if (this.pickaxeProp) return;
    this.pickaxeProp = buildToolModel(ToolId.Tarnacop);
    this.pickaxeProp.scale.setScalar(1.7);
    this.pickaxeProp.rotation.z = 0.4; // leaning against the cavity wall
    this.pickaxeProp.position.set(
      this.ox + FORGE_CAVITY[0] + 0.5,
      this.groundY + FORGE_CAVITY[1] - 0.2,
      this.oz + FORGE_CAVITY[2] + 0.5,
    );
    this.scene.add(this.pickaxeProp);
  }

  // The horse standing in the stable once Grajdul is solved. Gone on reset.
  private setHorseProp(show: boolean): void {
    if (!show) {
      if (this.horseProp) {
        this.scene.remove(this.horseProp);
        disposeModel(this.horseProp);
        this.horseProp = null;
      }
      return;
    }
    if (this.horseProp) return;
    this.horseProp = buildHorse();
    this.horseProp.scale.setScalar(1.2);
    // Standing on the stable floor (its top is groundY + 1, like Bunicul),
    // in the free row behind the trough, head reaching over the hay.
    this.horseProp.position.set(this.ox + 0.5, this.groundY + 1, this.oz - 6.4);
    this.horseProp.rotation.y = -Math.PI / 2; // facing the trough
    this.scene.add(this.horseProp);
  }

  // The sheep finally let into the Luncă once its fence closes. Gone on reset.
  private setSheepProps(show: boolean): void {
    if (!show) {
      for (const sheep of this.sheepProps) {
        this.scene.remove(sheep);
        disposeModel(sheep);
      }
      this.sheepProps = [];
      return;
    }
    if (this.sheepProps.length > 0) return;
    for (const [dx, dz] of SHEEP_SPOTS) {
      const sheep = buildSheep();
      // Standing on the meadow surface (its top is lunGroundY + 1), each one
      // turned a different way so the flock doesn't look stamped out
      sheep.position.set(this.lox + dx + 0.5, this.lunGroundY + 1, this.loz + dz + 0.5);
      sheep.rotation.y = (dx * 1.3 + dz) % (Math.PI * 2);
      this.scene.add(sheep);
      this.sheepProps.push(sheep);
    }
    this.sheepBaseY = this.lunGroundY + 1;
  }

  // The mill wheel, turning for good once the "while" loop is solved. The
  // static log wheel is cleared by moara's block effects at the same moment,
  // so exactly one wheel is ever in that spot.
  private setMillWheelProp(show: boolean): void {
    if (!show) {
      if (this.millWheelProp) {
        this.scene.remove(this.millWheelProp);
        disposeModel(this.millWheelProp);
        this.millWheelProp = null;
      }
      return;
    }
    if (this.millWheelProp) return;
    this.millWheelProp = buildMillWheel();
    // Centred on the hub block it replaces (dx 19, dy 2, dz 8)
    this.millWheelProp.position.set(this.lox + 19 + 0.5, this.lunGroundY + 2 + 0.5, this.loz + 8 + 0.5);
    this.scene.add(this.millWheelProp);
  }

  // The washing hung out to dry once Spălătoria is solved. Gone on reset.
  private setLaundryProp(show: boolean): void {
    if (!show) {
      if (this.laundryProp) {
        this.scene.remove(this.laundryProp);
        disposeModel(this.laundryProp);
        this.laundryProp = null;
      }
      return;
    }
    if (this.laundryProp) return;
    this.laundryProp = buildLaundryLine();
    // Draped over the near (east) face of the clothesline bar (dx 6, dy 3,
    // running along z) — hanging inside the bar's own column would bury the
    // end shirts in the two corner posts, which stand at the same dx.
    this.laundryProp.position.set(this.ox + 7.03, this.groundY + 3, this.oz - 6.5);
    this.scene.add(this.laundryProp);
  }

  private spawnSmoke(x: number, y: number, z: number, color: number, size: number): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 6, 5),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.smokes.push({ mesh, age: 0 });
  }

  update(dt: number): void {
    // Bucket glides toward its target height
    const dy = this.bucketTargetY - this.bucket.position.y;
    if (Math.abs(dy) > 0.01) this.bucket.position.y += Math.sign(dy) * Math.min(Math.abs(dy), 2.5 * dt);

    // Oven / forge fire glow fades — except once solved: they then burn for
    // good, with the chimney puffing smoke forever
    if (this.ovenLight.intensity > 0 && !this.done.has('cuptor')) {
      this.ovenLight.intensity = Math.max(0, this.ovenLight.intensity - 2.2 * dt);
    }
    if (this.forgeLight.intensity > 0 && !this.done.has('fierarie')) {
      this.forgeLight.intensity = Math.max(0, this.forgeLight.intensity - 2.2 * dt);
    }

    // A lit oven keeps puffing smoke, not just once per step — out of its own
    // chimney stack (dx-6, dz-1, atop the 2-block cobblestone flue), sized to
    // grow into a puff roughly 3 blocks tall as it rises, same as the forge
    if (this.ovenLight.intensity > 0.3) {
      this.ovenSmokeTimer -= dt;
      if (this.ovenSmokeTimer <= 0) {
        this.spawnSmoke(this.ox - 6 + 0.5, this.groundY + 6, this.oz - 1 + 0.5, 0x9a9a9a, 0.55);
        this.ovenSmokeTimer = 0.5;
      }
    }
    // Fierărie's smoke only ever comes from its actual chimney stack (dx-7,
    // dz-8, atop the 2-block cobblestone flue), sized to grow into a puff
    // roughly 3 blocks tall as it rises — never from the cavity mouth itself.
    if (this.forgeLight.intensity > 0.3) {
      this.forgeSmokeTimer -= dt;
      if (this.forgeSmokeTimer <= 0) {
        this.spawnSmoke(this.ox - 7 + 0.5, this.groundY + 6, this.oz - 8 + 0.5, 0x9a9a9a, 0.55);
        this.forgeSmokeTimer = 0.5;
      }
    }

    // Once solved, the mill wheel never stops — the "while" loop made visible
    if (this.millWheelProp) this.millWheelProp.rotation.x += dt * 1.1;

    // The flock grazes on the spot — a slow dip and sway each, out of step
    // with one another, so they don't stand there like statues next to the
    // sheep that actually wander the map
    if (this.sheepProps.length > 0) {
      this.sheepGraze += dt;
      for (let i = 0; i < this.sheepProps.length; i++) {
        const t = this.sheepGraze * 0.9 + i * 2.1;
        const sheep = this.sheepProps[i];
        sheep.position.y = this.sheepBaseY + Math.max(0, Math.sin(t)) * 0.07;
        sheep.rotation.z = Math.sin(t) * 0.06; // nose dipping to the grass
      }
    }

    // Hung washing sways in the wind, each shirt on its own beat
    if (this.laundryProp) {
      this.laundryWind += dt;
      const shirts = this.laundryProp.children;
      for (let i = 0; i < shirts.length; i++) {
        // Always a positive angle: the gusts only ever lift the washing away
        // from the line, never back through the posts behind it
        shirts[i].rotation.z = (Math.sin(this.laundryWind * 1.7 + i * 0.9) * 0.5 + 0.5) * 0.24;
      }
    }

    // Right after the solve, the stream froths with soap bubbles that drift
    // up over the washing place
    if (this.laundryFxTimer > 0) {
      this.laundryFxTimer -= dt;
      this.laundryBubbleTimer -= dt;
      if (this.laundryBubbleTimer <= 0) {
        this.spawnSmoke(
          this.ox + 8 + Math.random() * 3,
          this.groundY + 1.2,
          this.oz - 7 + Math.random() * 2,
          0xdfeeff,
          0.12 + Math.random() * 0.12,
        );
        this.laundryBubbleTimer = 0.09;
      }
    }

    for (let i = this.flyings.length - 1; i >= 0; i--) {
      const f = this.flyings[i];
      f.vy -= 18 * dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.position.z += f.vz * dt;
      if (f.mesh.position.y < f.floorY + 1.1 && f.vy < 0) f.vy = -f.vy * 0.35; // bounce
      f.mesh.rotation.x += dt * 6;
      f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        (f.mesh.material as THREE.Material).dispose();
        this.flyings.splice(i, 1);
      }
    }

    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.age += dt;
      s.mesh.position.y += dt * 1.2;
      s.mesh.scale.setScalar(1 + s.age * 2);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 * (1 - s.age / 0.9));
      if (s.age >= 0.9) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
        this.smokes.splice(i, 1);
      }
    }

    // Failed run: the lit lanterns (or a loop puzzle's fresh build) revert after a beat
    if (this.revertTimer > 0) {
      this.revertTimer -= dt;
      if (this.revertTimer <= 0) {
        if (this.revertPuzzleId === 'ulita' && !this.done.has('ulita')) {
          for (let i = 0; i < this.litCount && i < LANTERNS.length; i++) {
            const [lx, ldy, lz] = LANTERNS[i];
            if (this.world.getBlock(this.ox + lx, this.groundY + ldy, this.oz + lz) === BlockType.Lamp) {
              this.setBlock(this.ox + lx, this.groundY + ldy, this.oz + lz, BlockType.Glass);
            }
          }
          this.litCount = 0;
        } else {
          this.clearTempBlocks();
        }
        this.revertPuzzleId = null;
      }
    }

    // Once the vatra chunk is loaded, re-apply the persistent state of any
    // already-solved puzzles (water in the trough, lit lanterns, embers…)
    if (!this.effectsApplied && this.world.getBlock(this.ox, this.groundY, this.oz) !== BlockType.Air) {
      this.effectsApplied = true;
      for (const puzzleId of Object.keys(PUZZLE_EFFECTS)) {
        if (!LUNCA_PUZZLES.has(puzzleId) && !PADUREA_PUZZLES.has(puzzleId) && this.done.has(puzzleId)) {
          this.applyEffects(puzzleId);
        }
      }
      // One-time migration: cuptor used to place a Lamp block in the oven
      // cavity on success — replaced by a permanent fire (see applySuccess).
      // A world saved under the old code still has that leftover Lamp block,
      // which the current code never touches (cuptor isn't in PUZZLE_EFFECTS
      // anymore), so clean it out explicitly and light the fire in its place.
      if (this.done.has('cuptor')) {
        const [cx, cy, cz] = OVEN_CAVITY;
        if (this.world.getBlock(this.ox + cx, this.groundY + cy, this.oz + cz) === BlockType.Lamp) {
          this.setBlock(this.ox + cx, this.groundY + cy, this.oz + cz, BlockType.Air);
        }
        this.ovenLight.intensity = 1.8;
      }
      // Same migration for fierarie: it used to leave a Lamp block in the
      // forge cavity, replaced by the pickaxe prop + permanent fire.
      if (this.done.has('fierarie')) {
        const [fx, fy, fz] = FORGE_CAVITY;
        if (this.world.getBlock(this.ox + fx, this.groundY + fy, this.oz + fz) === BlockType.Lamp) {
          this.setBlock(this.ox + fx, this.groundY + fy, this.oz + fz, BlockType.Air);
        }
        this.forgeLight.intensity = 1.8;
        this.setPickaxeProp(true);
      }
    }
    // Same, once the Lunca chunk is loaded, for its own puzzles
    if (!this.lunEffectsApplied && this.world.getBlock(this.lox, this.lunGroundY, this.loz) !== BlockType.Air) {
      this.lunEffectsApplied = true;
      for (const puzzleId of LUNCA_PUZZLES) {
        if (this.done.has(puzzleId)) this.applyEffects(puzzleId);
      }
    }
    // Same, once the Pădurea chunk is loaded, for its own puzzles
    if (!this.padEffectsApplied && this.world.getBlock(this.pox, this.paduGroundY, this.poz) !== BlockType.Air) {
      this.padEffectsApplied = true;
      for (const puzzleId of PADUREA_PUZZLES) {
        if (this.done.has(puzzleId)) this.applyEffects(puzzleId);
      }
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.done = new Set(JSON.parse(raw) as string[]);
    } catch {
      // corrupted or unavailable storage — start fresh
    }
  }

  private save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify([...this.done]));
    } catch {
      // storage full/unavailable — progress lives only in this session
    }
  }
}
