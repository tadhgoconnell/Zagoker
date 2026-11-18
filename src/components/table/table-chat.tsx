"use client";

import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiCall } from "@/lib/game/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: number;
  user_id: string;
  username: string;
  body: string;
  created_at: string;
};

const HISTORY = 100;

/**
 * Loads recent chat for a table and keeps it live. Lives in the table screen
 * (not the chat panel) so messages keep arriving while the panel is closed.
 */
export function useTableChat(tableId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const add = (incoming: ChatMessage[]) =>
      setMessages((current) => {
        const known = new Set(current.map((m) => m.id));
        const merged = [...current, ...incoming.filter((m) => !known.has(m.id))];
        return merged.sort((a, b) => a.id - b.id).slice(-HISTORY);
      });

    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, user_id, username, body, created_at")
        .eq("table_id", tableId)
        .order("id", { ascending: false })
        .limit(HISTORY);
      if (!cancelled && data) add(data as ChatMessage[]);
    };

    const channel = supabase
      .channel(`chat:${tableId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `table_id=eq.${tableId}` },
        (payload) => add([payload.new as ChatMessage]),
      )
      // Reload once the feed is confirmed active, to cover the gap before it.
      .on("system", {}, (m: { extension?: string; status?: string }) => {
        if (m.extension === "postgres_changes" && m.status === "ok") void load();
      });

    void supabase.realtime.setAuth().then(() => {
      if (!cancelled) channel.subscribe();
    });
    void load();
    // Fallback if the live feed is unavailable.
    const timer = setInterval(() => void load(), 20_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [tableId]);

  return messages;
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

export function TableChat({
  tableId,
  messages,
  myId,
  canPost,
}: {
  tableId: string;
  messages: ChatMessage[];
  myId: string;
  canPost: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const last = messages.at(-1)?.id;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [last]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const res = await apiCall(`/api/tables/${tableId}/chat`, { body: text });
    if (res.ok) setDraft("");
    else setError(res.message);
    setSending(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ol className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4 text-sm" aria-label="Chat messages" aria-live="polite">
        {messages.length === 0 && (
          <li className="text-slate">No messages yet. {canPost ? "Say hello to the table." : ""}</li>
        )}
        {messages.map((m) => (
          <li key={m.id} className="break-words">
            <span className={cn("font-semibold", m.user_id === myId ? "text-accent-300" : "text-cream")}>
              {m.username}
            </span>{" "}
            <time className="text-[10px] text-slate" dateTime={m.created_at}>
              {timeFormat.format(new Date(m.created_at))}
            </time>
            {/* Rendered as plain text: nothing a player types is treated as HTML. */}
            <p className="whitespace-pre-wrap text-mist">{m.body}</p>
          </li>
        ))}
        <div ref={end} />
      </ol>

      {canPost ? (
        <form onSubmit={send} className="border-t border-ink-700 p-3">
          {error && <p className="mb-2 text-xs text-danger" role="alert">{error}</p>}
          <div className="flex gap-2">
            <input
              aria-label="Message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              placeholder="Message the table"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-900 px-4 text-sm text-cream placeholder:text-slate focus:border-accent-400 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={sending || draft.trim().length === 0}
              className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-400 text-ink-950 transition-opacity disabled:opacity-40"
            >
              <SendHorizontal className="size-4" />
            </button>
          </div>
        </form>
      ) : (
        <p className="border-t border-ink-700 p-3 text-center text-xs text-slate">Sit down to join the chat.</p>
      )}
    </div>
  );
}
