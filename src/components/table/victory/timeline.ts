/**
 * The victory flight as pure functions of time: where the dragon is, how its
 * body parts are posed, and where the breath comes from. No rendering here,
 * so it can be unit-tested and stepped frame by frame.
 *
 * Distances are in pixels of the overlay box (the table plus a small margin),
 * so the flight scales with the screen. The dragon faces left and flies right
 * to left, crossing over the board.
 */
import { applyMatrix, partMatrix, type DragonPose } from "@/components/ui/dragon-rig";
import { seeded } from "@/lib/lowpoly";

/** Whole animation, including the last breath settling. */
export const VICTORY_MS = 3000;
/** Time the dragon takes to cross the box. */
export const FLIGHT_MS = 2700;
/** Breath: jaw opens, particles are emitted, jaw closes. */
export const BREATH_START_MS = 750;
export const BREATH_END_MS = 1850;
/** How long each particle lives. */
export const PARTICLE_LIFE_MS = 1100;

/** Wing beats per second. */
const FLAP_HZ = 3.4;

/** The drawing's box (see dragon-art.ts): x from 20, width 172, height 220. */
const ART_X = 20;
const ART_W = 172;
const ART_H = 220;
/** The tip of the open mouth, in drawing coordinates (moves with the jaw). */
export const MOUTH: readonly [number, number] = [40, 52];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Smooth 0 → 1 between a and b. */
const ramp = (t: number, a: number, b: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};

/** Dragon size for a box: big enough to read on a phone, not filling an iPad. */
export function dragonSize(boxW: number, boxH: number) {
  const h = Math.min(boxH * 0.56, boxW * 0.5);
  return { w: (h * ART_W) / ART_H, h };
}

export type FlightFrame = {
  /** Centre of the dragon, in box pixels. */
  x: number;
  y: number;
  /** Whole-body tilt in degrees, clockwise (negative leans forward). */
  rotate: number;
  pose: DragonPose;
  /** 0 = jaw shut, 1 = fully open. */
  breath: number;
};

/** Upstroke/downstroke of the wing, -1 … 1. */
function flapWave(t: number) {
  return Math.sin((2 * Math.PI * FLAP_HZ * t) / 1000);
}

export function flightAt(t: number, boxW: number, boxH: number): FlightFrame {
  const { w } = dragonSize(boxW, boxH);
  const p = clamp01(t / FLIGHT_MS);
  // Faster at the ends, slower over the board while breathing.
  const travel = p - (0.16 * Math.sin(2 * Math.PI * p)) / (2 * Math.PI);
  // Fully off the box at both ends; halfway through, the body is a little
  // right of centre so the mouth (which leads) is over the board.
  const span = boxW + w * 1.9;
  const flap = flapWave(t);
  const x = boxW / 2 + w * 0.3 - (travel - 0.5) * span;
  // A gentle arc over the middle of the felt, bobbing with each wing beat.
  const y = boxH * (0.45 - 0.08 * Math.sin(Math.PI * p)) + flap * boxH * 0.012;

  const breath = ramp(t, BREATH_START_MS, BREATH_START_MS + 180) * (1 - ramp(t, BREATH_END_MS - 150, BREATH_END_MS + 100));
  const lift = ramp(t, BREATH_START_MS - 250, BREATH_START_MS) * (1 - ramp(t, BREATH_END_MS, BREATH_END_MS + 300));
  const tailWave = Math.sin((2 * Math.PI * 1.3 * t) / 1000);
  const tipWave = Math.sin((2 * Math.PI * 1.3 * t) / 1000 - 0.9);

  return {
    x,
    y,
    rotate: -34 + flap * 2.5 + lift * 6,
    breath,
    pose: {
      torso: { rotate: -6 },
      wing: { rotate: -10 + flap * 26 },
      // Legs swept back for flight (negative turns a hanging leg backwards).
      farHindLeg: { rotate: -30 },
      nearHindLeg: { rotate: -42 },
      lowerForeleg: { rotate: -28 },
      upperForeleg: { rotate: -12 },
      tail: { rotate: 6 + tailWave * 8 },
      tailTip: { rotate: tipWave * 12 },
      // The head points left of its pivots, so turning clockwise (positive)
      // lifts the snout, and the jaw opens anticlockwise (negative).
      head: { rotate: lift * 8 },
      jaw: { rotate: -breath * 24 },
    },
  };
}

