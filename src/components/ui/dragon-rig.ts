/**
 * Posing the dragon: pure geometry, no rendering. Used by the Dragon
 * component and by any future animation.
 *
 * A pose moves parts about their pivots. Parts hang from one another
 * (`attachedTo`), so moving the torso carries the neck, head, jaw, wing, legs
 * and tail with it, and moving the head carries the jaw.
 *
 * Transforms are produced as SVG `matrix(...)` attribute values, in the
 * drawing's own coordinates. That is read identically by every browser,
 * including Safari on iPad, unlike CSS transform-origin on SVG elements.
 */
import { dragonParts, type DragonPartId } from "./dragon-art";

/** How one part moves from its drawn position. All fields optional. */
export type PartMove = {
  /** Degrees, clockwise, about the part's pivot. */
  rotate?: number;
  /** Uniform scale about the pivot (1 = drawn size). */
  scale?: number;
  /** Shift in drawing units (the dragon is 172 x 220). */
  x?: number;
  y?: number;
};

export type DragonPose = Partial<Record<DragonPartId, PartMove>>;

/** 2D affine matrix [a, b, c, d, e, f], as in SVG matrix(a b c d e f). */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m1 × m2: apply m2 first, then m1. */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  const [a, b, c, d, e, f] = m1;
  const [A, B, C, D, E, F] = m2;
  return [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
}

export function applyMatrix(m: Matrix, [x, y]: readonly [number, number]): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** The matrix for one part's own move, about its own pivot. */
export function moveMatrix(part: DragonPartId, move: PartMove | undefined): Matrix {
  if (!move) return IDENTITY;
  const [px, py] = dragonParts[part].pivot;
  const r = ((move.rotate ?? 0) * Math.PI) / 180;
  const s = move.scale ?? 1;
  const cos = Math.cos(r) * s;
  const sin = Math.sin(r) * s;
  // translate(x, y) · translate(pivot) · rotate · scale · translate(-pivot)
  return [cos, sin, -sin, cos, px - cos * px + sin * py + (move.x ?? 0), py - sin * px - cos * py + (move.y ?? 0)];
}

/**
 * The full matrix for a part: its own move, preceded by the moves of every
 * part it hangs from, up to (not including) `stopAt`. Pass the part of the
 * enclosing SVG group as `stopAt`, since that group already applies its own
 * transform.
 */
export function partMatrix(part: DragonPartId, pose: DragonPose | undefined, stopAt: DragonPartId | null = null): Matrix {
  if (!pose) return IDENTITY;
  let m = moveMatrix(part, pose[part]);
  for (let up = dragonParts[part].attachedTo; up && up !== stopAt; up = dragonParts[up].attachedTo) {
    m = multiply(moveMatrix(up, pose[up]), m);
  }
  return m;
}

export const isIdentity = (m: Matrix) =>
  m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;

/** SVG transform attribute value, or undefined when the part does not move. */
export function transformAttribute(m: Matrix): string | undefined {
  if (isIdentity(m)) return undefined;
  return `matrix(${m.map((v) => +v.toFixed(5)).join(" ")})`;
}
