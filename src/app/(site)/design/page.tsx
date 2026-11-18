import type { Metadata } from "next";
import { PlayingCard } from "@/components/cards/playing-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false },
};

const swatches = [
  ["ink-950", "bg-ink-950"],
  ["ink-800", "bg-ink-800"],
  ["ink-600", "bg-ink-600"],
  ["felt-800", "bg-felt-800"],
  ["felt-600", "bg-felt-600"],
  ["felt-400", "bg-felt-400"],
  ["accent-300", "bg-accent-300"],
  ["accent-500", "bg-accent-500"],
  ["accent-700", "bg-accent-700"],
  ["cream", "bg-cream"],
  ["mist", "bg-mist"],
  ["danger", "bg-danger"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xs font-semibold tracking-[0.25em] text-accent-400 uppercase">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Internal reference page showing every reusable building block. */
export default function DesignSystemPage() {
  return (
    <Container className="py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Design system</h1>
      <p className="mt-3 max-w-xl text-mist">
        The reusable tokens and components every page is built from.
      </p>

      <Section title="Colour">
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {swatches.map(([name, cls]) => (
            <li key={name}>
              <div className={`${cls} h-14 rounded-xl border border-ink-600`} />
              <p className="mt-2 font-mono text-xs text-mist">{name}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Typography">
        <p className="font-display text-5xl font-extrabold tracking-tight">Playfair Display</p>
        <p className="mt-3 text-lg">Geist Sans for interface and body text.</p>
        <p className="mt-1 font-mono text-sm text-mist">Geist Mono 1,234,567</p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Badges and chips">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="accent">Accent</Badge>
                    <Badge>Neutral</Badge>
          <Chip className="size-8" />
        </div>
      </Section>

      <Section title="Playing cards">
        <div className="flex flex-wrap items-end gap-3">
          <PlayingCard rank="A" suit="spades" size="lg" />
          <PlayingCard rank="K" suit="hearts" size="lg" />
          <PlayingCard rank="10" suit="diamonds" size="md" />
          <PlayingCard rank="7" suit="clubs" size="md" />
          <PlayingCard rank="2" suit="hearts" size="sm" />
          <PlayingCard faceDown size="lg" />
          <PlayingCard faceDown size="md" />
          <PlayingCard faceDown size="sm" />
        </div>
      </Section>

      <Section title="Panel">
        <Panel className="max-w-md p-6">
          <h3 className="text-lg font-semibold">Panel</h3>
          <p className="mt-2 text-sm text-mist">
            Raised surface for forms, lists and table cards.
          </p>
        </Panel>
      </Section>
    </Container>
  );
}
