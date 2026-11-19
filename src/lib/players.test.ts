import { describe, expect, it } from "vitest";
import { displayName, isCrowned } from "./players";

describe("display names", () => {
  it("shows any name containing 'merto', in any capitals, as DURGO 💩", () => {
    for (const n of ["merto", "Merto", "MERTO", "xMeRtOx", "big_merto_99"]) expect(displayName(n)).toBe("DURGO 💩");
  });
  it("leaves other names alone", () => {
    for (const n of ["Scribe", "Spencer", "mert", "otrem"]) expect(displayName(n)).toBe(n);
    expect(displayName(null)).toBe("Player");
  });
});

describe("crown", () => {
  it("goes to Scribe only, in any capitals", () => {
    expect(isCrowned("Scribe")).toBe(true);
    expect(isCrowned("SCRIBE")).toBe(true);
    expect(isCrowned("Scribes")).toBe(false);
    expect(isCrowned("Spencer")).toBe(false);
    expect(isCrowned(undefined)).toBe(false);
  });
});
