import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dragonParts, dragonRig, dragonViewBox, type DragonFacet, type DragonGroup, type DragonPartId } from "./dragon-art";
import { partMatrix, transformAttribute, type DragonPose } from "./dragon-rig";

/**
 * The Zagoker dragon emblem. Decorative: hidden from screen readers.
 *
 * Drawn as an SVG whose facets are grouped by body part (`<g data-part=...>`)
 * in their original painting order. Without a `pose` the groups carry no
 * transform, so the dragon renders exactly as drawn.
 */
export function Dragon({
  className,
  mirrored = false,
  pose,
}: {
  className?: string;
  mirrored?: boolean;
  /** Optional: move body parts about their pivots (for animation). */
  pose?: DragonPose;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={dragonViewBox}
      className={cn("pointer-events-none", mirrored && "-scale-x-100", className)}
    >
      {renderNodes(dragonRig, null, pose)}
    </svg>
  );
}

function isGroup(node: DragonFacet | DragonGroup): node is DragonGroup {
  return !Array.isArray(node);
}

function renderNodes(
  nodes: readonly (DragonFacet | DragonGroup)[],
  enclosingPart: DragonPartId | null,
  pose: DragonPose | undefined,
  keyPrefix = "",
): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}${i}`;
    if (!isGroup(node)) {
      const [fill, points] = node;
      return <polygon key={key} points={points} fill={fill} stroke={fill} strokeWidth={0.5} strokeLinejoin="round" />;
    }
    const [px, py] = dragonParts[node.part].pivot;
    return (
      <g
        key={key}
        data-part={node.part}
        data-pivot={`${px} ${py}`}
        transform={transformAttribute(partMatrix(node.part, pose, enclosingPart))}
      >
        {renderNodes(node.children, node.part, pose, `${key}.`)}
      </g>
    );
  });
}
