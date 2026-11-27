"use client";

import { facetMesh } from "@/lib/lowpoly";
import { WHEEL_ORDER, colourOf, type Colour } from "@/lib/casino/roulette";

/** Flat pocket colours, in the site's palette. */
export const POCKET_FILL: Record<Colour, string> = { red: "#d1302f", black: "#1c211f", green: "#35a92c" };

const STEP = 360 / WHEEL_ORDER.length;
const R_OUT = 92;
const R_IN = 66;
const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
const at = (r: number, deg: number) => `${(r * Math.cos(rad(deg))).toFixed(2)},${(r * Math.sin(rad(deg))).toFixed(2)}`;

// The cone in the middle: a faceted disc in dark greens, made once.
const cone = facetMesh(132, 132, 6, 6, 37).map((f) => ({
  points: f.points
    .split(" ")
    .map((p) => p.split(",").map((v) => Number(v) - 66).join(","))
    .join(" "),
  fill: f.shade > 0.3 ? "#1a4f38" : f.shade > -0.3 ? "#14412e" : "#0d2c1e",
}));

/** The rotation (degrees, clockwise) that brings pocket `n` under the marker at the top. */
export function restingAngle(n: number) {
  return -WHEEL_ORDER.indexOf(n as (typeof WHEEL_ORDER)[number]) * STEP;
}

/**
 * The wheel, with pocket 0 at the top when unrotated. Straight edges between
 * pocket corners keep the low-poly look. Rotation is applied by the parent.
 */
export function RouletteWheel({ highlight }: { highlight: number | null }) {
  return (
    <svg viewBox="-100 -100 200 200" className="size-full" aria-hidden="true">
      <circle r="99" fill="#0a0c0b" />
      <polygon
        points={Array.from({ length: WHEEL_ORDER.length }, (_, i) => at(97, i * STEP)).join(" ")}
        fill="#353d39"
      />
      {WHEEL_ORDER.map((n, i) => {
        const a0 = i * STEP - STEP / 2;
        const a1 = i * STEP + STEP / 2;
        const fill = POCKET_FILL[colourOf(n)];
        return (
          <g key={n} data-pocket={n}>
            <polygon
              points={`${at(R_IN, a0)} ${at(R_OUT, a0)} ${at(R_OUT, a1)} ${at(R_IN, a1)}`}
              fill={fill}
              stroke={highlight === n ? "#5ded51" : "#0a0c0b"}
              strokeWidth={highlight === n ? 1.6 : 0.6}
            />
            <text
              transform={`rotate(${i * STEP}) translate(0 ${-(R_OUT - 9)})`}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="8"
              fontWeight="700"
              fill="#eef1ef"
              fontFamily="var(--font-geist-sans), sans-serif"
            >
              {n}
            </text>
          </g>
        );
      })}
      <clipPath id="roulette-cone">
        <polygon points={Array.from({ length: 18 }, (_, i) => at(R_IN - 1, i * 20)).join(" ")} />
      </clipPath>
      <g clipPath="url(#roulette-cone)">
        {cone.map((f, i) => (
          <polygon key={i} points={f.points} fill={f.fill} stroke={f.fill} strokeWidth="0.4" />
        ))}
      </g>
      {/* Hub: a faceted diamond in the accent greens. */}
      <polygon points="0,-16 16,0 0,16 -16,0" fill="#35a92c" />
      <polygon points="0,-16 16,0 0,0" fill="#5ded51" />
      <polygon points="-16,0 0,16 0,0" fill="#23731d" />
      <circle r="4" fill="#0f1211" />
    </svg>
  );
}
