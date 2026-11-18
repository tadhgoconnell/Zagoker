import { cn } from "@/lib/utils";
import { dealerPolygons } from "./dealer-art";

/**
 * The table's dealer, a low-poly woman. She sways gently while idle and
 * gives a small nod whenever `cue` changes (a new card on the board, a new
 * hand). Purely decorative: hidden from screen readers.
 */
export function Dealer({ cue, className }: { cue?: string | number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none select-none", className)}>
      {/* Re-mounting on each cue restarts the nod animation. */}
      <div key={cue} className="size-full" style={{ animation: "dealer-nod 0.7s ease-out 1" }}>
        <svg
          viewBox="0 0 200 200"
          className="size-full"
          style={{ animation: "dealer-idle 7s ease-in-out infinite", transformOrigin: "50% 100%" }}
        >
          {dealerPolygons.map(([fill, points], i) => (
            <polygon
              key={i}
              points={points}
              fill={fill}
              stroke={fill}
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
