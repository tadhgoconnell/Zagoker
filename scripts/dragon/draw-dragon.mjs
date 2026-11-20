// The Zagoker dragon: the original drawing script.
//
// This is the script the dragon was drawn with. It builds every facet of an
// original low-poly dragon "rampant" (rearing on its hind legs, claws raised,
// tail curling up behind), facing left, in a 172 x 220 box ("20 0 172 220").
//
// The drawing instructions are unchanged from the first version. The only
// additions are the `section(...)` markers, which record where each body part
// starts in the painting order, so the build script can group the facets into
// animatable parts without reordering anything.
//
// Do not edit the drawing to "tidy" it: any change alters the artwork. To
// regenerate the component data after a deliberate change, run
//   node scripts/dragon/build-dragon-art.mjs
//
// How facets are made: each part is an outline, cut into triangles by fanning
// from an origin (its centroid unless given) and shaded so light comes from
// the upper left.
const PAL = { lt: "#9cf493", ac: "#5ded51", md: "#47d43c", dk: "#35a92c", dd: "#23731d", belly: "#7fef74" };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const shade = (h, a) => toHex(hex(h).map((v) => (a >= 0 ? v + (255 - v) * a : v * (1 + a))));
const P = (s) => s.trim().split(/\s+/).map((p) => p.split(",").map(Number));
const out = [];
/** [section name, index of its first polygon], in painting order. */
export const sections = [];
const section = (name) => sections.push([name, out.length]);
const fmt = (pts) => pts.map(([x, y]) => `${+x.toFixed(1)},${+y.toFixed(1)}`).join(" ");

function part(color, outline, { origin, flat } = {}) {
  const pts = P(outline);
  if (flat) return void out.push([color, fmt(pts)]);
  const o = origin ? P(origin)[0] : [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const mx = (p[0] + q[0]) / 2 - o[0], my = (p[1] + q[1]) / 2 - o[1];
    const len = Math.hypot(mx, my) || 1;
    // Facing up-left = lighter.
    const light = (-mx * 0.6 - my * 0.8) / len;
    out.push([shade(color, light > 0 ? light * 0.35 : light * 0.38), fmt([o, p, q])]);
  });
}

function tail(color, line, widths) {
  const c = P(line);
  const L = [], R = [];
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
    const w = widths[i] / 2;
    L.push([p[0] - (dy / n) * w, p[1] + (dx / n) * w]);
    R.push([p[0] + (dy / n) * w, p[1] - (dx / n) * w]);
  });
  for (let i = 0; i < c.length - 1; i++) {
    out.push([shade(color, i % 2 ? -0.18 : 0.08), fmt([L[i], R[i], R[i + 1]])]);
    out.push([shade(color, i % 2 ? -0.32 : -0.08), fmt([L[i], R[i + 1], L[i + 1]])]);
  }
  return c[c.length - 1];
}

section("wing");
// --- Behind the body: far wing, far hind leg, tail -------------------------
part(PAL.dk, "102,74 122,40 144,16 156,8 152,30 168,32 158,48 176,54 160,66 174,80 150,84 124,94", { origin: "104,76" });
section("wingBones");
// wing bones
for (const tip of ["156,8", "168,32", "176,54", "174,80"]) {
  const [x, y] = P(tip)[0];
  out.push([PAL.dd, fmt([[103, 74], [x, y], [(103 + x) / 2 + 1.6, (74 + y) / 2 + 1.6]])]);
}
section("tail");
tail(PAL.md, "126,146 142,158 160,160 174,148 180,128 180,110 176,98", [16, 15, 13, 12, 10, 7, 4]);
section("tailTip");
part(PAL.ac, "176,100 166,104 172,88 178,78 186,94", { origin: "176,96" });
section("farHindLeg");
// raised (far) hind leg
part(PAL.dk, "120,138 134,128 148,148 140,164 126,158");
part(PAL.dk, "138,160 148,146 158,172 148,180");
part(PAL.dk, "144,176 158,170 172,182 154,190");
part(PAL.dd, "172,182 184,186 170,187", { flat: true });
part(PAL.dd, "166,186 176,194 162,189", { flat: true });
part(PAL.dd, "158,189 164,198 154,191", { flat: true });

