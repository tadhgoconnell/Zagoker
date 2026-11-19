"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { PlayingCard } from "@/components/cards/playing-card";
import { Avatar } from "@/components/ui/avatar";
import { photoUrl } from "@/lib/photos";
import { crownedNameClass, displayName, isCrowned } from "@/lib/players";
import { Chip } from "@/components/ui/chip";
import type { SeatInfo } from "@/lib/game/types";
import { TURN_SECONDS } from "@/lib/game/timing";
import type { PlayerView } from "@/lib/poker";
import { cardParts } from "@/lib/poker/display";
import { cn, formatChips, formatChipsCompact } from "@/lib/utils";

export type SeatProps = {
  seatNo: number;
  /** Position on the table as percentages of its box. */
  x: number;
  y: number;
  seat: SeatInfo | null;
  /** This seat's player in the current hand, if they were dealt in. */
  player: PlayerView | null;
  handOver: boolean;
  isMe: boolean;
  isTurn: boolean;
  /** Chips won this hand, when the hand is over. */
  won: number;
  /** What this player last did on the current street, e.g. "Raise 300". */
  lastAction: string | null;
  /** Name of the shown hand at showdown, e.g. "Pair of Aces". */
  handName: string | null;
  badges: string[];
  /** null while presence has not synced yet. */
  online: boolean | null;
  /** When the current turn ends, on this device's clock (ms). */
  deadline: number | null;
  canSit: boolean;
  onSit: () => void;
};

/** Seconds left and fraction remaining of the turn, updated a few times a second. */
function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [deadline]);
  if (deadline === null) return null;
  const ms = Math.max(0, deadline - now);
  return { seconds: Math.ceil(ms / 1000), fraction: Math.min(1, ms / (TURN_SECONDS * 1000)) };
}

