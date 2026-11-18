import { facetMesh } from "@/lib/lowpoly";
import { cn } from "@/lib/utils";

/**
 * Low-poly texture: a mesh of triangles in white and black at very low
 * opacity, laid over a flat colour. Stretches to fill its parent.
 */
export function Facets({
  seed = 1,
  cols = 10,
  rows = 6,
  strength = 0.06,
  className,
}: {
  seed?: number;
  cols?: number;
  rows?: number;
  /** Maximum opacity of a facet. */
  strength?: number;
  className?: string;
}) {
  const facets = facetMesh(100, 100, cols, rows, seed);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      {facets.map((f, i) => (
        <polygon
          key={i}
          points={f.points}
          fill={f.shade >= 0 ? "#ffffff" : "#000000"}
          fillOpacity={Math.abs(f.shade) * strength}
        />
      ))}
    </svg>
  );
}
