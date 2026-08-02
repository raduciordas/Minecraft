import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Must match CHUNK_SIZE in ../src/config.ts — the block-index formula below
// (lx + lz*CHUNK_SIZE + y*CHUNK_SIZE*CHUNK_SIZE) has to agree with
// ../src/world/Chunk.ts's blockIndex() for saved edits to load correctly.
const CHUNK_SIZE = 16;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const WORLD_FILE = join(DATA_DIR, 'world.json');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadWorld() {
  if (existsSync(WORLD_FILE)) {
    try {
      const data = JSON.parse(readFileSync(WORLD_FILE, 'utf8'));
      if (data && typeof data === 'object' && data.edits) return data;
    } catch {
      // fall through to a fresh world
    }
  }
  return { edits: {}, epoch: Date.now() };
}

const world = loadWorld();
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeFileSync(WORLD_FILE, JSON.stringify(world));
  }, 2000);
}

function colorFromName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0;
  const hue = ((h % 360) + 360) % 360;
  const accessory = Math.abs(h >> 8) % 4;
  return { hue, accessory };
}

const players = new Map(); // id -> { ws, name, color, x, y, z, yaw }
let nextId = 1;

// One lesson, one player at a time: whoever opens a Tabla de Blocuri holds it
// until they close it, go quiet for a minute, or drop off.
const LESSON_IDLE_MS = 60_000;
const LESSON_SWEEP_MS = 5_000;
const lessons = new Map(); // puzzleId -> { holder, expiresAt }

function announceLesson(puzzleId) {
  const lock = lessons.get(puzzleId);
  const holder = lock ? players.get(lock.holder) : null;
  broadcast({ type: 'lessonLock', puzzleId, by: lock ? lock.holder : null, byName: holder ? holder.name : null });
}

function releaseLessonsOf(playerId) {
  for (const [puzzleId, lock] of lessons) {
    if (lock.holder !== playerId) continue;
    lessons.delete(puzzleId);
    announceLesson(puzzleId);
  }
}

// A client that crashes or freezes never sends its release, so the server
// expires stale holds on its own — the client's own idle timer is the polite
// path, this is the backstop.
setInterval(() => {
  const now = Date.now();
  for (const [puzzleId, lock] of lessons) {
    if (lock.expiresAt > now) continue;
    lessons.delete(puzzleId);
    console.log(`${new Date().toISOString()} lesson ${puzzleId} expired (held by ${lock.holder})`);
    announceLesson(puzzleId);
  }
}, LESSON_SWEEP_MS);

function broadcast(msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const [id, p] of players) {
    if (id === exceptId) continue;
    if (p.ws.readyState === p.ws.OPEN) p.ws.send(data);
  }
}

const PORT = process.env.PORT || 8787;
const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`CUBURIA multiplayer server — ${players.size} player(s) online`);
});
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  let id = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'join' && id === null) {
      id = String(nextId++);
      console.log(`${new Date().toISOString()} join id=${id} name=${msg.name}`);
      const name = String(msg.name || 'Explorator').slice(0, 16);
      const color = colorFromName(name);
      players.set(id, { ws, name, color, x: 0.5, y: 40, z: 0.5, yaw: 0 });

      ws.send(
        JSON.stringify({
          type: 'init',
          selfId: id,
          epoch: world.epoch,
          edits: world.edits,
          players: [...players.entries()]
            .filter(([pid]) => pid !== id)
            .map(([pid, p]) => ({ id: pid, name: p.name, color: p.color, x: p.x, y: p.y, z: p.z, yaw: p.yaw })),
        }),
      );
      broadcast({ type: 'join', id, name, color, x: 0.5, y: 40, z: 0.5, yaw: 0 }, id);
      return;
    }

    if (id === null || !players.has(id)) return; // must join before anything else
    const player = players.get(id);

    if (msg.type === 'move') {
      const { x, y, z, yaw } = msg;
      if (![x, y, z, yaw].every(Number.isFinite)) return;
      player.x = x;
      player.y = y;
      player.z = z;
      player.yaw = yaw;
      broadcast({ type: 'move', id, x, y, z, yaw, moving: !!msg.moving, swimming: !!msg.swimming }, id);
      return;
    }

    if (msg.type === 'blockEdit') {
      const { x, y, z, blockId } = msg;
      if (![x, y, z, blockId].every(Number.isFinite)) return;
      const cx = Math.floor(x / CHUNK_SIZE);
      const cz = Math.floor(z / CHUNK_SIZE);
      const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const index = lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
      const key = `${cx},${cz}`;
      const chunkEdits = world.edits[key] ?? (world.edits[key] = []);
      const existing = chunkEdits.find((e) => e[0] === index);
      if (existing) existing[1] = blockId;
      else chunkEdits.push([index, blockId]);
      scheduleSave();
      broadcast({ type: 'blockEdit', x, y, z, blockId, by: id }, id);
      return;
    }

    if (msg.type === 'lessonClaim') {
      const puzzleId = String(msg.puzzleId || '');
      if (!puzzleId) return;
      const lock = lessons.get(puzzleId);
      if (lock && lock.holder !== id && lock.expiresAt > Date.now()) {
        const holder = players.get(lock.holder);
        ws.send(JSON.stringify({ type: 'lessonDenied', puzzleId, byName: holder ? holder.name : 'Alt jucător' }));
        return;
      }
      lessons.set(puzzleId, { holder: id, expiresAt: Date.now() + LESSON_IDLE_MS });
      ws.send(JSON.stringify({ type: 'lessonGranted', puzzleId }));
      announceLesson(puzzleId);
      return;
    }

    if (msg.type === 'lessonPing') {
      const lock = lessons.get(String(msg.puzzleId || ''));
      if (lock && lock.holder === id) lock.expiresAt = Date.now() + LESSON_IDLE_MS;
      return;
    }

    if (msg.type === 'lessonRelease') {
      const puzzleId = String(msg.puzzleId || '');
      const lock = lessons.get(puzzleId);
      if (lock && lock.holder === id) {
        lessons.delete(puzzleId);
        announceLesson(puzzleId);
      }
    }
  });

  ws.on('close', () => {
    if (id !== null) {
      console.log(`${new Date().toISOString()} leave id=${id} name=${players.get(id)?.name}`);
      players.delete(id);
      releaseLessonsOf(id);
      broadcast({ type: 'leave', id });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`CUBURIA server listening on :${PORT}`);
});
