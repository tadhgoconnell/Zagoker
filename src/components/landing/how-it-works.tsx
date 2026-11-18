import { SectionHeading } from "@/components/landing/section-heading";
import { Container } from "@/components/ui/container";
import { gameConfig } from "@/config/site";
import { formatChips } from "@/lib/utils";

const steps = [
  {
    title: "Pick a name",
    body: `No account needed. Choose a name and get ${formatChips(gameConfig.startingChips)} free virtual chips straight away.`,
  },
  {
    title: "Open a table",
    body: "Set the blinds, the starting stack and the number of seats, or sit down at a public table from the lobby.",
  },
  {
    title: "Send the link",
    body: "Every private table has an invitation link and a room code. Friends join from any device, wherever they are.",
  },
  {
    title: "Play",
    body: "The server shuffles and deals, runs the betting and settles every pot, so everyone sees the same fair game.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-ink-700 py-20 sm:py-24">
      <Container>
        <SectionHeading eyebrow="How it works" title="From a link to a showdown in a minute." />
        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-ink-600 bg-ink-600 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="bg-ink-900 p-6">
              <span className="font-mono text-sm text-accent-400">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-6 font-display text-xl font-extrabold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
