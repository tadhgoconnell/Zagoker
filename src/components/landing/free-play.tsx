import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { routes, siteConfig } from "@/config/site";

const never = ["Deposits or withdrawals", "Chips for sale", "Cryptocurrency", "Cash prizes or rewards"];

export function FreePlay() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="grid gap-10 rounded-xl border border-ink-600 bg-ink-900 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-mono text-xs tracking-widest text-accent-400 uppercase">Play money only</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Free to play. Always.</h2>
            <p className="mt-4 max-w-md leading-relaxed text-mist">
              {siteConfig.name} is for entertainment. Chips are virtual, have no monetary value and cannot be
              exchanged for anything.
            </p>
            <ButtonLink href={routes.play} size="lg" className="mt-8">
              Play now
            </ButtonLink>
          </div>
          <div>
            <p className="text-sm font-semibold text-cream">There are no:</p>
            <ul className="mt-3 divide-y divide-ink-600 border-y border-ink-600">
              {never.map((item) => (
                <li key={item} className="flex items-center justify-between py-3.5 text-sm text-mist">
                  {item}
                  <span className="font-mono text-xs text-slate">none</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
