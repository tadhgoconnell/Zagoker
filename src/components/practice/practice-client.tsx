"use client";

import { Bot, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionBar } from "@/components/table/action-bar";
import { HandLog } from "@/components/table/hand-log";
import { PokerTable } from "@/components/table/poker-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import type { AvatarKey } from "@/config/avatars";
import { routes } from "@/config/site";
import { PAUSE_AFTER_FOLD_MS, PAUSE_AFTER_SHOWDOWN_MS } from "@/lib/game/timing";
import type { SeatInfo, TableSnapshot } from "@/lib/game/types";
import {
  applyAction,
  nextDealerSeat,
  startHand,
  toPlayerView,
  type HandState,
  type PlayerAction,
} from "@/lib/poker";
import { botName, decideBotAction, styleForBot } from "@/lib/poker/bots";
import { browserRandomInt } from "@/lib/poker/browser-random";
import { cn, formatChips } from "@/lib/utils";

const ME = 0;
const botAvatars: AvatarKey[] = ["heart", "diamond", "crown", "star", "flame", "bolt", "gem", "rocket"];
const blindLevels = [[5, 10], [10, 20], [25, 50], [50, 100]] as const;
const stacks = [50, 100, 200] as const; // big blinds

type Config = { bots: number; difficulty: number; level: number; stackBb: number };
type Player = { seat: number; name: string; avatar: AvatarKey; photo?: string | null; stack: number; bot: number | null };
type Game = {
  config: Config;
  players: Player[];
  hand: HandState | null;
  handNumber: number;
  dealer: number | null;
  over: null | "won" | "lost";
};

