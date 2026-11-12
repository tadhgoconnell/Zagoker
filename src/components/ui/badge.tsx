import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Tone = "gold" | "felt" | "neutral";

const tones: Record<Tone, string> = {
  gold: "border-gold-500/40 bg-gold-500/10 text-gold-300",
  felt: "border-felt-400/40 bg-felt-500/15 text-felt-400",
  neutral: "border-white/10 bg-white/5 text-mist",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