/**
 * A point of the drawing, given its position after the part moves (drawing
 * coordinates), mapped to box pixels for a dragon centred at (x, y) and
 * tilted by `rotate` degrees about its centre.
 */
export function artToBox(
  [ax, ay]: readonly [number, number],
  frame: Pick<FlightFrame, "x" | "y" | "rotate">,
  size: { w: number; h: number },
): [number, number] {
  const lx = ((ax - ART_X) / ART_W) * size.w - size.w / 2;
  const ly = (ay / ART_H) * size.h - size.h / 2;
  const r = (frame.rotate * Math.PI) / 180;
  return [frame.x + lx * Math.cos(r) - ly * Math.sin(r), frame.y + lx * Math.sin(r) + ly * Math.cos(r)];
}

/** Where the mouth is at time t, in box pixels. */
export function mouthAt(t: number, boxW: number, boxH: number): [number, number] {
  const frame = flightAt(t, boxW, boxH);
  return artToBox(applyMatrix(partMatrix("jaw", frame.pose), MOUTH), frame, dragonSize(boxW, boxH));
}

export type ParticleKind = "coin" | "note" | "cardUp" | "cardDown";

export type ParticleSpec = {
  kind: ParticleKind;
  /** When it leaves the mouth (ms from the start). */
  born: number;
  /** Launch velocity as fractions of the dragon height per second. */
  vx: number;
  vy: number;
  /** Degrees per second. */
  spin: number;
  /** Starting angle. */
  angle: number;
};

/** The order particles are breathed out in: mostly coins and notes, a few cards. */
const KINDS: readonly ParticleKind[] = [
  "coin", "note", "coin", "cardUp", "coin", "note", "coin", "cardDown", "note", "coin",
  "coin", "note", "cardUp", "coin", "note", "coin", "cardDown", "coin", "note", "coin",
  "coin", "note", "cardUp", "coin", "note", "coin", "coin", "note",
];
export const PARTICLE_COUNT = KINDS.length;

/** The burst of particles for one victory; same seed, same burst. */
export function particleSpecs(seed: number): ParticleSpec[] {
  const rnd = seeded(seed);
  const span = BREATH_END_MS - 120 - (BREATH_START_MS + 100);
  return KINDS.map((kind, i) => ({
    kind,
    born: BREATH_START_MS + 100 + (span * (i + rnd() * 0.8)) / KINDS.length,
    // Out of the mouth, forward (left) and down towards the table.
    vx: -(0.5 + rnd() * 1.1),
    vy: -0.35 + rnd() * 1.1,
    spin: (rnd() - 0.5) * (kind === "coin" ? 900 : 500),
    angle: rnd() * 360,
  }));
}

export type ParticleState = { x: number; y: number; angle: number; opacity: number; scale: number } | null;

/** Gravity, in dragon heights per second squared. */
const GRAVITY = 2.2;

/**
 * Where one particle is at time t, or null if it isn't out yet or has gone.
 * `origin` is where the mouth was (box pixels) when it was born.
 */
export function particleAt(spec: ParticleSpec, origin: readonly [number, number], t: number, dragonH: number): ParticleState {
  const age = (t - spec.born) / 1000;
  if (age < 0 || age * 1000 > PARTICLE_LIFE_MS) return null;
  const life = (age * 1000) / PARTICLE_LIFE_MS;
  return {
    x: origin[0] + spec.vx * dragonH * age,
    y: origin[1] + spec.vy * dragonH * age + 0.5 * GRAVITY * dragonH * age * age,
    angle: spec.angle + spec.spin * age,
    // Pops out of the mouth, then fades towards the end of its life.
    scale: 0.45 + 0.55 * ramp(life, 0, 0.18),
    opacity: 1 - ramp(life, 0.65, 1),
  };
}
