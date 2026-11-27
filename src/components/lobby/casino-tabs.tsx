import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { LowPolyCard } from "@/components/casino/low-poly-card";
import { RouletteWheel } from "@/components/casino/roulette-wheel";
import { ChipFace } from "@/components/table/chip-token";
import { Facets } from "@/components/ui/facets";
import { routes } from "@/config/site";
import { facetMesh } from "@/lib/lowpoly";

/** Every tile: lifts a little under the cursor (hover only applies to real cursors, not taps). */
const tile =
  "group relative flex overflow-hidden rounded-2xl border border-ink-600 outline-none transition-[translate,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_16px_32px_-14px_rgb(0_0_0/0.9)] focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-inset";
const half = `${tile} min-h-36 bg-felt-700 sm:min-h-52`;
/** The artwork slides a little further into view on hover. */
const slide = "transition-transform duration-500 ease-out";

/**
 * Two halves at the top of the lobby: roulette on the left, blackjack on the
 * right. Each picture comes in from off the outer edge, so part of it is cut
 * off by the panel.
 */
export function CasinoTabs() {
  return (
    <nav
      aria-label="House games"
      className="grid grid-cols-2 gap-3"
    >
      <Link href={routes.roulette} className={half} data-tab="roulette">
        <Facets seed={21} cols={6} rows={4} strength={0.08} />
        {/* Wheel and chips, from off the left edge. */}
        <div
          aria-hidden="true"
          className={`${slide} pointer-events-none absolute top-1/2 left-0 aspect-square h-[130%] -translate-x-[62%] -translate-y-1/2 group-hover:-translate-x-[56%] lg:h-[150%] lg:-translate-x-[52%] lg:group-hover:-translate-x-[46%]`}
        >
          <RouletteWheel highlight={null} />
        </div>
        <ChipFace
          value={100}
          className={`${slide} absolute bottom-2 left-[14%] size-8 rotate-12 group-hover:translate-x-1 lg:bottom-3 lg:left-[30%] lg:size-12`}
        />
        <ChipFace
          value={25}
          className={`${slide} absolute bottom-7 left-[38%] hidden size-12 -rotate-12 group-hover:translate-x-1 lg:block`}
        />
        <div className="relative z-10 ml-auto flex flex-col items-end justify-center gap-1 p-4 text-right sm:p-8">
          <span className="font-display text-xl leading-tight font-extrabold tracking-tight text-cream sm:text-3xl lg:text-4xl">
            Play <br className="sm:hidden" />
            roulette
          </span>
          <span className="hidden text-sm text-cream/70 lg:block">Single zero · a number pays 35 to 1</span>
          <ArrowRight className="mt-1 size-5 text-accent-400 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>

      <Link href={routes.blackjack} className={`${half} bg-felt-800`} data-tab="blackjack">
        <Facets seed={22} cols={6} rows={4} strength={0.08} />
        <div className="relative z-10 flex flex-col items-start justify-center gap-1 p-4 sm:p-8">
          <span className="font-display text-xl leading-tight font-extrabold tracking-tight text-cream sm:text-3xl lg:text-4xl">
            Play <br className="sm:hidden" />
            blackjack
          </span>
          <span className="hidden text-sm text-cream/70 lg:block">Beat the dealer · blackjack pays 3 to 2</span>
          <ArrowRight className="mt-1 size-5 text-accent-400 transition-transform group-hover:translate-x-1" />
        </div>
        {/* A blackjack hand, fanned, from off the right edge. */}
        <div
          aria-hidden="true"
          className={`${slide} pointer-events-none absolute top-1/2 right-0 h-[118%] w-[46%] translate-x-[62%] -translate-y-[44%] group-hover:translate-x-[54%] lg:translate-x-[30%] lg:group-hover:translate-x-[22%]`}
        >
          <LowPolyCard
            id="lobby-card-a"
            rank="A"
            suit="s"
            seed={4}
            className="absolute top-[6%] left-0 h-[80%] -rotate-[14deg] drop-shadow-[0_6px_10px_rgb(0_0_0/0.45)]"
          />
          <LowPolyCard
            id="lobby-card-k"
            rank="K"
            suit="h"
            seed={9}
            className="absolute top-0 left-[32%] h-[80%] rotate-[10deg] drop-shadow-[0_6px_10px_rgb(0_0_0/0.45)]"
          />
        </div>
        <ChipFace
          value={500}
          className={`${slide} absolute right-[34%] bottom-2 hidden size-12 rotate-6 group-hover:-translate-x-1 lg:block`}
        />
      </Link>
    </nav>
  );
}

