import { HeroTable } from "@/components/landing/hero-table";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { gameConfig, routes } from "@/config/site";
import { formatChips } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-ink-700 pt-12 pb-10 sm:pt-16 lg:pb-16">
      <Container className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
        <div className="animate-fade-up">
          <p className="font-mono text-xs tracking-widest text-accent-400 uppercase">
            No-Limit Texas Hold&apos;em · 2 to {gameConfig.maxPlayers} players
          </p>
          <h1 className="mt-5 font-display text-5xl leading-[0.95] font-extrabold tracking-tight text-balance sm:text-6xl xl:text-7xl">
            Poker night, wherever everyone&nbsp;is.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-mist">
            Open a private table, send the link, and play live from any phone, tablet or computer.
            No download. No account needed.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={routes.play} size="lg">
              Play now
            </ButtonLink>
            <ButtonLink href="/#how-it-works" variant="secondary" size="lg">
              How it works
            </ButtonLink>
          </div>
          <p className="mt-6 text-sm text-slate">
            {formatChips(gameConfig.startingChips)} free chips to start. Play money only: nothing to buy, nothing to cash out.
          </p>
        </div>
        <HeroTable className="animate-fade-up [animation-delay:120ms]" />
      </Container>
    </section>
  );
}
