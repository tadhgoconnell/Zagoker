import { ShieldCheck } from "lucide-react";
import { HeroTable } from "@/components/landing/hero-table";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { gameConfig, routes } from "@/config/site";
import { formatChips } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-14 pb-8 sm:pt-20">
      <Container className="flex flex-col items-center text-center">
        <Badge tone="gold" className="animate-fade-up">
          <ShieldCheck className="size-3.5" />
          100% free · virtual chips only
        </Badge>

        <h1
          className="mt-6 max-w-4xl animate-fade-up font-display text-4xl leading-[1.08] font-bold text-balance sm:text-6xl lg:text-7xl"
          style={{ animationDelay: "80ms" }}
        >
          Your table. Your friends.{" "}
          <span className="text-gold-gradient sm:whitespace-nowrap">
            Real&#8209;time Hold&apos;em.
          </span>
        </h1>

        <p
          className="mt-6 max-w-xl animate-fade-up text-base leading-relaxed text-pretty text-mist sm:text-lg"
          style={{ animationDelay: "160ms" }}
        >
          Open a private room, share the code and deal the cards. No-Limit
          Texas Hold&apos;em for 2 to {gameConfig.maxPlayers} players, from any
          device.
        </p>

        <div
          className="mt-9 flex w-full animate-fade-up flex-col items-center gap-3 sm:w-auto sm:flex-row"
          style={{ animationDelay: "240ms" }}
        >
          <ButtonLink href={routes.register} size="lg" className="w-full sm:w-auto">
            Play now
          </ButtonLink>
          <ButtonLink
            href={routes.login}
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto"
          >
            I have an account
          </ButtonLink>
        </div>

        <p
          className="mt-5 flex animate-fade-up items-center gap-2 text-sm text-slate"
          style={{ animationDelay: "320ms" }}
        >
          <Chip className="size-4" />
          {formatChips(gameConfig.startingChips)} free chips when you sign up
        </p>
      </Container>

      <HeroTable className="mt-10 animate-fade-up sm:mt-14" />
    </section>
  );
}
