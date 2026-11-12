import { PlayingCard, type Rank, type Suit } from "@/components/cards/playing-card";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

/**
 * Decorative illustration of a table for the landing page.
 * It is artwork only (hidden from assistive tech) and has no game logic.
 */
const board: { rank: Rank; suit: Suit }[] = [
  { rank: "A", suit: "spades" },
  { rank: "K", suit: "hearts" },
  { rank: "10", suit: "spades" },
  { rank: "7", suit: "diamonds" },
];

// Seat positions as percentages of the table box, clockwise from bottom centre.
const seats = [
  { x: 50, y: 100, hero: true },
  { x: 8, y: 78 },
  { x: 6, y: 24 },
  { x: 50, y: 0, turn: true },
  { x: 94, y: 24 },
  { x: 92, y: 78 },
];

export function HeroTable({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("relative mx-auto w-full max-w-3xl px-6 py-10", className)}
    >
      <div className="relative aspect-[2/1] w-full">
        {/* Rail */}
        <div className="absolute inset-0 rounded-[50%] bg-linear-to-b from-ink-600 to-ink-800 shadow-[0_40px_80px_-20px_rgb(0_0_0/0.9)] ring-1 ring-gold-500/30" />
        {/* Felt */}
        <div className="absolute inset-[4.5%] rounded-[50%] bg-[radial-gradient(ellipse_at_50%_35%,var(--color-felt-500),var(--color-felt-800)_60%,var(--color-felt-950))] shadow-[inset_0_0_60px_rgb(0_0_0/0.6)] ring-1 ring-gold-500/40" />
        <div className="absolute inset-[11%] rounded-[50%] border border-gold-400/15" />

        {/* Board */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-[10px] font-semibold tracking-wide text-gold-200 sm:text-xs">
            <Chip className="size-3.5 sm:size-4" />
            POT 2,450
          </div>
          <div className="flex gap-1 sm:gap-2">
            {board.map((c, i) => (
              <PlayingCard
                key={c.rank + c.suit}
                {...c}
                size="sm"
                className="animate-deal sm:h-17 sm:w-12 sm:rounded-lg sm:text-lg"
                style={{ animationDelay: `${300 + i * 140}ms` }}
              />
            ))}
            <div className="h-13 w-9 rounded-md border border-dashed border-white/15 sm:h-17 sm:w-12 sm:rounded-lg" />
          </div>
        </div>

        {/* Seats */}
        {seats.map((seat, i) => (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
          >
            {seat.hero ? (
              <div className="flex animate-float gap-1">
                <PlayingCard rank="Q" suit="spades" size="sm" className="-rotate-6 sm:h-17 sm:w-12 sm:rounded-lg" />
                <PlayingCard rank="J" suit="spades" size="sm" className="rotate-6 sm:h-17 sm:w-12 sm:rounded-lg" />
              </div>
            ) : (
              <div
                className={cn(
                  "grid size-9 place-items-center rounded-full border bg-ink-800 sm:size-12",
                  seat.turn
                    ? "border-gold-400 shadow-gold"
                    : "border-white/15",
                )}
              >
                <div className="flex -space-x-2 sm:-space-x-3">
                  <PlayingCard faceDown size="sm" className="h-5 w-3.5 rounded-xs p-px text-[0px] sm:h-7 sm:w-5" />
                  <PlayingCard faceDown size="sm" className="h-5 w-3.5 rounded-xs p-px text-[0px] sm:h-7 sm:w-5" />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Dealer button */}
        <div className="absolute top-[72%] left-[24%] grid size-5 place-items-center rounded-full bg-cream text-[9px] font-bold text-ink-950 shadow-card sm:size-6 sm:text-[10px]">
          D
        </div>
      </div>
    </div>
  );
}