section("torso");
// --- Body ---------------------------------------------------------------
part(PAL.ac, "84,76 100,64 116,80 128,104 132,132 122,150 104,146 94,124 86,100");
part(PAL.belly, "86,82 95,78 104,118 99,128 90,104");
for (let i = 0; i < 5; i++) {
  const y = 86 + i * 9;
  out.push([PAL.lt, fmt([[88 + i * 2, y], [97 + i * 1.6, y - 2], [99 + i * 1.6, y + 1]])]);
}
section("neck");
// neck and spines
part(PAL.ac, "74,48 86,40 100,62 98,78 84,80 76,62");
for (const [a, b, c] of [["86,40", "100,36", "92,50"], ["92,50", "106,50", "98,60"], ["98,62", "112,64", "102,72"], ["106,76", "120,80", "110,86"], ["116,92", "130,96", "120,102"]])
  out.push([PAL.dd, fmt([...P(a), ...P(b), ...P(c)])]);

section("nearHindLeg");
// --- Near hind leg (planted) -------------------------------------------------
part(PAL.ac, "98,128 122,138 120,166 104,172 94,150");
part(PAL.md, "104,166 120,162 110,196 98,194");
part(PAL.md, "96,190 112,192 114,204 82,206 84,198");
for (const [a, b, c] of [["84,206", "70,210", "84,201"], ["92,206", "82,215", "97,206"], ["102,206", "97,215", "107,205"]])
  out.push([PAL.dd, fmt([...P(a), ...P(b), ...P(c)])]);

// --- Fore legs ---------------------------------------------------------------
section("lowerForeleg");
// lower, reaching forward
part(PAL.md, "88,102 96,116 72,122 54,118 56,110 72,110");
for (const [a, b, c] of [["54,118", "40,125", "52,121"], ["54,114", "38,114", "53,111"], ["56,110", "44,101", "58,107"]])
  out.push([PAL.dd, fmt([...P(a), ...P(b), ...P(c)])]);
section("upperForeleg");
// upper, raised
part(PAL.ac, "86,80 92,94 62,86 42,76 46,68 64,74");
for (const [a, b, c] of [["42,76", "28,72", "41,72"], ["43,72", "30,62", "45,69"], ["46,68", "38,56", "49,66"]])
  out.push([PAL.dd, fmt([...P(a), ...P(b), ...P(c)])]);

section("horns");
// --- Head --------------------------------------------------------------------
// horns and frill
part(PAL.dd, "72,28 92,6 80,30", { flat: true });
part(PAL.dk, "78,31 102,14 87,37", { flat: true });
part(PAL.dk, "84,38 98,34 89,46", { flat: true });
section("skull");
part(PAL.ac, "36,40 46,32 62,25 78,28 86,40 80,50 64,48 50,47 38,46");
section("jaw");
part(PAL.md, "42,57 50,52 64,50 78,52 74,60 58,62");
section("upperTeeth");
// teeth
for (const x of [46, 54, 62]) out.push(["#f4f5f2", fmt([[x, 47], [x + 2, 51], [x + 4, 47]])]);
section("lowerTeeth");
for (const x of [52, 60]) out.push(["#f4f5f2", fmt([[x, 52], [x + 2, 48.5], [x + 4, 52]])]);
section("tongue");
// tongue
out.push(["#d1302f", fmt([[50, 49.5], [34, 52], [40, 50], [30, 48], [42, 48.5]])]);
section("face");
// eye, brow, nostril
out.push(["#0f1211", fmt([[63, 33], [71, 31.5], [68, 36.5]])]);
out.push([PAL.lt, fmt([[67, 33], [69.5, 32.5], [68.4, 34.5]])]);
out.push([PAL.dd, fmt([[60, 30], [74, 26], [72, 29.5]])]);
out.push([PAL.dd, fmt([[40, 39], [44, 37.5], [43, 40.5]])]);

section("end");
export const polygons = out;
export const svg = (w = 200, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 0 172 220" width="${w}" height="${(w * 220) / 172}">${bg ? `<rect x="20" width="172" height="220" fill="${bg}"/>` : ""}${out.map(([f, p]) => `<polygon fill="${f}" stroke="${f}" stroke-width="0.5" stroke-linejoin="round" points="${p}"/>`).join("")}</svg>`;
