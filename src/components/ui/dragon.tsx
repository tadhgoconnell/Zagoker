import { cn } from "@/lib/utils";
import { dragonPolygons, dragonViewBox } from "./dragon-art";

/** The Zagoker dragon emblem. Decorative: hidden from screen readers. */
export function Dragon({ className, mirrored = false }: { className?: string; mirrored?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={dragonViewBox}
      className={cn("pointer-events-none", mirrored && "-scale-x-100", className)}
    >
      {dragonPolygons.map(([fill, points], i) => (
        <polygon key={i} points={points} fill={fill} stroke={fill} strokeWidth={0.5} strokeLinejoin="round" />
      ))}
    </svg>
  );
}
