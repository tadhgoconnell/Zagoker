import { Dragon } from "@/components/ui/dragon";
import { Facets } from "@/components/ui/facets";
import { cn } from "@/lib/utils";

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

type Size = "sm" | "md" | "lg";

const suitGlyph: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const sizes: Record<Size, { card: string; rank: string; pip: string }> = {
  sm: { card: "w-9 h-13 rounded-md", rank: "text-sm", pip: "text-base" },
  md: { card: "w-12 h-17 rounded-lg", rank: "text-lg", pip: "text-xl" },
  lg: { card: "w-16 h-23 rounded-xl", rank: "text-2xl", pip: "text-3xl" },
};

type PlayingCardProps = {
  /** Omit rank and suit (or set faceDown) to render the card back. */
  rank?: Rank;
  suit?: Suit;
  faceDown?: boolean;
  size?: Size;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Presentational playing card. It only draws what it is given: the server
 * decides which cards a client is allowed to know about.
 */
export function PlayingCard({
  rank,
  suit,
  faceDown,
  size = "md",
  className,
  style,
}: PlayingCardProps) {
  const s = sizes[size];

  if (faceDown || !rank || !suit) {
    return (
      <div
        role="img"
        aria-label="Face-down card"
        style={style}
        className={cn(s.card, "relative shrink-0 overflow-hidden border border-ink-950 bg-ink-700 shadow-card", className)}
      >
        <Facets seed={7} cols={3} rows={4} strength={0.35} />
        <span className="absolute inset-[3px] rounded-[inherit] border border-accent-400/60" />
        <Dragon className="absolute inset-0 m-auto h-[78%] w-[80%]" />
      </div>
    );
  }

  const red = suit === "hearts" || suit === "diamonds";

  return (
    <div
      role="img"
      aria-label={`${rank} of ${suit}`}
      style={style}
      className={cn(
        s.card,
        "relative flex shrink-0 flex-col items-center justify-center border border-black/10 bg-[#f6f7f5] leading-none font-bold shadow-card",
        red ? "text-suit-red" : "text-suit-black",
        className,
      )}
    >
      <span className={cn(s.rank, "tracking-tighter")}>{rank}</span>
      <span className={s.pip}>{suitGlyph[suit]}</span>
    </div>
  );
}
