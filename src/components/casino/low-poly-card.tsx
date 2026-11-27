import { facetMesh } from "@/lib/lowpoly";

const SUIT = { s: "♠", h: "♥", d: "♦", c: "♣" } as const;

/**
 * A playing card drawn as flat facets (decorative). Chamfered corners keep the
 * low-poly look. `id` must be unique on the page (it names the clip path).
 */
export function LowPolyCard({
  id,
  rank,
  suit,
  seed = 1,
  className,
  style,
}: {
  id: string;
  rank: string;
  suit: keyof typeof SUIT;
  seed?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const red = suit === "h" || suit === "d";
  const ink = red ? "#d1302f" : "#141816";
  const facets = facetMesh(60, 84, 3, 4, seed);
  const outline = "5,0 55,0 60,5 60,79 55,84 5,84 0,79 0,5";
  return (
    <svg viewBox="0 0 60 84" className={className} style={style} aria-hidden="true">
      <clipPath id={id}>
        <polygon points={outline} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        {facets.map((f, i) => {
          const fill = f.shade > 0.3 ? "#ffffff" : f.shade > -0.3 ? "#f0f2f0" : "#dfe3e0";
          return <polygon key={i} points={f.points} fill={fill} stroke={fill} strokeWidth="0.4" />;
        })}
      </g>
      <polygon points={outline} fill="none" stroke="#0a0c0b" strokeOpacity="0.25" strokeWidth="0.8" />
      <g fill={ink} fontFamily="var(--font-geist-sans), sans-serif" fontWeight="800">
        <text x="6" y="15" fontSize="13">
          {rank}
        </text>
        <text x="6.5" y="26" fontSize="10">
          {SUIT[suit]}
        </text>
        <text x="30" y="50" fontSize="30" textAnchor="middle" dominantBaseline="central">
          {SUIT[suit]}
        </text>
      </g>
    </svg>
  );
}
