import type { Server as HttpServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import {
  chatWsClientFrameSchema,
  type ChatMessage,
  type ChatSenderRole,
} from "@odj/shared";
import { auth } from "../auth";
import { db } from "../db";
import { jobs, workerProfiles, hirerProfiles, chatMessages } from "../db/schema";
import { pushUser } from "./notifications";
import * as chatHub from "./chat-hub";

/**
 * Resolve the caller's role for a job (job-history-based, like ratings'
 * `resolveRatingParty` — works regardless of current profile approval status)
 * plus the other party's user id (for the "new message" push). Null if the
 * caller wasn't a party to this job.
 */
export async function resolveChatParty(
  job: typeof jobs.$inferSelect,
  userId: string,
): Promise<{ role: ChatSenderRole; otherUserId: string } | null> {
  const [worker] = await db
    .select({ id: workerProfiles.id })
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, userId))
    .limit(1);
  if (worker && job.matchedWorkerProfileId === worker.id) {
    const [hirer] = await db
      .select({ userId: hirerProfiles.userId })
      .from(hirerProfiles)
      .where(eq(hirerProfiles.id, job.hirerProfileId))
      .limit(1);
    return hirer ? { role: "worker", otherUserId: hirer.userId } : null;
  }
  const [hirer] = await db
    .select({ id: hirerProfiles.id })
    .from(hirerProfiles)
    .where(eq(hirerProfiles.userId, userId))
    .limit(1);
  if (hirer && job.hirerProfileId === hirer.id && job.matchedWorkerProfileId) {
    const [w] = await db
      .select({ userId: workerProfiles.userId })
      .from(workerProfiles)
      .where(eq(workerProfiles.id, job.matchedWorkerProfileId))
      .limit(1);
    return w ? { role: "hirer", otherUserId: w.userId } : null;
  }
  return null;
}

export const CHAT_ACTIVE_STATUSES = new Set(["matched", "in_progress"]);

interface ConnState {
  isAlive: boolean;
  userId: string;
  joined?: { jobId: string; role: ChatSenderRole; otherUserId: string };
}

/** Attach the `/ws/chat` WebSocket server to the running HTTP server. */
export function attachChatServer(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });
  const state = new Map<WebSocket, ConnState>();

  httpServer.on("upgrade", (req, socket, head) => {
    void (async () => {
      const { pathname } = new URL(req.url ?? "", "http://internal");
      if (pathname !== "/ws/chat") {
        socket.destroy();
        return;
      }

      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user || session.user.adminRole) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, session.user.id);
      });
    })();
  });

  wss.on("connection", (ws: WebSocket, userId: string) => {
    state.set(ws, { isAlive: true, userId });

    ws.on("pong", () => {
      const s = state.get(ws);
      if (s) s.isAlive = true;
    });

    ws.on("message", (raw) => {
      void handleMessage(ws, userId, raw.toString());
    });

    ws.on("close", () => {
      const s = state.get(ws);
      if (s?.joined) {
        const { jobId } = s.joined;
        chatHub.leave(jobId, ws);
        // Only announce "offline" once this user's last socket in the room drops
        // (they may have more than one device connected).
        if (!chatHub.isUserConnected(jobId, s.userId)) {
          chatHub.broadcast(jobId, { type: "presence", online: false });
        }
      }
      state.delete(ws);
    });
  });

  // Prune dead connections (missed two ping cycles) every 30s.
  const heartbeat = setInterval(() => {
    for (const [ws, s] of state) {
      if (!s.isAlive) {
        ws.terminate();
        continue;
      }
      s.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  httpServer.on("close", () => clearInterval(heartbeat));

  async function handleMessage(ws: WebSocket, userId: string, raw: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid frame" }));
      return;
    }
    const frame = chatWsClientFrameSchema.safeParse(parsed);
    if (!frame.success) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid frame" }));
      return;
    }

    if (frame.data.type === "join") {
      const [job] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, frame.data.jobId))
        .limit(1);
      if (!job) {
        ws.send(JSON.stringify({ type: "error", message: "Job not found" }));
        return;
      }
      const party = await resolveChatParty(job, userId);
      if (!party) {
        ws.send(JSON.stringify({ type: "error", message: "Job not found" }));
        return;
      }
      const s = state.get(ws);
      if (!s) return;
      s.joined = { jobId: job.id, role: party.role, otherUserId: party.otherUserId };
      const otherOnline = chatHub.isUserConnected(job.id, party.otherUserId);
      chatHub.join(job.id, ws, userId);
      ws.send(
        JSON.stringify({
          type: "joined",
          canSend: CHAT_ACTIVE_STATUSES.has(job.status),
          otherOnline,
        }),
      );
      chatHub.broadcast(job.id, { type: "presence", online: true }, ws);
      return;
    }

    if (frame.data.type === "typing") {
      const s = state.get(ws);
      if (!s?.joined) return;
      chatHub.broadcast(s.joined.jobId, { type: "typing" }, ws);
      return;
    }

    // frame.data.type === "send"
    const s = state.get(ws);
    if (!s?.joined) {
      ws.send(JSON.stringify({ type: "error", message: "Join a job's chat first" }));
      return;
    }
    const { jobId, role, otherUserId } = s.joined;

    // Re-check live status — never trust the joined-time snapshot.
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job || !CHAT_ACTIVE_STATUSES.has(job.status)) {
      ws.send(JSON.stringify({ type: "error", message: "This job has ended" }));
      return;
    }

    const input = frame.data.message;
    const [row] = await db
      .insert(chatMessages)
      .values({
        jobId,
        senderRole: role,
        type: input.type,
        body: input.type === "text" ? input.body : null,
        lat: input.type === "location" ? input.lat : null,
        lng: input.type === "location" ? input.lng : null,
      })
      .returning();
    if (!row) return;

    const message: ChatMessage = {
      id: row.id,
      senderRole: row.senderRole,
      type: row.type,
      body: row.body,
      lat: row.lat,
      lng: row.lng,
      createdAt: row.createdAt,
    };
    chatHub.broadcast(jobId, { type: "message", message });

    if (!chatHub.isUserConnected(jobId, otherUserId)) {
      await pushUser(otherUserId, {
        type: "chat_message",
        title: role === "worker" ? "New message from your worker" : "New message from your hirer",
        body: input.type === "text" ? input.body : "Shared their location",
        data: { jobId },
      });
    }
  }
}