export function Seat(props: SeatProps) {
  const { seat, player, isMe, isTurn, won, handOver } = props;
  const countdown = useCountdown(isTurn ? props.deadline : null);
  const style = { left: `${props.x}%`, top: `${props.y}%` };

  if (!seat) {
    return (
      <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={style}>
        {props.canSit ? (
          <button
            type="button"
            onClick={props.onSit}
            aria-label={`Sit in seat ${props.seatNo + 1}`}
            className="grid size-12 place-items-center rounded-full border border-dashed border-accent-400/60 bg-ink-900 text-accent-400 transition-colors hover:border-accent-300 hover:bg-ink-800 sm:size-14"
          >
            <Plus className="size-5" />
          </button>
        ) : (
          <div className="size-10 rounded-full border border-dashed border-ink-500 bg-ink-900/60 sm:size-12" />
        )}
      </div>
    );
  }

  const name = displayName(seat.profiles?.username);
  const crowned = isCrowned(seat.profiles?.username);
  const inHand = player !== null && !player.folded;
  const stack = player ? player.stack : seat.stack;
  const urgent = countdown !== null && countdown.seconds <= 8;

  let label: { text: string; tone: string } | null = null;
  if (won > 0) label = { text: `+${formatChipsCompact(won)}`, tone: "bg-accent-400 text-ink-950 animate-pop" };
  else if (player?.folded) label = { text: "Fold", tone: "bg-ink-600 text-mist" };
  else if (player?.allIn && !handOver) label = { text: "All-in", tone: "bg-danger text-white" };
  else if (seat.status === "sitting_out") label = { text: "Away", tone: "bg-ink-600 text-mist" };
  else if (seat.status === "leaving") label = { text: "Leaving", tone: "bg-ink-600 text-mist" };
  else if (props.lastAction && !handOver) label = { text: props.lastAction, tone: "bg-ink-700 text-cream animate-pop" };

  return (
    <div
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={style}
      data-seat={props.seatNo}
      data-turn={isTurn || undefined}
    >
      {/* Hole cards */}
      <div
        className={cn(
          "-mb-2 flex h-11 items-end sm:h-14",
          // Face-up cards sit side by side; face-down cards overlap to save room.
          inHand && player.holeCards ? "gap-0.5 sm:gap-1" : "-space-x-3",
        )}
      >
        {inHand &&
          (player.holeCards
            ? player.holeCards.map((c, i) => (
                <PlayingCard
                  key={c}
                  {...cardParts(c)}
                  size="sm"
                  className={cn(
                    "animate-deal",
                    isMe && "sm:h-17 sm:w-12 sm:rounded-lg sm:text-lg",
                    isMe && (i === 0 ? "-rotate-3" : "rotate-3"),
                  )}
                />
              ))
            : [0, 1].map((i) => (
                <PlayingCard
                  key={i}
                  faceDown
                  size="sm"
                  className={cn("h-9 w-6.5 animate-deal rounded-sm p-0.5 text-[8px]", i === 0 ? "-rotate-6" : "rotate-6")}
                />
              )))}
      </div>

      {/* Name plate */}
      <div
        title={`${name} · ${formatChips(stack)} chips`}
        className={cn(
          "relative flex w-22 items-center gap-1.5 rounded-lg border bg-ink-900 py-1 pr-2.5 pl-1 shadow-card transition-all sm:w-32 sm:gap-2 xl:w-36",
          isTurn ? "animate-turn border-accent-400" : won > 0 ? "border-accent-400" : "border-ink-500",
          (player?.folded || seat.status !== "active") && !won && "opacity-60",
        )}
      >
        <span className="relative shrink-0">
          <Avatar
            avatar={seat.profiles?.avatar ?? "spade"}
            crowned={crowned}
            photo={seat.profiles?.photo ?? photoUrl(seat.profiles?.avatar_path)}
            size="sm"
            className="size-7 sm:size-9"
          />
          {props.online === false && (
            <span
              title="Disconnected"
              className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-ink-900 bg-danger"
            />
          )}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className={cn("block truncate text-[11px] font-semibold sm:text-xs", crowned ? crownedNameClass : isMe ? "text-accent-300" : "text-cream")}>
            {name}
          </span>
          <span className="block text-[11px] font-medium text-mist tabular-nums sm:text-xs">
            {formatChipsCompact(stack)}
          </span>
        </span>
        {countdown && (
          <span
            aria-hidden="true"
            // Inset from the rounded corners, so the plate need not clip (the crown sticks out).
            className={cn("absolute bottom-0 left-2 h-0.5 rounded-full transition-[width] duration-200 ease-linear", urgent ? "bg-danger" : "bg-accent-400")}
            style={{ width: `calc((100% - 1rem) * ${countdown.fraction})` }}
          />
        )}
      </div>

      {/* Status line under the plate */}
      <div className="mt-1 flex h-4 items-center gap-1">
        {props.badges.map((b) => (
          <span
            key={b}
            title={b === "D" ? "Dealer" : b === "SB" ? "Small blind" : "Big blind"}
            className={cn(
              "grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold",
              b === "D" ? "bg-cream text-ink-950" : "bg-ink-950 text-mist",
            )}
          >
            {b}
          </span>
        ))}
        {label && (
          <span className={cn("rounded-full px-1.5 text-[10px] leading-4 font-semibold", label.tone)}>
            {label.text}
          </span>
        )}
        {countdown && isTurn && (
          <span className={cn("text-[10px] font-semibold tabular-nums", urgent ? "text-danger" : "text-accent-300")}>
            {countdown.seconds}s
          </span>
        )}
      </div>
      {props.handName && (
        <span className="absolute top-full mt-0.5 rounded-md bg-ink-950/85 px-2 py-0.5 text-[10px] whitespace-nowrap text-accent-300">
          {props.handName}
        </span>
      )}
    </div>
  );
}

/** Chips a player has bet on the current street, shown between them and the pot. */
export function BetMarker({ x, y, amount }: { x: number; y: number; amount: number }) {
  return (
    <div
      data-bet
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 animate-fade-up items-center gap-1 rounded-md bg-ink-950/75 py-0.5 pr-2 pl-1 text-[11px] font-semibold text-cream tabular-nums"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <Chip className="size-3.5" />
      {formatChips(amount)}
    </div>
  );
}
