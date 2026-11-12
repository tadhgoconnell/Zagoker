import { Hammer } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";
import { routes } from "@/config/site";

/**
 * Honest status page for routes whose functionality belongs to a later build
 * stage. It deliberately contains no fake forms or inert buttons. Each of
 * these pages is replaced by the real feature in the stage named here.
 */
export function StageNotice({
  title,
  stage,
  children,
}: {
  title: string;
  stage: number;
  children: React.ReactNode;
}) {
  return (
    <Container className="flex flex-1 items-center justify-center py-20">
      <Panel className="w-full max-w-lg p-8 text-center sm:p-10">
        <span className="mx-auto grid size-12 place-items-center rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-300">
          <Hammer className="size-5" />
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-xs font-semibold tracking-[0.2em] text-gold-400 uppercase">
          Arrives in build stage {stage}
        </p>
        <p className="mt-4 leading-relaxed text-mist">{children}</p>
        <ButtonLink href={routes.home} variant="secondary" className="mt-8">
          Back to home
        </ButtonLink>
      </Panel>
    </Container>
  );
}
