"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiCall } from "@/lib/game/client";
import type { TableSnapshot } from "@/lib/game/types";
import type { HandView } from "@/lib/poker";
import { createClient } from "@/lib/supabase/client";

type Status = "loading" | "ready" | "gone";

/** The table_state row as delivered by Supabase Realtime. Public data only. */
type PushedState = {
  hand_number?: number;
  version?: number;
  view?: HandView | null;
  turn_deadline?: string | null;
};

const versionOf = (s: TableSnapshot) => s.hand?.version ?? -1;

/** True if `a` describes an earlier moment of the game than `b`. */
function isOlder(a: TableSnapshot, b: TableSnapshot): boolean {
  if (a.handNumber !== b.handNumber) return a.handNumber < b.handNumber;
  return versionOf(a) < versionOf(b);
}

/**
 * Merges a pushed public view into the current snapshot. The push never
 * contains hole cards, so the player's own cards are carried over from what
 * they already hold for the same hand. Legal actions are left empty until
 * the authoritative snapshot arrives.
 */
function applyPushedState(current: TableSnapshot | null, pushed: PushedState): TableSnapshot | null {
  if (!current || !pushed?.view || typeof pushed.hand_number !== "number") return current;
  const sameHand = pushed.hand_number === current.handNumber;
  if (pushed.hand_number < current.handNumber) return current;
  if (sameHand && pushed.view.version <= versionOf(current)) return current;

  const myCards = sameHand
    ? (current.hand?.players.find((p) => p.seat === current.mySeat)?.holeCards ?? null)
    : null;
  return {
    ...current,
    handNumber: pushed.hand_number,
    turnDeadline: pushed.turn_deadline ?? null,
    hand: {
      ...pushed.view,
      legalActions: null,
      players: pushed.view.players.map((p) =>
        p.seat === current.mySeat && p.holeCards === null && myCards ? { ...p, holeCards: myCards } : p,
      ),
    },
  };
}

/**
 * Keeps a live copy of one table.
 *
 * - Supabase Realtime pushes a notification whenever the table changes.
 * - Each notification triggers a fetch of the authoritative snapshot from our
 *   server, which is where this player's own cards and options come from.
 * - Presence on the same channel tells us who is currently connected.
 * - If the live connection drops, it falls back to polling until it is back,
 *   and always resynchronises on reconnect, tab focus and coming back online.
 */
export function useTable(tableId: string, userId: string) {
  const [snapshot, setSnapshot] = useState<TableSnapshot | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [live, setLive] = useState(false);
  const [online, setOnline] = useState<ReadonlySet<string> | null>(null);
  /** Server clock minus this device's clock, in ms. */
  const [clockOffset, setClockOffset] = useState(0);

  const router = useRouter();
  const requestSeq = useRef(0);
  const appliedSeq = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    const sentAt = Date.now();
    const res = await apiCall<TableSnapshot>(`/api/tables/${tableId}`);
    // Responses can arrive out of order; never let an older one overwrite a newer one.
    if (seq < appliedSeq.current) return;
    if (res.ok) {
      appliedSeq.current = seq;
      const midpoint = (sentAt + Date.now()) / 2;
      setClockOffset(Date.parse(res.data.serverNow) - midpoint);
      setSnapshot((current) => (current && isOlder(res.data, current) ? current : res.data));
      setStatus("ready");
    } else if (res.status === 404) {
      appliedSeq.current = seq;
      setStatus("gone");
    } else if (res.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(`/table/${tableId}`)}`);
    }
    // Other failures (offline, server error): keep what we have and retry on the next tick.
  }, [tableId, router]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`table:${tableId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_state", filter: `table_id=eq.${tableId}` },
        (payload) => {
          // Show the pushed public state at once, then fetch the full snapshot
          // (which adds this player's own options) in the background.
          setSnapshot((current) => applyPushedState(current, payload.new as PushedState));
          void refresh();
        },
      )
      // The change feed becomes active a moment after the channel joins.
      // Anything that changed in that gap would be missed, so resynchronise
      // as soon as the server confirms the feed is running.
      .on("system", {}, (message: { extension?: string; status?: string }) => {
        if (message.extension === "postgres_changes" && message.status === "ok") void refresh();
      })
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())));
      });

    // Attach the player's login token before subscribing. Without it the
    // connection is anonymous and Supabase refuses the table's change feed.
    let cancelled = false;
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel.subscribe((state) => {
        const subscribed = state === "SUBSCRIBED";
        setLive(subscribed);
        if (subscribed) {
          void channel.track({ online_at: new Date().toISOString() });
          void refresh(); // catch up on anything missed while disconnected
        }
      });
    });

    const resync = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("online", resync);
    // First load, without waiting for the live connection to come up.
    const first = setTimeout(() => void refresh(), 0);

    return () => {
      cancelled = true;
      clearTimeout(first);
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("online", resync);
      void supabase.removeChannel(channel);
    };
  }, [tableId, userId, refresh]);

  // Safety net: slow heartbeat while live, fast polling while the live link is down.
  useEffect(() => {
    const timer = setInterval(() => void refresh(), live ? 15_000 : 2_500);
    return () => clearInterval(timer);
  }, [live, refresh]);

  return { snapshot, status, live, online, clockOffset, refresh };
}
