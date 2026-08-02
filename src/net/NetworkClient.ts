import { CONNECT_TIMEOUT_MS } from '../config';
import type { EditsData } from '../world/World';

export interface PlayerColor {
  hue: number;
  accessory: number;
}

export interface RemotePlayerState {
  id: string;
  name: string;
  color: PlayerColor;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface InitPayload {
  selfId: string;
  epoch: number;
  edits: EditsData;
  players: RemotePlayerState[];
}

export interface MoveEvent {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  moving: boolean;
  swimming: boolean;
}

export interface BlockEditEvent {
  x: number;
  y: number;
  z: number;
  blockId: number;
  by: string;
}

interface Handlers {
  join: (p: RemotePlayerState) => void;
  leave: (id: string) => void;
  move: (e: MoveEvent) => void;
  blockEdit: (e: BlockEditEvent) => void;
}

export interface LessonClaim {
  ok: boolean;
  byName?: string;
}

// How long to wait for the server's verdict on a lesson before opening it
// anyway — a laggy link (or an older server that doesn't know about locks)
// shouldn't leave a child staring at nothing when they click a lesson.
const CLAIM_TIMEOUT_MS = 1500;

// Thin wrapper around a WebSocket connection to the CUBURIA server. connect()
// resolves with the server's init payload on success, or null if the server
// is unreachable within the timeout — callers should fall back to solo play.
export class NetworkClient {
  connected = false;
  private ws: WebSocket | null = null;
  private handlers: Partial<Handlers> = {};
  private disconnectHandler: (() => void) | null = null;
  private claims = new Map<string, (r: LessonClaim) => void>();

  connect(url: string, name: string): Promise<InitPayload | null> {
    return new Promise((resolve) => {
      let settled = false;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        resolve(null);
        return;
      }
      this.ws = ws;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.close();
          resolve(null);
        }
      }, CONNECT_TIMEOUT_MS);

      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'join', name }));
      });

      ws.addEventListener('message', (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        if (msg.type === 'init') {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            this.connected = true;
            resolve(msg as unknown as InitPayload);
          }
          return;
        }
        if (msg.type === 'lessonGranted' || msg.type === 'lessonDenied') {
          const pending = this.claims.get(msg.puzzleId as string);
          if (pending) {
            this.claims.delete(msg.puzzleId as string);
            pending({ ok: msg.type === 'lessonGranted', byName: msg.byName as string | undefined });
          }
          return;
        }
        if (msg.type === 'join') this.handlers.join?.(msg as unknown as RemotePlayerState);
        else if (msg.type === 'leave') this.handlers.leave?.(msg.id as string);
        else if (msg.type === 'move') this.handlers.move?.(msg as unknown as MoveEvent);
        else if (msg.type === 'blockEdit') this.handlers.blockEdit?.(msg as unknown as BlockEditEvent);
      });

      ws.addEventListener('close', () => {
        const wasConnected = this.connected;
        this.connected = false;
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        } else if (wasConnected) {
          this.disconnectHandler?.();
        }
      });
    });
  }

  on<K extends keyof Handlers>(type: K, fn: Handlers[K]): void {
    this.handlers[type] = fn;
  }

  onDisconnect(fn: () => void): void {
    this.disconnectHandler = fn;
  }

  sendMove(x: number, y: number, z: number, yaw: number, moving: boolean, swimming: boolean): void {
    if (!this.connected || !this.ws) return;
    this.ws.send(JSON.stringify({ type: 'move', x, y, z, yaw, moving, swimming }));
  }

  sendBlockEdit(x: number, y: number, z: number, blockId: number): void {
    if (!this.connected || !this.ws) return;
    this.ws.send(JSON.stringify({ type: 'blockEdit', x, y, z, blockId }));
  }

  // Asks the server for exclusive use of a lesson. Resolves ok:false with the
  // holder's name when somebody else is already at that tabla.
  claimLesson(puzzleId: string): Promise<LessonClaim> {
    if (!this.connected || !this.ws) return Promise.resolve({ ok: true });
    return new Promise((resolve) => {
      let settled = false;
      const finish = (r: LessonClaim) => {
        if (settled) return;
        settled = true;
        this.claims.delete(puzzleId);
        resolve(r);
      };
      this.claims.set(puzzleId, finish);
      this.ws!.send(JSON.stringify({ type: 'lessonClaim', puzzleId }));
      setTimeout(() => finish({ ok: true }), CLAIM_TIMEOUT_MS);
    });
  }

  // Keeps a held lesson from expiring while it's genuinely being worked on
  pingLesson(puzzleId: string): void {
    if (!this.connected || !this.ws) return;
    this.ws.send(JSON.stringify({ type: 'lessonPing', puzzleId }));
  }

  releaseLesson(puzzleId: string): void {
    if (!this.connected || !this.ws) return;
    this.ws.send(JSON.stringify({ type: 'lessonRelease', puzzleId }));
  }
}

export function resolveServerUrl(defaultUrl: string): string {
  const override = new URLSearchParams(window.location.search).get('server');
  return override || defaultUrl;
}
