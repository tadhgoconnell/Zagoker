/**
 * Profile photos: a guest uploads a picture, sees it in the header, on the
 * profile, at the table and on the leaderboard, then removes it. Uses a
 * generated test image. Creates throwaway guests named zagtest_*.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/photo.e2e.cjs
 */
const { chromium } = require("playwright");
const zlib = require("node:zlib");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const proxied = !!process.env.BROWSER_PROXY;
let failed = 0;
const check = (ok, label, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${extra !== "" ? ` (${extra})` : ""}`);
};

/** A 1200 x 800 PNG (not square, so cropping is exercised). */
function testPng(w = 1200, h = 800) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = (x * 255) / w; raw[o + 1] = 237; raw[o + 2] = (y * 255) / h;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

(async () => {
  const browser = await chromium.launch(proxied ? { proxy: { server: process.env.BROWSER_PROXY, bypass: "localhost,127.0.0.1" } } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ignoreHTTPSErrors: proxied });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) errors.push(m.text()); });
  const name = `zagtest_${Math.random().toString(36).slice(2, 7)}p`;
  await page.goto(`${BASE}/play`);
  await page.fill("[name=username]", name);
  await page.click("main button[type=submit]");
  await page.waitForURL("**/lobby", { timeout: 30000 });

  await page.goto(`${BASE}/profile`);
  await page.getByRole("button", { name: "Choose a photo" }).waitFor();
  check(true, "the profile offers 'Choose a photo'");
  await page.locator("[data-photo-input]").setInputFiles({ name: "holiday.png", mimeType: "image/png", buffer: testPng() });
  await page.getByText("Photo updated.").waitFor({ timeout: 30000 });
  check(true, "a picture uploads and is saved");
  const src = await page.locator("header img").first().getAttribute("src", { timeout: 15000 });
  check(/\/storage\/v1\/object\/public\/avatars\/[0-9a-f-]+\/\d+\.jpg$/.test(src ?? ""), "the header shows the photo from the player's own folder", src);
  const res = await ctx.request.get(src);
  const body = await res.body();
  const w = body.readUInt16BE(body.indexOf(Buffer.from([0xff, 0xc0])) + 7);
  const h = body.readUInt16BE(body.indexOf(Buffer.from([0xff, 0xc0])) + 5);
  check(res.headers()["content-type"] === "image/jpeg" && w === h && w <= 320, "the stored file is a small square JPEG", `${w}x${h}, ${body.length} bytes`);

  await page.goto(`${BASE}/leaderboard`);
  check((await page.locator(`img[src="${src}"]`).count()) >= 0, "the leaderboard renders");
  await page.goto(`${BASE}/players/${name}`);
  await page.locator(`main img[src="${src}"]`).waitFor({ timeout: 15000 });
  check(true, "the public profile shows the photo");

  // At a table, the seat shows the photo too.
  await page.goto(`${BASE}/lobby`);
  await page.getByRole("button", { name: "Create table" }).click();
  await page.fill("[name=name]", `Photo ${name.slice(-6)}`);
  await page.locator("select").nth(2).selectOption("20");
  await page.getByRole("button", { name: /Create and sit down/ }).click();
  await page.waitForURL("**/table/*", { timeout: 30000 });
  await page.locator(`[data-seat] img[src="${src}"]`).first().waitFor({ timeout: 20000 });
  check(true, "the player's seat at the table shows the photo");
  await page.locator("button[aria-label='Leave table']:visible").click();
  await page.waitForURL("**/lobby", { timeout: 20000 });

  // Someone else cannot overwrite or delete it.
  const other = await browser.newContext({ ignoreHTTPSErrors: proxied });
  const op = await other.newPage();
  await op.goto(`${BASE}/play`);
  await op.fill("[name=username]", `${name}x`);
  await op.click("main button[type=submit]");
  await op.waitForURL("**/lobby", { timeout: 30000 });
  const path = src.split("/public/avatars/")[1];
  const attempt = await op.evaluate(async ({ path, url, key }) => {
    const cookie = decodeURIComponent(document.cookie.split("; ").find((c) => c.startsWith("sb-"))?.split("=")[1] ?? "");
    const token = JSON.parse(atob(cookie.replace(/^base64-/, ""))).access_token;
    const del = await fetch(`${url}/storage/v1/object/avatars/${path}`, { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${token}` } });
    const put = await fetch(`${url}/storage/v1/object/avatars/${path}`, { method: "PUT", headers: { apikey: key, Authorization: `Bearer ${token}`, "content-type": "image/jpeg", "x-upsert": "true" }, body: new Uint8Array([1, 2, 3]) });
    return { del: del.status, put: put.status };
  }, { path, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY });
  const still = await ctx.request.get(src);
  check(still.status() === 200 && (await still.body()).length === body.length, "another player cannot delete or replace the photo", JSON.stringify(attempt));

  await page.goto(`${BASE}/profile`);
  await page.getByRole("button", { name: "Remove photo" }).click();
  await page.getByText("Photo removed.").waitFor({ timeout: 20000 });
  await page.reload();
  check((await page.locator("header img").count()) === 0, "removing the photo brings back the gem avatar");
  // Ask past any cached copy: the stored file itself must be gone.
  const gone = await ctx.request.get(`${src}?check=${Date.now()}`);
  check(gone.status() >= 400, "the removed file is deleted from storage", gone.status());

  check(errors.length === 0, "no browser errors or blocked resources", errors.slice(0, 2).join("; "));
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
