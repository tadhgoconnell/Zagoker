"use client";

import { ArrowRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CreateTableForm } from "@/components/lobby/create-table-form";
import { HostedTables } from "@/components/lobby/hosted-tables";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { apiCall } from "@/lib/game/client";
import type { HostedTable, LobbyTable } from "@/lib/game/types";
import { createClient } from "@/lib/supabase/client";
import { formatChips } from "@/lib/utils";

type Lobby = { tables: LobbyTable[]; myTableId: string | null; hostedTables?: HostedTable[] };

export function LobbyClient({ chips }: { chips: number }) {
  const router = useRouter();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");

  const refresh = useCallback(async () => {
    const res = await apiCall<Lobby>("/api/tables");
    if (res.ok) setLobby(res.data);
    setFailed(!res.ok);
  }, []);

  // Live: any change at a visible table refreshes the list. Polling is the fallback.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    const channel = supabase
      .channel("lobby")
      .on("postgres_changes", { event: "*", schema: "public", table: "table_state" }, () => void refresh())
      .on("system", {}, (message: { extension?: string; status?: string }) => {
        if (message.extension === "postgres_changes" && message.status === "ok") void refresh();
      });
    // Attach the login token first, so the feed is filtered by what this player may see.
    void supabase.realtime.setAuth().then(() => {
      if (!cancelled) channel.subscribe();
    });
    const timer = setInterval(() => void refresh(), 10_000);
    const first = setTimeout(() => void refresh(), 0);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const joinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean) router.push(`/join/${encodeURIComponent(clean)}`);
  };

  return (
    <div className="space-y-6">
      {lobby?.myTableId && (
        <Panel className="flex flex-col items-start gap-3 border-accent-500/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-semibold text-accent-300">You have a seat at a table.</span>{" "}
            <span className="text-mist">Your chips are waiting there.</span>
          </p>
          <ButtonLink href={`/table/${lobby.myTableId}`} size="sm">
            Return to your table <ArrowRight className="size-4" />
          </ButtonLink>
        </Panel>
      )}

      <HostedTables tables={lobby?.hostedTables ?? []} onChange={() => void refresh()} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="public-tables">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="public-tables" className="scroll-mt-24 text-lg font-semibold">Public tables</h2>
            {!creating && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Create table
              </Button>
            )}
          </div>

          {creating ? (
            <Panel className="p-6 sm:p-8">
              <h3 className="mb-5 font-display text-2xl font-extrabold tracking-tight">Create a table</h3>
              <CreateTableForm chips={chips} onCancel={() => setCreating(false)} />
            </Panel>
          ) : lobby === null ? (
            failed ? (
              <Panel className="p-8 text-center text-sm text-mist">
                The table list could not be loaded. Retrying…
              </Panel>
            ) : (
              <div className="space-y-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-ink-800" />
                ))}
              </div>
            )
          ) : lobby.tables.length === 0 ? (
            <Panel className="p-10 text-center">
              <p className="font-semibold">No public tables are open right now</p>
              <p className="mt-2 text-sm text-mist">Create one and it will appear here for everyone.</p>
            </Panel>
          ) : (
            <ul className="space-y-3">
              {lobby.tables.map((t) => {
                const full = t.seated >= t.max_players;
                return (
                  <li key={t.id}>
                    <Panel className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4 sm:p-5">
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="truncate font-semibold">{t.name}</p>
                        <p className="mt-0.5 text-sm text-mist">
                          Blinds {formatChips(t.small_blind)}/{formatChips(t.big_blind)} · Buy-in{" "}
                          {formatChips(t.buy_in)}
                        </p>
                      </div>
                      <Badge tone={!full && t.seated > 0 ? "accent" : "neutral"}>
                                                {t.seated}/{t.max_players}
                      </Badge>
                      <ButtonLink href={`/table/${t.id}`} size="sm" variant={full ? "secondary" : "primary"}>
                        {full ? "Watch" : "Join"}
                      </ButtonLink>
                    </Panel>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-6">
          <Panel className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Play alone</h2>
            <p className="mt-1 text-sm text-mist">
              Practise against 1 to 8 bots, each with their own style, at a difficulty from 0 to 10.
            </p>
            <ButtonLink href="/practice" variant="secondary" className="mt-4 w-full">
              Play against bots
            </ButtonLink>
          </Panel>
          <Panel className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              Join a private table
            </h2>
            <p className="mt-1 text-sm text-mist">Enter the 8-character room code your host sent you.</p>
            <form onSubmit={joinByCode} className="mt-4 space-y-3">
              <input
                aria-label="Room code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={12}
                placeholder="ABCD2345"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="h-12 w-full rounded-xl border border-ink-600 bg-ink-900/70 px-4 text-center font-mono text-lg tracking-[0.3em] text-cream uppercase placeholder:text-slate/60 focus:border-accent-400 focus:outline-none"
              />
              <Button type="submit" variant="secondary" className="w-full" disabled={code.trim().length < 8}>
                Find table
              </Button>
            </form>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
