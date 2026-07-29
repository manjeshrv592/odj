import type { WebSocket } from "ws";

/**
 * In-memory chat room registry — one room per job, holding every socket
 * currently `join`ed to it (a user may have more than one device connected).
 * Single-process only: correct at the current one-instance deployment; would
 * need a shared pub/sub (e.g. Redis) if the backend is ever horizontally
 * scaled, since a message would only reach sockets on the same process.
 */

interface RoomMember {
  ws: WebSocket;
  userId: string;
}

const rooms = new Map<string, Set<RoomMember>>();

export function join(jobId: string, ws: WebSocket, userId: string): void {
  let members = rooms.get(jobId);
  if (!members) {
    members = new Set();
    rooms.set(jobId, members);
  }
  members.add({ ws, userId });
}

export function leave(jobId: string, ws: WebSocket): void {
  const members = rooms.get(jobId);
  if (!members) return;
  for (const m of members) {
    if (m.ws === ws) members.delete(m);
  }
  if (members.size === 0) rooms.delete(jobId);
}

/**
 * Broadcast a JSON-serializable frame to every socket currently in the room.
 * `exclude` (typically the sender) skips one socket — used for presence/typing
 * frames, which are inherently "about the other party" from any recipient's
 * point of view, so the sender never needs to see its own echo.
 */
export function broadcast(jobId: string, frame: unknown, exclude?: WebSocket): void {
  const members = rooms.get(jobId);
  if (!members) return;
  const payload = JSON.stringify(frame);
  for (const { ws } of members) {
    if (ws === exclude) continue;
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

/** True if the given user has at least one socket currently joined to this room. */
export function isUserConnected(jobId: string, userId: string): boolean {
  const members = rooms.get(jobId);
  if (!members) return false;
  for (const m of members) {
    if (m.userId === userId) return true;
  }
  return false;
}

/**
 * Tell everyone still connected to a job's chat that it just ended. This is
 * a live nudge only — `send` frames are always re-validated against the
 * job's current DB status (see `chat-ws.ts`), so a client that never sees
 * this broadcast (e.g. reconnecting at the same moment) can't slip a message
 * through on a stale `canSend`.
 */
export function endRoom(jobId: string): void {
  broadcast(jobId, { type: "ended" });
}
