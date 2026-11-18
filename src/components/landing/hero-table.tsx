import { PlayingCard, type Rank, type Suit } from "@/components/cards/playing-card";
import { Dealer } from "@/components/table/dealer";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Dragon } from "@/components/ui/dragon";
import { Facets } from "@/components/ui/facets";
import type { AvatarKey } from "@/config/avatars";
import { cn } from "@/lib/utils";

/** Decorative table for the landing page. Artwork only, no game logic. */
const board: { rank: Rank; suit: Suit }[] = [
  { rank: "A", suit: "spades" },
  { rank: "K", suit: "hearts" },
  { rank: "10", suit: "spades" },
];

const seats: { x: number; y: number; avatar: AvatarKey; name: string; turn?: boolean }[] = [
  { x: 10, y: 74, avatar: "heart", name: "maeve" },
  { x: 9, y: 24, avatar: "diamond", name: "oisin" },
  { x: 91, y: 24, avatar: "crown", name: "aoife", turn: true },
  { x: 90, y: 74, avatar: "star", name: "cian" },
];

export function HeroTable({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative mx-auto w-full max-w-2xl px-4 pt-4 pb-20 sm:px-10", className)}>
      <div className="relative aspect-[16/10] w-full">
        <div className="absolute inset-0 rounded-[50%] border border-ink-500 bg-ink-800" />
        <div className="absolute inset-[4.5%] overflow-hidden rounded-[50%] bg-felt-700">
          <Facets seed={3} cols={9} rows={6} strength={0.1} />
          <Dragon mirrored className="absolute top-1/2 left-[26%] h-[60%] -translate-x-1/2 -translate-y-1/2 opacity-[0.16]" />
          <Dragon className="absolute top-1/2 left-[74%] h-[60%] -translate-x-1/2 -translate-y-1/2 opacity-[0.16]" />
        </div>
        <div className="absolute inset-[11%] rounded-[50%] border border-accent-400/15" />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 sm:gap-2">
          <Dealer cue="hero" className="aspect-square w-[22%]" />
          <div className="flex items-center gap-1.5 rounded-md bg-ink-950/70 px-2.5 py-1 text-[10px] font-semibold text-cream sm:text-xs">
            <Chip className="size-3.5 sm:size-4" />
            Pot 2,450
          </div>
          <div className="flex gap-1 sm:gap-1.5">
            {board.map((c, i) => (
              <PlayingCard
                key={c.rank + c.suit}
                {...c}
                size="sm"
                className="animate-deal sm:h-17 sm:w-12 sm:rounded-lg sm:text-lg"
                style={{ animationDelay: `${300 + i * 140}ms` }}
              />
            ))}
            {[0, 1].map((i) => (
              <div key={i} className="h-13 w-9 rounded-md border border-dashed border-ink-600 sm:h-17 sm:w-12 sm:rounded-lg" />
            ))}
          </div>
        </div>

        {seats.map((seat) => (
          <div
            key={seat.name}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
          >
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-lg border bg-ink-900 py-1 pr-2.5 pl-1 shadow-card",
                seat.turn ? "border-accent-400 ring-2 ring-accent-400/40" : "border-ink-500",
              )}
            >
              <Avatar avatar={seat.avatar} size="sm" className="size-6 sm:size-8" />
              <span className="text-[10px] leading-tight font-semibold sm:text-xs">
                {seat.name}
                <span className="block font-normal text-mist">{seat.turn ? "thinking…" : "1,840"}</span>
              </span>
            </div>
          </div>
        ))}

        {/* The viewer's own seat, with their cards. */}
        <div className="absolute top-full left-1/2 flex -translate-x-1/2 -translate-y-[38%] flex-col items-center">
          <div className="-mb-2 flex gap-1">
            <PlayingCard rank="Q" suit="spades" size="sm" className="-rotate-3 sm:h-17 sm:w-12 sm:rounded-lg sm:text-lg" />
            <PlayingCard rank="J" suit="spades" size="sm" className="rotate-3 sm:h-17 sm:w-12 sm:rounded-lg sm:text-lg" />
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-ink-500 bg-ink-900 py-1 pr-2.5 pl-1 shadow-card">
            <Avatar avatar="spade" size="sm" className="size-6 sm:size-8" />
            <span className="text-[10px] leading-tight font-semibold text-accent-300 sm:text-xs">
              you
              <span className="block font-normal text-mist">2,000</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
