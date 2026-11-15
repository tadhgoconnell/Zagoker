"use client";

import { Check, Copy, DoorOpen, Link2, Lock, MessageSquare, Wifi, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/site";
import { apiCall } from "@/lib/game/client";
import { PAUSE_AFTER_FOLD_MS, PAUSE_AFTER_SHOWDOWN_MS } from "@/lib/game/timing";
import type { PlayerAction } from "@/lib/poker";
import { cn, formatChips } from "@/lib/utils";
import { ActionBar } from "./action-bar";
import { HandLog } from "./hand-log";
import { PokerTable } from "./poker-table";
import { TableChat, useTableChat } from "./table-chat";
import { useTable } from "./use-table";

export function TableClient({ tableId, userId }: { tableId: string; userId: string }) {
  const router = useRouter();
  const { snapshot, status, live, online, clockOffset, refresh } = useTable(tableId, userId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "history">("chat");
  const chat = useTableChat(tableId);
  /** Id of the newest chat message the player has had on screen. */
  const [seenChatId, setSeenChatId] = useState(0);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  /** Bumped to retry the automatic deal when the server says "too soon". */
  const [dealRetry, setDealRetry] = useState(0);

  const latestChatId = chat.at(-1)?.id ?? 0;
  // The dot only matters on small screens, where the panel is closed by default.
  const unread = !panelOpen && latestChatId > seenChatId && chat.at(-1)?.user_id !== userId;

  const url = `/api/tables/${tableId}`;

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  /** Runs one API call, shows any error, and resynchronises. */
  const run = useCallback(
    async (path: string, body: unknown = {}, quietCodes: string[] = []) => {
      setBusy(true);
      const res = await apiCall<Record<string, unknown>>(`${url}${path}`, body);
      if (!res.ok && !quietCodes.includes(res.code)) setNotice(res.message);
      // Sitting down or leaving changes the chip balance shown in the header.
      if (res.ok && ["/join", "/leave", "/close"].includes(path)) router.refresh();
      await refresh();
      setBusy(false);
      return res;
    },
    [url, refresh, router],
  );

  const table = snapshot?.table;
  const hand = snapshot?.hand ?? null;
  const mySeat = snapshot?.mySeat ?? null;
  const me = snapshot?.seats.find((s) => s.seat_no === mySeat) ?? null;
  const handRunning = !!hand && !hand.result;
  const ready = snapshot?.seats.filter((s) => s.status === "active" && s.stack > 0).length ?? 0;
  const isHost = table?.owner_id === userId;
  const gameStarted = (snapshot?.handNumber ?? 0) > 0;

  // --- Turn timer: when the deadline passes, ask the server to enforce it. ---
  const turnKey = handRunning ? `${snapshot!.handNumber}:${hand!.version}` : null;
  const deadline =
    handRunning && snapshot!.turnDeadline ? Date.parse(snapshot!.turnDeadline) - clockOffset : null;
  useEffect(() => {
    if (turnKey === null || deadline === null) return;
    const version = Number(turnKey.split(":")[1]);
    // A little after the deadline, staggered so browsers do not all call at once.
    const wait = Math.max(0, deadline - Date.now()) + 600 + Math.random() * 1500;
    const t = setTimeout(async () => {
      await apiCall(`${url}/timeout`, { version });
      void refresh();
    }, wait);
    return () => clearTimeout(t);
  }, [turnKey, deadline, url, refresh]);

  // --- Automatic dealing: once the game is going, the next hand starts by itself. ---
  const autoDeal =
    !!table &&
    me?.status === "active" &&
    !handRunning &&
    ready >= 2 &&
    (gameStarted || !table.is_private);
  const lastEnding = hand?.result?.endedBy ?? null;
  useEffect(() => {
    if (!autoDeal) return;
    const pause =
      lastEnding === "showdown" ? PAUSE_AFTER_SHOWDOWN_MS : lastEnding === "fold" ? PAUSE_AFTER_FOLD_MS + 500 : 2500;
    const t = setTimeout(async () => {
      const res = await apiCall(`${url}/start`, {});
      if (!res.ok && res.code === "too_soon") setTimeout(() => setDealRetry((n) => n + 1), 1200);
      void refresh();
    }, pause + Math.random() * 700);
    return () => clearTimeout(t);
  }, [autoDeal, lastEnding, snapshot?.handNumber, dealRetry, url, refresh]);

  if (status === "gone") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-3xl font-bold">This table is not available</h1>
        <p className="max-w-sm text-mist">
          It may have been closed, or it is a private table you have not joined. Private tables need the
          host&apos;s invitation link or room code.
        </p>
        <ButtonLink href={routes.lobby}>Back to the lobby</ButtonLink>
      </div>
    );
  }
  if (!snapshot || !table) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-busy="true">
        <div className="size-10 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
      </div>
    );
  }

  const nameOf = (seat: number) =>
    snapshot.seats.find((s) => s.seat_no === seat)?.profiles?.username ?? "Player";
  const inviteLink = `${window.location.origin}/join/${table.room_code}`;

  const copy = async (what: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(what === "code" ? table.room_code : inviteLink);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setNotice(`Copy this ${what === "code" ? "code" : "link"}: ${what === "code" ? table.room_code : inviteLink}`);
    }
  };

  const act = (action: PlayerAction) =>
    hand && run("/action", { version: hand.version, action }, ["stale"]);

  const leave = async () => {
    const inHand = handRunning && hand!.players.some((p) => p.seat === mySeat && !p.folded);
    if (inHand && !window.confirm("Leave the table? You will fold this hand.")) return;
    const res = await run("/leave");
    if (res.ok && res.data.result === "left") router.push(routes.lobby);
    else if (res.ok) setNotice("You will leave the table when this hand ends.");
  };

  const closeTable = async () => {
    if (!window.confirm("Close this table for everyone? All players are cashed out.")) return;
    const res = await run("/close");
    if (res.ok) router.push(routes.lobby);
  };

  // What to show in the middle of the felt between hands.
  const centerMessage = (
    <div className="flex flex-col items-center gap-3">
      <p className="font-display text-lg font-bold text-cream sm:text-2xl">
        {ready < 2 ? "Waiting for players" : gameStarted || !table.is_private ? "Dealing…" : "Ready to play"}
      </p>
      <p className="text-xs text-cream/70 sm:text-sm">
        {snapshot.seats.length} of {table.max_players} seats taken
        {ready < 2 && " · two players are needed"}
      </p>
      {!gameStarted && table.is_private && ready >= 2 && (
        isHost ? (
          <Button disabled={busy || me?.status !== "active"} onClick={() => run("/start")}>
            Start game
          </Button>
        ) : (
          <p className="text-xs text-gold-200">Waiting for the host to start the game</p>
        )
      )}
    </div>
  );

  // What to show in the control area at the bottom.
  let controls: React.ReactNode;
  if (mySeat === null) {
    controls = (
      <p className="text-center text-sm text-mist">
        You are watching. Tap an empty seat to sit down with {formatChips(table.buy_in)} chips.
      </p>
    );
  } else if (me?.status === "sitting_out") {
    controls = (
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
        <p className="text-sm text-mist">You ran out of time and are sitting out.</p>
        <Button disabled={busy} onClick={() => run("/sit-in")}>
          I&apos;m back
        </Button>
      </div>
    );
  } else if (me?.status === "leaving") {
    controls = <p className="text-center text-sm text-mist">You will leave the table when this hand ends.</p>;
  } else if (handRunning && hand!.legalActions) {
    controls = (
      <ActionBar
        key={`${snapshot.handNumber}:${hand!.version}`}
        hand={hand!}
        mySeat={mySeat}
        disabled={busy}
        onAction={act}
      />
    );
  } else if (handRunning && hand!.toActSeat !== null) {
    const mine = hand!.players.find((p) => p.seat === mySeat);
    controls = (
      <p className="text-center text-sm text-mist">
        {!mine
          ? "You will be dealt in next hand."
          : mine.folded
            ? "You folded. Waiting for the hand to finish."
            : `Waiting for ${nameOf(hand!.toActSeat!)}…`}
      </p>
    );
  } else {
    controls = (
      <p className="text-center text-sm text-mist">
        {ready < 2
          ? "Waiting for another player to sit down."
          : gameStarted || !table.is_private
            ? "Next hand starting…"
            : isHost
              ? "Press Start game when everyone is seated."
              : "Waiting for the host to start the game."}
      </p>
    );
  }

  return (
    <div
      className="flex h-[calc(100dvh-4rem)] min-h-[34rem] flex-col"
      data-table={table.id}
      data-hand-number={snapshot.handNumber}
      data-hand-version={hand?.version ?? -1}
    >
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-white/6 bg-ink-900/60 px-3 py-2 sm:gap-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 truncate text-sm font-semibold sm:text-base">
            {table.is_private && <Lock className="size-3.5 shrink-0 text-gold-400" aria-label="Private table" />}
            <span className="truncate">{table.name}</span>
          </h1>
          <p className="truncate text-xs text-mist">
            Blinds {formatChips(table.small_blind)}/{formatChips(table.big_blind)}
            {snapshot.handNumber > 0 && ` · Hand #${snapshot.handNumber}`}
          </p>
        </div>

        <span
          title={live ? "Live connection" : "Reconnecting…"}
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium",
            live ? "text-success" : "bg-danger/15 text-danger",
          )}
        >
          {live ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          <span className="hidden sm:inline">{live ? "Live" : "Reconnecting"}</span>
        </span>

        <button
          type="button"
          onClick={() => copy("code")}
          title="Copy room code"
          className="hidden h-9 items-center gap-1.5 rounded-full border border-white/12 px-3 font-mono text-xs tracking-widest text-cream hover:border-gold-400 sm:flex"
        >
          {copied === "code" ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {table.room_code}
        </button>
        <Button variant="secondary" size="sm" onClick={() => copy("link")} className="px-3" aria-label="Copy invitation link">
          {copied === "link" ? <Check className="size-4 text-success" /> : <Link2 className="size-4" />}
          <span className="hidden sm:inline">{copied === "link" ? "Copied" : "Invite"}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setPanelOpen((v) => !v);
            setSeenChatId(latestChatId);
          }}
          className="relative px-3 lg:hidden"
          aria-label={unread ? "Chat and hand history (new messages)" : "Chat and hand history"}
        >
          <MessageSquare className="size-4" />
          {unread && <span className="absolute top-1.5 right-2 size-2 rounded-full bg-gold-400" />}
        </Button>
        {isHost && !handRunning && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={closeTable} className="hidden px-3 sm:inline-flex">
            Close table
          </Button>
        )}
        {mySeat !== null ? (
          <Button variant="ghost" size="sm" disabled={busy || me?.status === "leaving"} onClick={leave} className="px-3" aria-label="Leave table">
            <DoorOpen className="size-4" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        ) : (
          <Link href={routes.lobby} className="px-2 text-sm text-mist hover:text-cream">
            Lobby
          </Link>
        )}
      </div>

      {/* Table and side panel */}
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 items-center overflow-y-auto">
          <PokerTable
            snapshot={snapshot}
            online={online}
            deadline={deadline}
            onSit={(seat) => run("/join", { seat })}
            centerMessage={centerMessage}
          />
        </div>
        <aside
          className={cn(
            "w-80 max-w-full shrink-0 flex-col border-l border-white/6 bg-ink-900/95 lg:flex lg:bg-ink-900/40",
            panelOpen ? "absolute inset-y-0 right-0 z-30 flex" : "hidden",
          )}
          aria-label="Chat and hand history"
        >
          <div className="flex items-center border-b border-white/6" role="tablist">
            {(["chat", "history"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                  tab === t ? "border-gold-400 text-cream" : "border-transparent text-slate hover:text-mist",
                )}
              >
                {t === "chat" ? "Chat" : "Hand history"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Close panel"
              className="p-3 text-mist lg:hidden"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "chat" ? (
              <TableChat tableId={tableId} messages={chat} myId={userId} canPost={mySeat !== null} />
            ) : (
              <HandLog hand={hand} handNumber={snapshot.handNumber} nameOf={nameOf} />
            )}
          </div>
        </aside>

        {notice && (
          <div
            role="alert"
            className="absolute top-3 left-1/2 z-40 w-[min(92%,28rem)] -translate-x-1/2 animate-fade-up rounded-xl border border-danger/40 bg-ink-900 px-4 py-3 text-center text-sm text-[#ffb4b6] shadow-panel"
          >
            {notice}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex min-h-28 flex-col justify-center border-t border-white/6 bg-ink-900/80 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
        {controls}
      </div>
    </div>
  );
}
