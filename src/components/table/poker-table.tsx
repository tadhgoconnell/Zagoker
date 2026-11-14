"use client";

import { PlayingCard } from "@/components/cards/playing-card";
import { Chip } from "@/components/ui/chip";
import type { TableSnapshot } from "@/lib/game/types";
import { cardParts } from "@/lib/poker/display";
import { formatChips } from "@/lib/utils";
import { BetMarker, Seat } from "./seat";

type Props = {
  snapshot: TableSnapshot;
  online: ReadonlySet<string> | null;
  /** Turn deadline on this device's clock (ms), or null. */
  deadline: number | null;
  onSit: (seatNo: number) => void;
  /** Rendered in the middle of the felt when no hand is running. */
  centerMessage: React.ReactNode;
};

/**
 * Seat positions around an ellipse. The viewer's own seat is always at the
 * bottom centre and seat numbers increase clockwise from there.
 */
function seatPosition(index: number, total: number, radius = 50) {
  const angle = Math.PI / 2 + (index * 2 * Math.PI) / total;
  return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
}

export function PokerTable({ snapshot, online, deadline, onSit, centerMessage }: Props) {
  const { table, seats, hand, mySeat } = snapshot;
  const total = table.max_players;
  const anchor = mySeat ?? 0;
  const handOver = !!hand?.result;
  const usernames = new Map(seats.map((s) => [s.seat_no, s.profiles?.username ?? "Player"]));

  const winnings = hand?.result?.winnings ?? {};
  const shownNames = new Map(hand?.result?.shown.map((s) => [s.seat, s.hand.name]) ?? []);

  return (
    <div className="mx-auto w-full max-w-md px-13 pt-14 pb-12 sm:max-w-[min(64rem,calc((100dvh-21rem)*2))] sm:px-16 sm:pt-16 sm:pb-14">
      <div className="relative aspect-[4/5] w-full sm:aspect-[2/1]">
        {/* Rail and felt */}
        <div className="absolute inset-0 rounded-[50%] bg-linear-to-b from-ink-600 to-ink-800 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9)] ring-1 ring-gold-500/30" />
        <div className="absolute inset-[3.5%] rounded-[50%] bg-[radial-gradient(ellipse_at_50%_35%,var(--color-felt-500),var(--color-felt-800)_60%,var(--color-felt-950))] shadow-[inset_0_0_60px_rgb(0_0_0/0.6)] ring-1 ring-gold-500/40 sm:inset-[4.5%]" />
        <div className="absolute inset-[11%] rounded-[50%] border border-gold-400/10" />

        {/* Centre: pot, board, result */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-[14%] text-center">
          {hand ? (
            <>
              <div
                className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-gold-200 tabular-nums"
                aria-label={`Pot ${hand.pot}`}
              >
                <Chip className="size-4" />
                Pot {formatChips(hand.pot)}
              </div>
              <div className="flex gap-1 sm:gap-1.5" aria-label="Community cards">
                {[0, 1, 2, 3, 4].map((i) =>
                  hand.board[i] ? (
                    <PlayingCard
                      key={hand.board[i]}
                      {...cardParts(hand.board[i])}
                      size="sm"
                      className="animate-deal sm:h-17 sm:w-12 sm:rounded-lg sm:text-lg"
                    />
                  ) : (
                    <div
                      key={i}
                      className="h-13 w-9 rounded-md border border-dashed border-white/10 sm:h-17 sm:w-12 sm:rounded-lg"
                    />
                  ),
                )}
              </div>
              <div className="min-h-9 text-xs sm:text-sm" aria-live="polite">
                {hand.result ? (
                  hand.result.pots.map((pot, i) => (
                    <p key={i} className="animate-fade-up font-semibold text-gold-200">
                      {pot.winners.map((w) => usernames.get(w.seat) ?? "Player").join(" & ")}{" "}
                      {pot.winners.length > 1 ? "split" : "wins"} {formatChips(pot.amount)}
                      {hand.result!.pots.length > 1 && (i === 0 ? " (main pot)" : " (side pot)")}
                    </p>
                  ))
                ) : (
                  <p className="text-[11px] tracking-[0.2em] text-cream/50 uppercase">{hand.street}</p>
                )}
              </div>
            </>
          ) : (
            centerMessage
          )}
        </div>

        {/* Bets in front of each player */}
        {hand &&
          !handOver &&
          hand.players
            .filter((p) => p.streetBet > 0)
            .map((p) => {
              const pos = seatPosition((p.seat - anchor + total) % total, total, 31);
              return <BetMarker key={p.seat} x={pos.x} y={pos.y} amount={p.streetBet} />;
            })}

        {/* Seats */}
        {Array.from({ length: total }, (_, seatNo) => {
          const seat = seats.find((s) => s.seat_no === seatNo) ?? null;
          const player = hand?.players.find((p) => p.seat === seatNo) ?? null;
          const pos = seatPosition((seatNo - anchor + total) % total, total);
          const badges: string[] = [];
          if (hand && seat) {
            if (hand.dealerSeat === seatNo) badges.push("D");
            if (hand.smallBlindSeat === seatNo) badges.push("SB");
            if (hand.bigBlindSeat === seatNo) badges.push("BB");
          }
          return (
            <Seat
              key={seatNo}
              seatNo={seatNo}
              x={pos.x}
              y={pos.y}
              seat={seat}
              player={seat && player && player.id === seat.user_id ? player : null}
              handOver={handOver}
              isMe={seatNo === mySeat}
              isTurn={!handOver && hand?.toActSeat === seatNo}
              won={handOver ? (winnings[seatNo] ?? 0) : 0}
              handName={shownNames.get(seatNo) ?? null}
              badges={badges}
              online={seat && online ? online.has(seat.user_id) : null}
              deadline={deadline}
              canSit={mySeat === null}
              onSit={() => onSit(seatNo)}
            />
          );
        })}
      </div>
    </div>
  );
}
