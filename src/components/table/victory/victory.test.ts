import { describe, expect, it } from "vitest";
import { applyMatrix, partMatrix } from "@/components/ui/dragon-rig";
import {
  BREATH_END_MS,
  BREATH_START_MS,
  FLIGHT_MS,
  MOUTH,
  PARTICLE_COUNT,
  PARTICLE_LIFE_MS,
  VICTORY_MS,
  dragonSize,
  flightAt,
  mouthAt,
  particleAt,
  particleSpecs,
} from "./timeline";
import { shouldCelebrate } from "./use-victory";

// Boxes: iPad landscape, iPad portrait, phone portrait.
const BOXES: [number, number][] = [
  [1000, 500],
  [600, 750],
  [320, 400],
];

describe("victory flight", () => {
  it("fits in the pause after a hand (about 3 seconds)", () => {
    expect(VICTORY_MS).toBeLessThanOrEqual(3000);
    expect(FLIGHT_MS).toBeLessThanOrEqual(VICTORY_MS);
    expect(BREATH_END_MS + PARTICLE_LIFE_MS).toBeLessThanOrEqual(VICTORY_MS);
  });

  it.each(BOXES)("starts and ends fully off a %ix%i box, moving right to left", (W, H) => {
    const { w } = dragonSize(W, H);
    expect(flightAt(0, W, H).x - w / 2).toBeGreaterThanOrEqual(W);
    expect(flightAt(FLIGHT_MS, W, H).x + w / 2).toBeLessThanOrEqual(0);
    let last = Infinity;
    for (let t = 0; t <= FLIGHT_MS; t += 50) {
      const { x, y } = flightAt(t, W, H);
      expect(x).toBeLessThan(last);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(H);
      last = x;
    }
  });

  it.each(BOXES)("breathes over the middle of a %ix%i box", (W, H) => {
    const [mx] = mouthAt((BREATH_START_MS + BREATH_END_MS) / 2, W, H);
    expect(Math.abs(mx - W / 2)).toBeLessThan(W * 0.2);
  });

  it("opens the jaw only while breathing", () => {
    expect(flightAt(BREATH_START_MS - 100, 1000, 500).breath).toBe(0);
    expect(flightAt((BREATH_START_MS + BREATH_END_MS) / 2, 1000, 500).breath).toBe(1);
    expect(flightAt(BREATH_END_MS + 200, 1000, 500).breath).toBe(0);
    expect(flightAt(1300, 1000, 500).pose.jaw?.rotate).toBeCloseTo(-24);
  });

  it("flaps the wing within the planned range", () => {
    const angles = Array.from({ length: 300 }, (_, i) => flightAt(i * 10, 1000, 500).pose.wing!.rotate!);
    expect(Math.min(...angles)).toBeGreaterThanOrEqual(-36);
    expect(Math.max(...angles)).toBeLessThanOrEqual(16);
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(40);
  });

  it("moves the mouth with the jaw (it drops as the jaw opens)", () => {
    const shut = applyMatrix(partMatrix("jaw", { jaw: { rotate: 0 } }), MOUTH);
    const open = applyMatrix(partMatrix("jaw", { jaw: { rotate: -24 } }), MOUTH);
    expect(open[1]).toBeGreaterThan(shut[1] + 5);
  });
});

describe("breath particles", () => {
  it("is the same burst for the same seed and a different one otherwise", () => {
    expect(particleSpecs(7)).toEqual(particleSpecs(7));
    expect(particleSpecs(7)).not.toEqual(particleSpecs(8));
    expect(particleSpecs(7)).toHaveLength(PARTICLE_COUNT);
  });

  it("includes coins, notes and cards, all born during the breath", () => {
    const specs = particleSpecs(3);
    const kinds = new Set(specs.map((s) => s.kind));
    expect(kinds).toEqual(new Set(["coin", "note", "cardUp", "cardDown"]));
    for (const s of specs) {
      expect(s.born).toBeGreaterThanOrEqual(BREATH_START_MS);
      expect(s.born).toBeLessThanOrEqual(BREATH_END_MS);
    }
  });

  it("leaves the mouth, falls and fades out", () => {
    const [spec] = particleSpecs(1);
    const origin: [number, number] = [500, 200];
    expect(particleAt(spec, origin, spec.born - 1, 250)).toBeNull();
    const first = particleAt(spec, origin, spec.born, 250)!;
    expect(first.x).toBeCloseTo(500);
    expect(first.y).toBeCloseTo(200);
    expect(first.opacity).toBe(1);
    const late = particleAt(spec, origin, spec.born + PARTICLE_LIFE_MS - 50, 250)!;
    expect(late.y).toBeGreaterThan(200);
    expect(late.opacity).toBeLessThan(0.3);
    expect(particleAt(spec, origin, spec.born + PARTICLE_LIFE_MS + 1, 250)).toBeNull();
  });
});

describe("who sees it", () => {
  const base = { handNumber: 5, finished: true, myWinnings: 300, seenRunning: new Set([5]), celebrated: new Set<number>() };

  it("celebrates the viewer's own win seen live", () => {
    expect(shouldCelebrate(base)).toBe(true);
  });
  it("not when the viewer won nothing", () => {
    expect(shouldCelebrate({ ...base, myWinnings: 0 })).toBe(false);
  });
  it("not for a hand that was already over when the screen opened", () => {
    expect(shouldCelebrate({ ...base, seenRunning: new Set([4]) })).toBe(false);
  });
  it("only once per hand", () => {
    expect(shouldCelebrate({ ...base, celebrated: new Set([5]) })).toBe(false);
  });
  it("not before the hand ends", () => {
    expect(shouldCelebrate({ ...base, finished: false })).toBe(false);
  });
});
