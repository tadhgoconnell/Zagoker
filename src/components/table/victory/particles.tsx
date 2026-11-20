/**
 * What the dragon breathes out: low-poly gold coins, green notes and playing
 * cards. Flat colours, no gradients, in the house style.
 */
import { PlayingCard, type Rank, type Suit } from "@/components/cards/playing-card";
import type { ParticleKind } from "./timeline";

// The crown's golds (components/ui/avatar.tsx), lit from the upper left.
const COIN_RIM = ["#f7d978", "#f2c94c", "#e6b93a", "#d9a92b", "#c8961f", "#d9a92b", "#e6b93a", "#f2c94c"];

function octagon(r: number, i: number) {
  const a = ((i - 2.5) * Math.PI) / 4;
  return [10 + r * Math.cos(a), 10 + r * Math.sin(a)] as const;
}
const pt = ([x, y]: readonly [number, number]) => `${x.toFixed(2)},${y.toFixed(2)}`;

export function Coin() {
  return (
    <svg viewBox="0 0 20 20" className="size-full" aria-hidden="true">
      {COIN_RIM.map((fill, i) => (
        <polygon key={i} points={`10,10 ${pt(octagon(9.6, i))} ${pt(octagon(9.6, i + 1))}`} fill={fill} stroke={fill} strokeWidth={0.3} />
      ))}
      <polygon points={Array.from({ length: 8 }, (_, i) => pt(octagon(5.6, i))).join(" ")} fill="#f2c94c" />
      <polygon points={`10,10 ${pt(octagon(5.6, 3))} ${pt(octagon(5.6, 4))} ${pt(octagon(5.6, 5))} ${pt(octagon(5.6, 6))} ${pt(octagon(5.6, 7))}`} fill="#d9a92b" />
    </svg>
  );
}

export function Note() {
  return (
    <svg viewBox="0 0 36 18" className="size-full" aria-hidden="true">
      <polygon points="0,0 18,0 0,18" fill="#9cf493" />
      <polygon points="18,0 36,0 24,9" fill="#5ded51" />
      <polygon points="18,0 24,9 0,18" fill="#7fef74" />
      <polygon points="36,0 36,18 24,9" fill="#47d43c" />
      <polygon points="0,18 24,9 36,18" fill="#35a92c" />
      <rect x="2.5" y="2.5" width="31" height="13" fill="none" stroke="#23731d" strokeWidth="1" />
      <polygon points="18,4.5 22.5,9 18,13.5 13.5,9" fill="#23731d" />
    </svg>
  );
}

const SUIT_GLYPH: Record<Suit, string> = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };

const FACE_UP: readonly { rank: Rank; suit: Suit }[] = [
  { rank: "A", suit: "spades" },
  { rank: "K", suit: "hearts" },
  { rank: "A", suit: "diamonds" },
];

/** One particle's artwork. `index` picks which face-up card it shows. */
export function ParticleArt({ kind, index }: { kind: ParticleKind; index: number }) {
  if (kind === "coin") return <Coin />;
  if (kind === "note") return <Note />;
  if (kind === "cardDown") return <PlayingCard faceDown size="sm" className="size-full rounded-[12%]" />;
  // Drawn here rather than with PlayingCard so the pips scale with the card
  // (the parent sets font-size to the card's width).
  const card = FACE_UP[index % FACE_UP.length];
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <div
      className={`flex size-full flex-col items-center justify-center rounded-[12%] border border-black/10 bg-[#f6f7f5] leading-none font-bold shadow-card ${red ? "text-suit-red" : "text-suit-black"}`}
    >
      <span className="text-[0.48em] tracking-tighter">{card.rank}</span>
      <span className="text-[0.55em]">{SUIT_GLYPH[card.suit]}</span>
    </div>
  );
}

/** Particle size as a fraction of the dragon's height: [width, height]. */
export const PARTICLE_SIZE: Record<ParticleKind, readonly [number, number]> = {
  coin: [0.1, 0.1],
  note: [0.17, 0.085],
  cardUp: [0.11, 0.155],
  cardDown: [0.11, 0.155],
};
