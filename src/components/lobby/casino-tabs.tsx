import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { LowPolyCard } from "@/components/casino/low-poly-card";
import { RouletteWheel } from "@/components/casino/roulette-wheel";
import { ChipFace } from "@/components/table/chip-token";
import { Facets } from "@/components/ui/facets";
import { routes } from "@/config/site";

const half =
  "group relative flex min-h-36 overflow-hidden bg-felt-700 outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-inset sm:min-h-52";
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
      className="grid grid-cols-2 divide-x divide-ink-950 overflow-hidden rounded-2xl border border-ink-600"
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
