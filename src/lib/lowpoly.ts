/**
 * Helpers for the low-poly look: deterministic facet meshes and shading.
 * Deterministic so the server and the browser draw identical shapes.
 */

/** Small seeded random generator (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Facet = { points: string; shade: number };

/**
 * A triangle mesh over a `w` x `h` box from a jittered grid. Each facet gets
 * a shade in [-1, 1]: positive faces the light (upper left), negative away.
 */
export function facetMesh(w: number, h: number, cols: number, rows: number, seed: number): Facet[] {
  const rnd = seeded(seed);
  const cw = w / cols;
  const rh = h / rows;
  const grid: [number, number][][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: [number, number][] = [];
    for (let c = 0; c <= cols; c++) {
      const edgeX = c === 0 || c === cols;
      const edgeY = r === 0 || r === rows;
      row.push([
        c * cw + (edgeX ? 0 : (rnd() - 0.5) * cw * 0.7),
        r * rh + (edgeY ? 0 : (rnd() - 0.5) * rh * 0.7),
      ]);
    }
    grid.push(row);
  }
  const facets: Facet[] = [];
  const tri = (a: [number, number], b: [number, number], c: [number, number]) => {
    // Shade from the triangle's orientation plus a little noise.
    const nx = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    const lean = Math.sin((a[0] + b[0] + c[0]) * 0.013 + (a[1] + b[1] + c[1]) * 0.017);
    const shade = Math.max(-1, Math.min(1, lean * 0.7 + (rnd() - 0.5) * 0.6 + Math.sign(nx) * 0.05));
    facets.push({ points: [a, b, c].map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "), shade });
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c], q = grid[r][c + 1], s = grid[r + 1][c], t = grid[r + 1][c + 1];
      if ((r + c) % 2 === 0) {
        tri(p, q, t);
        tri(p, t, s);
      } else {
        tri(p, q, s);
        tri(q, t, s);
      }
    }
  }
  return facets;
}

/** Hex colour lightened (amount > 0) or darkened (amount < 0), amount in [-1, 1]. */
export function shadeHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) =>
    Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
