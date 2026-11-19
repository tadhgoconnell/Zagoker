"use client";

import { PlayingCard } from "@/components/cards/playing-card";
import { Chip } from "@/components/ui/chip";
import type { TableSnapshot } from "@/lib/game/types";
import { displayName } from "@/lib/players";
import { cardParts, currentHandName } from "@/lib/poker/display";
import { formatChips, formatChipsCompact } from "@/lib/utils";
import { Dragon } from "@/components/ui/dragon";
import { Facets } from "@/components/ui/facets";
import { Dealer } from "./dealer";
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
function seatPosition(index: number, total: number, rx = 50, ry = 50) {
  const angle = Math.PI / 2 + (index * 2 * Math.PI) / total;
  return { x: 50 + rx * Math.cos(angle), y: 50 + ry * Math.sin(angle) };
}

export function PokerTable({ snapshot, online, deadline, onSit, centerMessage }: Props) {
  const { table, seats, hand, mySeat } = snapshot;
  const total = table.max_players;
  const anchor = mySeat ?? 0;
  const handOver = !!hand?.result;
  const usernames = new Map(seats.map((s) => [s.seat_no, displayName(s.profiles?.username)]));

  // Each player's latest voluntary action on the current street.
  const lastActions = new Map<number, string>();
  for (const a of hand?.actions ?? []) {
    if (a.street !== hand!.street || a.type === "post_sb" || a.type === "post_bb") continue;
    const word = a.type[0].toUpperCase() + a.type.slice(1);
    lastActions.set(
      a.seat,
      a.allIn ? "All-in" : a.type === "bet" || a.type === "raise" ? `${word} ${formatChipsCompact(a.streetBet)}` : word,
    );
  }

  const winnings = hand?.result?.winnings ?? {};
  const shownNames = new Map(hand?.result?.shown.map((s) => [s.seat, s.hand.name]) ?? []);

  return (
    // Tall oval when the screen is portrait (phones, iPad upright), wide oval in
    // landscape. On tablets and desktops the width is capped by the screen
    // height so the whole table fits; phones use the full width instead and
    // the table area scrolls if it must, because seats would overlap otherwise.
    <div className="mx-auto w-full max-w-md px-11 pt-10 pb-12 sm:px-16 sm:pt-16 sm:pb-14 sm:portrait:max-w-[min(44rem,max(20rem,calc((100dvh-19rem)*0.8)))] landscape:max-w-[min(64rem,max(26rem,calc((100dvh-20rem)*2)))]">
      <div className="relative w-full portrait:aspect-[4/5] landscape:aspect-[2/1]">
        {/* Rail and felt: flat colours, low-poly texture, no gradients. */}
        <div className="absolute inset-0 rounded-[50%] border border-ink-500 bg-ink-800 shadow-[0_30px_60px_-24px_rgb(0_0_0/0.9)]" />
        <div className="absolute inset-[3.5%] overflow-hidden rounded-[50%] bg-felt-700 sm:inset-[4.5%]">
          <Facets seed={hand ? 3 : 5} cols={9} rows={7} strength={0.09} />
          {/* The table's emblem, printed faintly into the felt: one large dragon
              on upright screens, a facing pair either side of the board on
              wide ones (where the dealer would hide a single one). */}
          <Dragon className="absolute top-1/2 left-1/2 h-[82%] -translate-x-1/2 -translate-y-1/2 opacity-[0.13] landscape:hidden" />
          <Dragon mirrored className="absolute top-1/2 left-[25%] h-[62%] -translate-x-1/2 -translate-y-1/2 opacity-[0.16] portrait:hidden" />
          <Dragon className="absolute top-1/2 left-[75%] h-[62%] -translate-x-1/2 -translate-y-1/2 opacity-[0.16] portrait:hidden" />
        </div>
        <div className="absolute inset-[11%] rounded-[50%] border border-accent-400/15" />

        {/* Centre: pot, board, result */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-[14%] text-center">
          <Dealer
            cue={`${snapshot.handNumber}:${hand?.board.length ?? 0}`}
            className="mb-1 aspect-square w-[22%] max-w-36 min-w-16 portrait:w-[30%]"
          />
          {hand ? (
            <>
              <div
                className="flex items-center gap-1.5 rounded-md bg-ink-950/70 px-2.5 py-1 text-xs font-semibold text-cream tabular-nums"
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
                      className="h-13 w-9 rounded-md border border-dashed border-ink-600 sm:h-17 sm:w-12 sm:rounded-lg"
                    />
                  ),
                )}
              </div>
              <div className="min-h-9 text-xs sm:text-sm" aria-live="polite" data-result>
                {hand.result ? (
                  hand.result.pots.map((pot, i) => (
                    <p key={i} className="animate-fade-up font-semibold text-accent-200">
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
              // Closer to the middle vertically, so the marker clears the cards.
              const pos = seatPosition((p.seat - anchor + total) % total, total, 33, 25);
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
              lastAction={lastActions.get(seatNo) ?? null}
              handName={shownNames.get(seatNo) ?? null}
              liveHand={
                seatNo === mySeat && player?.holeCards && !player.folded && !handOver
                  ? currentHandName(player.holeCards, hand!.board)
                  : null
              }
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
