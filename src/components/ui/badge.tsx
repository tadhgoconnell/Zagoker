import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Tone = "accent" | "neutral";

const tones: Record<Tone, string> = {
  accent: "border-accent-400/40 text-accent-300",
  neutral: "border-ink-500 text-mist",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