export function PracticeClient({ me }: { me: { name: string; avatar: AvatarKey; photo: string | null } }) {
  const [config, setConfig] = useState<Config>({ bots: 3, difficulty: 5, level: 1, stackBb: 100 });
  const [game, setGame] = useState<Game | null>(null);
  const [tab, setTab] = useState<"history" | "players">("players");

  const start = useCallback(() => {
    const [, bb] = blindLevels[config.level];
    const stack = bb * config.stackBb;
    const players: Player[] = [
      { seat: ME, name: me.name, avatar: me.avatar, photo: me.photo, stack, bot: null },
      ...Array.from({ length: config.bots }, (_, i) => ({
        seat: i + 1,
        name: botName(i + 1),
        avatar: botAvatars[i],
        stack,
        bot: i + 1,
      })),
    ];
    setGame({ config, players, hand: null, handNumber: 0, dealer: null, over: null });
  }, [config, me]);

  /** Deals the next hand from the current stacks. */
  const deal = useCallback(() => {
    setGame((g) => {
      if (!g || g.over || (g.hand && !g.hand.result)) return g;
      const alive = g.players.filter((p) => p.stack > 0);
      if (!alive.some((p) => p.seat === ME)) return { ...g, over: "lost" };
      if (alive.length < 2) return { ...g, over: "won" };
      const [sb, bb] = blindLevels[g.config.level];
      const dealer = nextDealerSeat(alive.map((p) => p.seat), g.dealer);
      const hand = startHand({
        smallBlind: sb,
        bigBlind: bb,
        dealerSeat: dealer,
        players: alive.map((p) => ({ seat: p.seat, id: `p${p.seat}`, stack: p.stack })),
        randomInt: browserRandomInt,
      });
      return { ...g, players: alive, hand, handNumber: g.handNumber + 1, dealer };
    });
  }, []);

  /** Applies an action and, if the hand ended, writes the final stacks back. */
  const act = useCallback((seat: number, action: PlayerAction) => {
    setGame((g) => {
      if (!g?.hand || g.hand.result || g.hand.toActSeat !== seat) return g;
      const hand = applyAction(g.hand, seat, action);
      const players = hand.result
        ? g.players.map((p) => ({ ...p, stack: hand.players.find((q) => q.seat === p.seat)?.stack ?? p.stack }))
        : g.players;
      return { ...g, hand, players };
    });
  }, []);

  // Bots take their turn after a short, human-looking pause.
  const toAct = game?.hand && !game.hand.result ? game.hand.toActSeat : null;
  const version = game?.hand?.version;
  useEffect(() => {
    if (!game?.hand || toAct === null || toAct === ME) return;
    const player = game.players.find((p) => p.seat === toAct);
    if (!player?.bot) return;
    const t = setTimeout(() => {
      // The bot sees only its own cards and the public table.
      const view = toPlayerView(game.hand!, toAct);
      const action = decideBotAction(view, toAct, styleForBot(player.bot!), game.config.difficulty, browserRandomInt);
      act(toAct, action);
    }, 650 + browserRandomInt(900));
    return () => clearTimeout(t);
  }, [game, toAct, version, act]);

  // Next hand after a pause, or the first hand straight away.
  const result = game?.hand?.result ?? null;
  const started = !!game;
  const handNumber = game?.handNumber ?? 0;
  useEffect(() => {
    if (!started || game?.over) return;
    if (handNumber > 0 && !result) return;
    const pause = handNumber === 0 ? 400 : result?.endedBy === "showdown" ? PAUSE_AFTER_SHOWDOWN_MS : PAUSE_AFTER_FOLD_MS + 800;
    const t = setTimeout(deal, pause);
    return () => clearTimeout(t);
  }, [started, handNumber, result, game?.over, deal]);

  // The snapshot the shared table components draw.
  const snapshot: TableSnapshot | null = useMemo(() => {
    if (!game) return null;
    const [sb, bb] = blindLevels[game.config.level];
    const seats: SeatInfo[] = game.players.map((p) => ({
      seat_no: p.seat,
      user_id: `p${p.seat}`,
      stack: p.stack,
      status: "active",
      profiles: { username: p.name, avatar: p.avatar, photo: p.photo ?? null },
    }));
    return {
      table: {
        id: "practice",
        name: "Practice",
        owner_id: "p0",
        is_private: true,
        room_code: "",
        max_players: game.config.bots + 1,
        small_blind: sb,
        big_blind: bb,
        buy_in: bb * game.config.stackBb,
        status: "open",
        hand_number: game.handNumber,
      },
      seats,
      mySeat: ME,
      hand: game.hand ? toPlayerView(game.hand, ME) : null,
      handNumber: game.handNumber,
      turnDeadline: null,
      serverNow: "",
    };
  }, [game]);

  if (!game || !snapshot) {
    return <Setup config={config} setConfig={setConfig} onStart={start} />;
  }

  const hand = snapshot.hand;
  const nameOf = (seat: number) => game.players.find((p) => p.seat === seat)?.name ?? "Player";
  const myPlayer = hand?.players.find((p) => p.seat === ME);
  const myTurn = !!hand && !hand.result && hand.toActSeat === ME && !!hand.legalActions;

  let controls: React.ReactNode;
  if (game.over) {
    controls = (
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <p className="font-display text-lg font-extrabold">
          {game.over === "won" ? "You took every chip. Well played." : "You're out of chips."}
        </p>
        <Button onClick={start}>
          <RotateCcw className="size-4" /> Play again
        </Button>
        <Button variant="secondary" onClick={() => setGame(null)}>
          Change settings
        </Button>
      </div>
    );
  } else if (myTurn) {
    controls = (
      <ActionBar key={`${game.handNumber}:${hand!.version}`} hand={hand!} mySeat={ME} disabled={false} onAction={(a) => act(ME, a)} />
    );
  } else {
    controls = (
      <p className="text-center text-sm text-mist">
        {!hand || hand.result
          ? "Next hand starting…"
          : myPlayer?.folded
            ? `You folded. ${nameOf(hand.toActSeat!)} is thinking…`
            : `${nameOf(hand.toActSeat!)} is thinking…`}
      </p>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[34rem] flex-col" data-table="practice" data-hand-number={game.handNumber}>
      <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-950 px-3 py-2 sm:gap-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 truncate text-sm font-semibold sm:text-base">
            <Bot className="size-4 shrink-0 text-accent-400" aria-hidden="true" />
            Practice · {game.config.bots} {game.config.bots === 1 ? "bot" : "bots"} · difficulty {game.config.difficulty}
          </h1>
          <p className="truncate text-xs text-mist">
            Blinds {formatChips(snapshot.table.small_blind)}/{formatChips(snapshot.table.big_blind)}
            {game.handNumber > 0 && ` · Hand #${game.handNumber}`} · No real chips at stake
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setGame(null)} className="px-3">
          New game
        </Button>
        <Link href={routes.lobby} className="px-2 text-sm text-mist hover:text-cream">
          Lobby
        </Link>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 items-center overflow-y-auto">
          <PokerTable snapshot={snapshot} online={null} deadline={null} onSit={() => {}} centerMessage={<p className="font-display text-xl font-extrabold">Shuffling…</p>} />
        </div>
        <aside className="hidden w-80 shrink-0 flex-col border-l border-ink-700 bg-ink-950 lg:flex" aria-label="Opponents and hand history">
          <div className="flex border-b border-ink-700" role="tablist">
            {(["players", "history"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                  tab === t ? "border-accent-400 text-cream" : "border-transparent text-slate hover:text-mist",
                )}
              >
                {t === "players" ? "Opponents" : "Hand history"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "players" ? (
              <ul className="divide-y divide-ink-700">
                {Array.from({ length: game.config.bots }, (_, i) => i + 1).map((n) => {
                  const style = styleForBot(n);
                  const p = game.players.find((x) => x.bot === n);
                  return (
                    <li key={n} className={cn("flex gap-3 p-4", !p && "opacity-45")}>
                      <Avatar avatar={botAvatars[n - 1]} size="sm" />
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold">
                          {botName(n)} <span className="font-normal text-mist">· {style.name}</span>
                        </p>
                        <p className="text-xs text-slate">{p ? style.description : "Out of chips"}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <HandLog hand={hand} handNumber={game.handNumber} nameOf={nameOf} />
            )}
          </div>
        </aside>
      </div>

      <div className="flex min-h-28 flex-col justify-center border-t border-ink-700 bg-ink-950 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
        {controls}
      </div>
    </div>
  );
}

function Setup({
  config,
  setConfig,
  onStart,
}: {
  config: Config;
  setConfig: (c: Config) => void;
  onStart: () => void;
}) {
  const [, bb] = blindLevels[config.level];
  const pill = (active: boolean) =>
    cn(
      "h-11 rounded-lg border text-sm font-semibold transition-colors",
      active ? "border-accent-400 bg-accent-400 text-ink-950" : "border-ink-600 text-mist hover:border-ink-500 hover:text-cream",
    );
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <p className="font-mono text-xs tracking-widest text-accent-400 uppercase">Practice</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Play against the Prefects</h1>
      <p className="mt-3 text-mist">
        Computer opponents, each with their own style. Practice games run on your device and never touch your chip
        balance or statistics.
      </p>

      <Panel className="mt-8 space-y-7 p-6 sm:p-8">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Number of bots</legend>
          <div className="grid grid-cols-8 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button key={n} type="button" aria-pressed={config.bots === n} onClick={() => setConfig({ ...config, bots: n })} className={pill(config.bots === n)}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-semibold">
            Difficulty
            <span className="font-display text-2xl font-extrabold text-accent-400 tabular-nums">{config.difficulty}</span>
          </legend>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, d) => (
              <button
                key={d}
                type="button"
                aria-label={`Difficulty ${d}`}
                aria-pressed={config.difficulty === d}
                onClick={() => setConfig({ ...config, difficulty: d })}
                className={cn(pill(config.difficulty === d), "px-0 text-xs")}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate">
            0: the Prefects barely look at their cards. 10: they read their hands well and respect the pot odds.
          </p>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Blinds</legend>
            <div className="grid grid-cols-4 gap-1.5">
              {blindLevels.map(([s, b], i) => (
                <button key={b} type="button" aria-pressed={config.level === i} onClick={() => setConfig({ ...config, level: i })} className={cn(pill(config.level === i), "text-xs")}>
                  {s}/{b}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Starting stack</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {stacks.map((n) => (
                <button key={n} type="button" aria-pressed={config.stackBb === n} onClick={() => setConfig({ ...config, stackBb: n })} className={cn(pill(config.stackBb === n), "text-xs")}>
                  {formatChips(bb * n)}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Your opponents</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: config.bots }, (_, i) => i + 1).map((n) => (
              <li key={n} className="flex items-center gap-2.5 rounded-lg border border-ink-600 px-3 py-2 text-sm">
                <Avatar avatar={botAvatars[n - 1]} size="sm" />
                <span className="min-w-0">
                  <span className="block font-semibold">{botName(n)}</span>
                  <span className="block truncate text-xs text-mist">{styleForBot(n).name}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Button size="lg" className="w-full" onClick={onStart}>
          Deal me in
        </Button>
      </Panel>
    </div>
  );
}
