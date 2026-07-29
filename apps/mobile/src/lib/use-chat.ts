import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatMessage, JobChatView } from "@odj/shared";
import { API_URL } from "./api";
import { authClient } from "./auth-client";
import { appApi, CHAT_KEY } from "./app-api";

// Capped exponential backoff for reconnect attempts.
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

// React Native's WebSocket extends the standard constructor with a third
// `options.headers` argument (not in the DOM lib types) — used here to carry
// the session cookie on the handshake, same auth as `authedFetch`.
type RNWebSocketCtor = new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> },
) => WebSocket;

// Clear the "typing…" indicator if no further typing frame arrives within this window.
const TYPING_TIMEOUT_MS = 3000;
// Don't send a new "typing" frame more often than this while the user keeps typing.
const TYPING_THROTTLE_MS = 2000;

interface ChatWsMessage {
  type: "joined" | "message" | "error" | "ended" | "presence" | "typing";
  canSend?: boolean;
  message?: ChatMessage;
  otherOnline?: boolean;
  online?: boolean;
}

/**
 * Live chat for one job over `/ws/chat`. History + the read-only fallback
 * come from `appApi.chatHistory` (TanStack Query, cache key `CHAT_KEY`);
 * this hook layers a WebSocket on top that pushes incoming messages straight
 * into that cache and reconnects (with backfill) on drop. Connects on mount,
 * closes on unmount — no global always-on socket.
 */
export function useChat(jobId: string | null) {
  const qc = useQueryClient();
  const [canSend, setCanSend] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [otherOnline, setOtherOnline] = React.useState(false);
  const [otherTyping, setOtherTyping] = React.useState(false);
  const wsRef = React.useRef<WebSocket | null>(null);
  const attemptRef = React.useRef(0);
  const reconnectTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = React.useRef(false);
  const typingClearTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAt = React.useRef(0);

  const { data, isLoading } = useQuery({
    queryKey: jobId ? CHAT_KEY(jobId) : ["chat", "none"],
    queryFn: () => appApi.chatHistory(jobId!),
    enabled: !!jobId,
  });

  React.useEffect(() => {
    if (data) setCanSend(data.canSend);
  }, [data]);

  React.useEffect(() => {
    if (!jobId) return;
    const jid = jobId; // narrow once — captured by the closures below
    closingRef.current = false;

    function connect() {
      const cookie = authClient.getCookie();
      const wsUrl = `${API_URL.replace(/^http/, "ws")}/ws/chat`;
      const ws = new (WebSocket as unknown as RNWebSocketCtor)(wsUrl, undefined, {
        headers: cookie ? { Cookie: cookie } : undefined,
      });
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", jobId: jid }));
      };

      ws.onmessage = (event) => {
        let frame: ChatWsMessage;
        try {
          frame = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (frame.type === "joined") {
          attemptRef.current = 0;
          setConnected(true);
          setCanSend(frame.canSend ?? false);
          setOtherOnline(frame.otherOnline ?? false);
          // Backfill anything sent while we were disconnected.
          void qc.invalidateQueries({ queryKey: CHAT_KEY(jid) });
        } else if (frame.type === "message" && frame.message) {
          const incoming = frame.message;
          qc.setQueryData<JobChatView>(CHAT_KEY(jid), (old) =>
            old ? { ...old, messages: [...old.messages, incoming] } : old,
          );
          setOtherTyping(false);
          if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
        } else if (frame.type === "ended") {
          setCanSend(false);
        } else if (frame.type === "presence") {
          setOtherOnline(frame.online ?? false);
        } else if (frame.type === "typing") {
          setOtherTyping(true);
          if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
          typingClearTimer.current = setTimeout(
            () => setOtherTyping(false),
            TYPING_TIMEOUT_MS,
          );
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Our own connection dropped — we can't know the other party's state
        // until the next "joined" response refreshes it.
        setOtherOnline(false);
        setOtherTyping(false);
        if (closingRef.current) return;
        const delay =
          RECONNECT_DELAYS_MS[Math.min(attemptRef.current, RECONNECT_DELAYS_MS.length - 1)];
        attemptRef.current += 1;
        reconnectTimer.current = setTimeout(() => {
          if (!closingRef.current) connect();
        }, delay);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      closingRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
      wsRef.current?.close();
    };
  }, [jobId, qc]);

  const sendText = React.useCallback((body: string) => {
    wsRef.current?.send(JSON.stringify({ type: "send", message: { type: "text", body } }));
  }, []);

  const sendLocation = React.useCallback((lat: number, lng: number) => {
    wsRef.current?.send(
      JSON.stringify({ type: "send", message: { type: "location", lat, lng } }),
    );
  }, []);

  /** Call on composer input change — throttled so it doesn't fire every keystroke. */
  const notifyTyping = React.useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentAt.current < TYPING_THROTTLE_MS) return;
    lastTypingSentAt.current = now;
    wsRef.current?.send(JSON.stringify({ type: "typing" }));
  }, []);

  return {
    messages: data?.messages ?? [],
    isLoading,
    canSend,
    connected,
    otherOnline,
    otherTyping,
    sendText,
    sendLocation,
    notifyTyping,
  };
}
