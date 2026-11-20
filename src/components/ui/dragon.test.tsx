import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dragon } from "./dragon";
import { dragonParts, dragonPolygons, dragonRig, type DragonGroup, type DragonPartId } from "./dragon-art";
import { applyMatrix, moveMatrix, partMatrix, transformAttribute } from "./dragon-rig";

/** Fingerprint of the 142 facets as originally drawn (colours, points, order). */
const ORIGINAL_SHA256 = "8d0900938ab3b71475a20db486546b28d31ae89b990c465373b8fbb63691472c";
const fingerprint = (facets: readonly (readonly [string, string])[]) =>
  createHash("sha256").update(facets.map(([f, p]) => `${f}|${p}`).join("\n")).digest("hex");

const near = (a: readonly number[], b: readonly number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

describe("dragon artwork", () => {
  it("is still exactly the original 142 facets, in the original order", () => {
    expect(dragonPolygons).toHaveLength(142);
    expect(fingerprint(dragonPolygons)).toBe(ORIGINAL_SHA256);
  });

  it("matches what the drawing script produces (the generated file is up to date)", () => {
    const script = path.resolve(import.meta.dirname, "../../../scripts/dragon/build-dragon-art.mjs");
    expect(execFileSync("node", [script, "--check"], { encoding: "utf8" })).toContain("up to date");
  });

  it("renders the same polygons, in the same order, with no transforms when not posed", () => {
    const html = renderToStaticMarkup(<Dragon />);
    const rendered = [...html.matchAll(/<polygon points="([^"]+)" fill="([^"]+)"/g)].map((m) => [m[2], m[1]] as const);
    expect(fingerprint(rendered)).toBe(ORIGINAL_SHA256);
    expect(html).not.toContain("transform=");
    // The mirrored variant is the same drawing, flipped by its class only.
    expect(renderToStaticMarkup(<Dragon mirrored />).replace(" -scale-x-100", "")).toBe(html);
  });
});

describe("dragon rig", () => {
  const groups: DragonGroup[] = [];
  const walk = (nodes: DragonGroup["children"]) =>
    nodes.forEach((n) => { if (!Array.isArray(n)) { groups.push(n as DragonGroup); walk((n as DragonGroup).children); } });
  walk(dragonRig);

  it("names every body part, and every facet belongs to one", () => {
    const used = new Set(groups.map((g) => g.part));
    expect([...used].sort()).toEqual(Object.keys(dragonParts).sort());
    // The jaw is split around the upper teeth (painted between its pieces).
    expect(groups.filter((g) => g.part === "jaw")).toHaveLength(2);
  });

  it("every part hangs from a real part, and the chain ends at the torso", () => {
    for (const [id, info] of Object.entries(dragonParts)) {
      let p: DragonPartId | null = id as DragonPartId;
      for (let i = 0; i < 10 && p; i++) p = dragonParts[p].attachedTo;
      expect(p, id).toBeNull();
      if (id !== "torso") expect(info.attachedTo, id).not.toBeNull();
    }
  });

  it("rotating or scaling a part keeps its pivot exactly in place", () => {
    for (const id of Object.keys(dragonParts) as DragonPartId[]) {
      const pivot = dragonParts[id].pivot;
      expect(near(applyMatrix(moveMatrix(id, { rotate: 37, scale: 1.3 }), pivot), pivot), id).toBe(true);
    }
  });

  it("moving the torso carries the parts that hang from it", () => {
    const pose = { torso: { x: 10, y: -4 } };
    const head = dragonParts.head.pivot;
    expect(near(applyMatrix(partMatrix("head", pose), head), [head[0] + 10, head[1] - 4])).toBe(true);
    // The jaw sits inside the head group, which already applies the head's
    // chain, so its own matrix (stopping at the head) is unchanged.
    expect(transformAttribute(partMatrix("jaw", pose, "head"))).toBeUndefined();
  });

  it("opening the jaw turns it about the hinge and moves nothing else", () => {
    const pose = { jaw: { rotate: 20 } };
    expect(transformAttribute(partMatrix("jaw", pose, "head"))).toMatch(/^matrix\(/);
    for (const id of Object.keys(dragonParts) as DragonPartId[]) {
      if (id !== "jaw") expect(transformAttribute(partMatrix(id, pose)), id).toBeUndefined();
    }
    const html = renderToStaticMarkup(<Dragon pose={pose} />);
    expect(html.match(/<g data-part="jaw"[^>]*transform=/g)).toHaveLength(2); // both jaw pieces move together
  });
});
