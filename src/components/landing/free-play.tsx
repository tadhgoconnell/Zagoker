import { Ban, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";
import { routes, siteConfig } from "@/config/site";

const never = [
  "No deposits or withdrawals",
  "No purchasable chips",
  "No cryptocurrency",
  "No cash prizes or rewards",
];

export function FreePlay() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <Panel className="relative overflow-hidden px-6 py-12 sm:px-12">
          <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-gold-500/10 blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] text-gold-400 uppercase">
                Play money only
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold text-balance sm:text-4xl">
                Free to play. Always.
              </h2>
              <p className="mt-4 leading-relaxed text-mist">
                {siteConfig.name} is for entertainment. Chips are virtual, have
                no monetary value and cannot be exchanged for anything. There is
                no way to spend real money here.
              </p>
              <ButtonLink href={routes.register} size="lg" className="mt-8">
                Create a free account
              </ButtonLink>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {never.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-ink-900/60 px-4 py-3.5 text-sm"
                >
                  <Ban className="size-4 shrink-0 text-danger" />
                  {item}
                </li>
              ))}
              <li className="flex items-center gap-3 rounded-xl border border-felt-400/30 bg-felt-700/20 px-4 py-3.5 text-sm sm:col-span-2">
                <Check className="size-4 shrink-0 text-success" />
                Free virtual chips at sign-up and every day
              </li>
            </ul>
          </div>
        </Panel>
      </Container>
    </section>
  );
}
