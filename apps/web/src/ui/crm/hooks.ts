"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CRM_DOMAIN_EVENT_TYPES } from "@saas-frota/shared";
import { apiGet, apiSend } from "../api";
import type { CrmSseEvent } from "./types";

const POLL_MS = 15_000;

function parseSseData(raw: string): CrmSseEvent | null {
  try {
    const data = JSON.parse(raw) as CrmSseEvent | { tenant_id?: string };
    if (data && typeof data === "object" && "type" in data && "id" in data) {
      return data as CrmSseEvent;
    }
    return null;
  } catch {
    return null;
  }
}

/** SSE with 15s poll fallback per jobs-realtime.md. */
export function useCrmRealtime(opts: {
  enabled: boolean;
  onEvent?: (ev: CrmSseEvent) => void;
  onPoll?: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"sse" | "poll">("sse");
  const onEventRef = useRef(opts.onEvent);
  const onPollRef = useRef(opts.onPoll);
  onEventRef.current = opts.onEvent;
  onPollRef.current = opts.onPoll;

  useEffect(() => {
    if (!opts.enabled) return;

    let closed = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let lastId: string | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const startPoll = () => {
      setMode("poll");
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        void onPollRef.current?.();
      }, POLL_MS);
      void onPollRef.current?.();
    };

    const handlePayload = (raw: string) => {
      const data = parseSseData(raw);
      if (!data) return;
      if (data.id) lastId = data.id;
      onEventRef.current?.(data);
    };

    const connect = () => {
      if (closed) return;
      try {
        const url = lastId
          ? `/api/saas/crm/events/stream?last_event_id=${encodeURIComponent(lastId)}`
          : "/api/saas/crm/events/stream";
        es = new EventSource(url, { withCredentials: true });
        es.onopen = () => setMode("sse");

        // Named CRM events (server uses `event: <type>`).
        for (const type of CRM_DOMAIN_EVENT_TYPES) {
          es.addEventListener(type, (msg) => {
            handlePayload((msg as MessageEvent).data);
          });
        }
        es.addEventListener("ready", () => setMode("sse"));
        // Fallback if any event is emitted as default `message`.
        es.onmessage = (msg) => handlePayload(msg.data);

        es.onerror = () => {
          es?.close();
          es = null;
          startPoll();
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, POLL_MS);
        };
      } catch {
        startPoll();
      }
    };

    connect();

    return () => {
      closed = true;
      es?.close();
      if (pollTimer) clearInterval(pollTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [opts.enabled]);

  return { mode, pollCaption: mode === "poll" };
}

export function usePresenceHeartbeat(conversationId: string | null | undefined) {
  useEffect(() => {
    if (!conversationId) return;
    let alive = true;

    const beat = () => {
      if (!alive) return;
      void apiSend("/api/saas/crm/presence", "POST", {
        conversation_id: conversationId,
        state: "viewing",
      }).catch(() => undefined);
    };

    beat();
    const t = setInterval(beat, 20_000);
    const onBlur = () => {
      void apiSend("/api/saas/crm/presence", "POST", {
        conversation_id: conversationId,
        state: "online",
      }).catch(() => undefined);
    };
    window.addEventListener("blur", onBlur);

    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("blur", onBlur);
      void apiSend("/api/saas/crm/presence", "POST", {
        conversation_id: conversationId,
        state: "online",
      }).catch(() => undefined);
    };
  }, [conversationId]);
}

export function useAgentAvailability() {
  const [availability, setAvailability] = useState<"online" | "busy" | "offline">("online");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void apiGet<{ availability?: string }>("/api/saas/crm/perfil")
      .then((p) => {
        const a = p.availability;
        if (a === "online" || a === "busy" || a === "offline") setAvailability(a);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback(async (next: "online" | "busy" | "offline") => {
    setAvailability(next);
    try {
      await apiSend("/api/saas/crm/perfil", "PATCH", { availability: next });
      await apiSend("/api/saas/crm/presence", "POST", { state: next });
    } catch {
      /* keep optimistic */
    }
  }, []);

  return { availability, setAvailability: update, loaded };
}