/** A many-sided oval: the low-poly outline of a poker table. */
function oval(cx: number, cy: number, rx: number, ry: number, sides = 18) {
  return Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * 2 * Math.PI;
    return `${(cx + rx * Math.cos(a)).toFixed(1)},${(cy + ry * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

/** The poker table drawn flat: rail, faceted felt and the betting line. */
function PokerTableArt() {
  const felt = facetMesh(300, 170, 8, 5, 31);
  return (
    <svg viewBox="0 0 300 170" className="size-full" aria-hidden="true">
      <polygon points={oval(150, 85, 148, 83)} fill="#0a0c0b" />
      <polygon points={oval(150, 85, 144, 79)} fill="#262c29" />
      <clipPath id="lobby-poker-felt">
        <polygon points={oval(150, 85, 132, 68)} />
      </clipPath>
      <g clipPath="url(#lobby-poker-felt)">
        {felt.map((f, i) => {
          const fill = f.shade > 0.3 ? "#1a4f38" : f.shade > -0.3 ? "#14412e" : "#103626";
          return <polygon key={i} points={f.points} fill={fill} stroke={fill} strokeWidth="0.4" />;
        })}
      </g>
      <polygon points={oval(150, 85, 112, 52)} fill="none" stroke="#5ded51" strokeOpacity="0.2" strokeWidth="1" />
    </svg>
  );
}

/**
 * Full-width tab above the house games: the poker tables below. A table with
 * Q K A of diamonds comes in from off the left edge, and the hand that makes it
 * a royal flush (10 and J of diamonds) with a chip from the right.
 */
export function PokerTab() {
  const card = "absolute h-full drop-shadow-[0_4px_8px_rgb(0_0_0/0.45)]";
  return (
    <a
      href="#public-tables"
      className={`${tile} min-h-32 items-center justify-center bg-felt-900 sm:min-h-44`}
      data-tab="poker"
    >
      <Facets seed={23} cols={10} rows={4} strength={0.08} />

      {/* The table with the queen, king and ace of diamonds, from off the left edge. */}
      <div
        aria-hidden="true"
        className={`${slide} pointer-events-none absolute top-1/2 left-0 aspect-[300/170] h-[150%] -translate-x-[60.5%] -translate-y-1/2`}
      >
        <PokerTableArt />
        {/* Board cards in the last three of five places; the first two are off the edge. */}
        <div className="absolute top-[38%] left-[34%] flex h-[24%] w-[56%] gap-[2.5%]">
          <div className="aspect-[60/84] h-full shrink-0" />
          <div className="aspect-[60/84] h-full shrink-0" />
          {(["Q", "K", "A"] as const).map((rank, i) => (
            <LowPolyCard key={rank} id={`lobby-board-${i}`} rank={rank} suit="d" seed={14 + i} className="h-full shrink-0" />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-1 px-4 py-4 text-center">
        <span className="font-display text-2xl leading-tight font-extrabold tracking-tight text-cream sm:text-3xl lg:text-4xl">
          Play poker
        </span>
        <span className="hidden text-sm text-cream/70 sm:block">Texas Hold&apos;em · join a table or create your own</span>
        <ArrowRight className="mt-1 size-5 rotate-90 text-accent-400 transition-transform group-hover:translate-y-1" />
      </div>

      {/* The 10 and J of diamonds, making the royal flush, from off the right edge. */}
      <div
        aria-hidden="true"
        className={`${slide} pointer-events-none absolute top-1/2 right-0 h-[96%] w-[30%] translate-x-[40%] -translate-y-[40%] group-hover:translate-x-[34%] sm:w-[22%] lg:translate-x-[34%] lg:group-hover:translate-x-[26%]`}
      >
        <LowPolyCard id="lobby-hole-1" rank="10" suit="d" seed={5} className={`${card} top-[4%] left-0 -rotate-[12deg]`} />
        <LowPolyCard id="lobby-hole-2" rank="J" suit="d" seed={6} className={`${card} top-0 left-[30%] rotate-[8deg]`} />
      </div>
      <ChipFace
        value={1000}
        className={`${slide} absolute right-[20%] bottom-3 hidden size-11 -rotate-6 group-hover:-translate-x-1 lg:block`}
      />
    </a>
  );
}
