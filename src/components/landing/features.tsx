import {
  Coins,
  KeyRound,
  MessageSquare,
  ShieldCheck,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";
import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";

const features: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Zap,
    title: "Real-time multiplayer",
    body: "Bets, cards and chip stacks update live for everyone at the table, with reconnection if your connection drops.",
  },
  {
    icon: KeyRound,
    title: "Private rooms",
    body: "Every private table has its own room code and invitation link. Only people you invite can sit down.",
  },
  {
    icon: ShieldCheck,
    title: "Server-dealt and fair",
    body: "Cards are shuffled with secure randomness on the server. Your hole cards are never sent to anyone else.",
  },
  {
    icon: MessageSquare,
    title: "Table chat",
    body: "Talk through the hand, celebrate the river and needle your friends, all without leaving the table.",
  },
  {
    icon: Trophy,
    title: "Stats and leaderboards",
    body: "Track hands played, hands won and your win rate, and see how you rank against everyone else.",
  },
  {
    icon: Coins,
    title: "Daily free chips",
    body: "Running low? Claim a free daily chip bonus. Chips are never sold and can never be cashed out.",
  },
];

export function Features() {
  return (
    <section className="border-y border-white/6 bg-ink-900/50 py-20 sm:py-28">
      <Container>
        <SectionHeading eyebrow="Features" title="Everything a home game needs">
          Built around proper No-Limit Texas Hold&apos;em rules and a table that
          works as well on a phone as it does on a desktop.
        </SectionHeading>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <Panel className="group h-full p-6 transition-colors hover:border-gold-500/30">
                <span className="grid size-11 place-items-center rounded-xl bg-felt-700/50 text-gold-300 ring-1 ring-felt-400/30">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">{body}</p>
              </Panel>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
