/**
 * Responsive layout sweep. Opens every main page as a guest at phone,
 * tablet and desktop sizes (both orientations for tablets) and checks that
 * nothing makes the page scroll sideways, that the header fits, and that
 * no page shows a browser error. Includes a live table with a hand running.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/layout.e2e.cjs
 */
const { chromium, devices } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOT_DIR;
const proxied = !!process.env.BROWSER_PROXY;
let failed = 0;
/** Browser messages saying the Content Security Policy blocked something. */
const csp = [];
const watchCsp = (page) => page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text().slice(0, 160)); });
const check = (ok, label, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${extra !== "" ? ` (${extra})` : ""}`);
};
const id = Math.random().toString(36).slice(2, 7);

const screens = [
  { name: "phone", device: devices["iPhone 13"] },
  { name: "phone-small", viewport: { width: 360, height: 640 } },
  { name: "ipad-portrait", device: devices["iPad (gen 7)"] },
  { name: "ipad-landscape", device: devices["iPad (gen 7) landscape"] },
  { name: "laptop", viewport: { width: 1280, height: 720 } },
  { name: "desktop", viewport: { width: 1920, height: 1080 } },
];

async function guest(browser, opts, name) {
  const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: proxied });
  const page = await ctx.newPage(); watchCsp(page);
  await page.goto(`${BASE}/play`);
  await page.fill("[name=username]", name);
  await page.click("main button[type=submit]");
  await page.waitForURL("**/lobby", { timeout: 30000 });
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch(proxied ? { proxy: { server: process.env.BROWSER_PROXY, bypass: "localhost,127.0.0.1" } } : {});

  // One live table for every screen size to look at.
  const host = await guest(browser, { viewport: { width: 1280, height: 800 } }, `zagtest_${id}h`);
  await host.page.getByRole("button", { name: "Create table" }).click();
  await host.page.fill("[name=name]", `Layout ${id}`);
  await host.page.locator("select").nth(0).selectOption("9");
  await host.page.locator("select").nth(2).selectOption("20");
  await host.page.getByRole("button", { name: /Create and sit down/ }).click();
  await host.page.waitForURL("**/table/*", { timeout: 30000 });
  const tableUrl = host.page.url();
  const code = ((await host.page.getByTitle("Copy room code").textContent()) ?? "").trim();

  const others = [];
  for (const [i, s] of screens.entries()) {
    const opts = s.device ?? { viewport: s.viewport };
    const p = await guest(browser, opts, `zagtest_${id}${i}`);
    const errors = [];
    p.page.on("pageerror", (e) => errors.push(e.message));
    const overflows = [];
    const visit = async (path, label) => {
      await p.page.goto(`${BASE}${path}`);
      await p.page.waitForLoadState("networkidle").catch(() => {});
      await p.page.waitForTimeout(600);
      const wide = await p.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (wide > 0) overflows.push(`${label} +${wide}px`);
      const header = await p.page.evaluate(() => {
        const h = document.querySelector("header");
        return h ? [...h.querySelectorAll("a,button")].filter((el) => el.offsetParent).some((el) => el.getBoundingClientRect().right > window.innerWidth + 1) : false;
      });
      if (header) overflows.push(`${label} header`);
      if (SHOTS) await p.page.screenshot({ path: `${SHOTS}/layout-${s.name}-${label}.png` });
    };
    for (const [path, label] of [["/", "home"], ["/play", "play"], ["/lobby", "lobby"], ["/leaderboard", "leaderboard"], ["/profile", "profile"]]) {
      // /play sends signed-in players to the lobby; check it signed out instead.
      if (label === "play") {
        const anon = await browser.newContext({ ...opts, ignoreHTTPSErrors: proxied });
        const ap = await anon.newPage(); watchCsp(ap);
        await ap.goto(`${BASE}/play`);
        const wide = await ap.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (wide > 0) overflows.push(`play +${wide}px`);
        if (SHOTS) await ap.screenshot({ path: `${SHOTS}/layout-${s.name}-play.png` });
        await anon.close();
        continue;
      }
      await visit(path, label);
    }
    // Sit at the live table.
    await p.page.goto(`${BASE}/join/${code}`);
    await p.page.getByRole("button", { name: /Take a seat/ }).click();
    await p.page.waitForURL("**/table/*");
    others.push({ ...p, s });
    check(overflows.length === 0, `${s.name}: no sideways scrolling or clipped header on any page`, overflows.join(", "));
    check(errors.length === 0, `${s.name}: no browser errors`, errors.slice(0, 2).join("; "));
  }

  // Deal, then check every screen during a live hand.
  await host.page.getByRole("button", { name: "Start game" }).click();
  for (const o of others) {
    await o.page.locator("[data-seat]:visible [role=img]:not([aria-label='Face-down card'])").nth(1).waitFor({ timeout: 30000 });
    await o.page.waitForTimeout(800);
    const m = await o.page.evaluate(() => {
      const de = document.documentElement;
      const inView = (el) => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.right <= window.innerWidth + 1; };
      const seats = [...document.querySelectorAll("[data-seat]")].filter((el) => el.offsetParent);
      const mine = [...document.querySelectorAll("[data-seat] [role=img]:not([aria-label='Face-down card'])")].filter((el) => el.offsetParent);
      // Overlap between this player's own cards and any bet marker.
      const bets = [...document.querySelectorAll("[data-bet]")];
      const overlap = mine.some((c) => bets.some((b) => {
        const r1 = c.getBoundingClientRect(), r2 = b.getBoundingClientRect();
        return !(r1.right < r2.left || r2.right < r1.left || r1.bottom < r2.top || r2.bottom < r1.top);
      }));
      return { wide: de.scrollWidth - de.clientWidth, seats: seats.length, seatsInView: seats.filter(inView).length, overlap };
    });
    check(m.wide <= 0 && m.seatsInView === m.seats && m.seats === screens.length + 1, `${o.s.name}: every player at a 9-seat table is fully on screen during a hand`, `${m.seatsInView}/${m.seats} visible, ${m.wide}px overflow`);
    check(!m.overlap, `${o.s.name}: bet markers do not cover the player's own cards`);
    if (SHOTS) await o.page.screenshot({ path: `${SHOTS}/layout-${o.s.name}-table.png` });
  }

  // The action bar on the smallest phone: wait for that player's turn.
  const small = others.find((o) => o.s.name === "phone-small");
  for (let i = 0; i < 12; i++) {
    if (await small.page.getByRole("button", { name: "Fold", exact: true }).isVisible().catch(() => false)) break;
    for (const o of [host, ...others]) {
      if (o === small) continue;
      const btn = o.page.getByRole("button", { name: /^(Check|Call)/ });
      if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await o.page.waitForTimeout(1500); }
    }
  }
  if (await small.page.getByRole("button", { name: "Fold", exact: true }).isVisible().catch(() => false)) {
    const fits = await small.page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.offsetParent && /Fold|Call|Check|Raise|Bet|All-in/.test(b.textContent)).every((b) => b.getBoundingClientRect().right <= window.innerWidth + 1 && b.getBoundingClientRect().height >= 40));
    check(fits, "smallest phone: the action buttons fit the screen and are at least 40px tall");
    if (SHOTS) await small.page.screenshot({ path: `${SHOTS}/layout-phone-small-actions.png` });
  } else {
    console.log("SKIP - smallest phone action bar: their turn did not come round");
  }

  await host.page.locator("button[aria-label='Close table']:visible").click();
  await host.page.getByRole("dialog").getByRole("button", { name: "Close table" }).click();
  console.log(`\nTable: ${tableUrl}`);
  check(csp.length === 0, "the Content Security Policy blocked nothing the site needs", csp.slice(0, 2).join(" | "));
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
