import { cn } from "@/lib/utils";

type ChipColor = "gold" | "emerald" | "navy" | "crimson";

const fills: Record<ChipColor, { face: string; edge: string }> = {
  gold: { face: "#e3bf55", edge: "#7a5f1f" },
  emerald: { face: "#158059", edge: "#05291e" },
  navy: { face: "#2d3a5e", edge: "#0e1424" },
  crimson: { face: "#b3262c", edge: "#5c1215" },
};

/** Poker chip icon used next to chip amounts. */
export function Chip({
  color = "gold",
  className,
}: {
  color?: ChipColor;
  className?: string;
}) {
  const { face, edge } = fills[color];
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-5 shrink-0 drop-shadow-sm", className)}
    >
      <circle cx="12" cy="12" r="11" fill={edge} />
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="none"
        stroke="#f3eee1"
        strokeWidth="3"
        strokeDasharray="5 5"
        opacity="0.9"
      />
      <circle cx="12" cy="12" r="7" fill={face} />
      <circle
        cx="12"
        cy="12"
        r="4.5"
        fill="none"
        stroke={edge}
        strokeWidth="0.8"
        opacity="0.6"
      />
    </svg>
  );
}
