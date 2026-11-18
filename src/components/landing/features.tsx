import { SectionHeading } from "@/components/landing/section-heading";
import { Container } from "@/components/ui/container";

const features: { title: string; body: string }[] = [
  {
    title: "Live, for everyone",
    body: "Bets, cards and stacks update on every screen as they happen. Lose your connection and you pick up where you left off.",
  },
  {
    title: "Private rooms",
    body: "Each private table has its own room code and invitation link. Only people you invite can sit down.",
  },
  {
    title: "Dealt by the server",
    body: "Cards are shuffled with cryptographic randomness on the server. Your hole cards are never sent to anyone else.",
  },
  {
    title: "Table chat",
    body: "Talk through the hand, celebrate the river and needle your friends without leaving the table.",
  },
  {
    title: "Stats and rankings",
    body: "Hands played, hands won, biggest pot. See where you stand on the leaderboard.",
  },
  {
    title: "Free chips daily",
    body: "Running low? Claim free chips once a day. Chips are never sold and can never be cashed out.",
  },
];

export function Features() {
  return (
    <section className="border-b border-ink-700 py-20 sm:py-24">
      <Container className="grid gap-12 lg:grid-cols-[1fr_2fr]">
        <SectionHeading eyebrow="What you get" title="Everything a home game needs.">
          Proper No-Limit Hold&apos;em rules, and a table that works as well on a phone as on a desktop.
        </SectionHeading>
        <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="border-t border-ink-600 pt-5">
              <dt className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight">
                <span aria-hidden="true" className="size-2 rotate-45 bg-accent-400" />
                {f.title}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-mist">{f.body}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
