import { SectionHeading } from "@/components/landing/section-heading";
import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";
import { gameConfig } from "@/config/site";
import { formatChips } from "@/lib/utils";

const steps = [
  {
    title: "Pick a name",
    body: `No account needed. Choose a name and get ${formatChips(gameConfig.startingChips)} free virtual chips straight away.`,
  },
  {
    title: "Open or join a table",
    body: "Sit down at a public table from the lobby, or create a private room with your own blinds and stack sizes.",
  },
  {
    title: "Invite your friends",
    body: "Share the room code or invitation link. Friends join from a phone, tablet or computer, wherever they are.",
  },
  {
    title: "Play real Hold'em",
    body: "Blinds, betting rounds, side pots and showdowns are run by the server, so every player sees the same fair game.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <Container>
        <SectionHeading eyebrow="How it works" title="From sign-up to showdown in a minute">
          No downloads and nothing to pay for. Just a table and the people you
          want to play with.
        </SectionHeading>

        <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title}>
              <Panel className="h-full p-6">
                <span className="grid size-10 place-items-center rounded-full border border-gold-500/40 bg-gold-500/10 font-display text-lg font-bold text-gold-300">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">
                  {step.body}
                </p>
              </Panel>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
