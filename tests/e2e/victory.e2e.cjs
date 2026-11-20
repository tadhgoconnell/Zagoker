/**
 * Victory animation: in practice mode the dragon flies only when you win a
 * pot, once per hand, and never when a bot wins.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/victory.e2e.cjs
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOT_DIR;
const proxied = !!process.env.BROWSER_PROXY;
let failed = 0;
const check = (ok, label, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${extra !== "" ? ` (${extra})` : ""}`);
};

(async () => {
  const browser = await chromium.launch(proxied ? { proxy: { server: process.env.BROWSER_PROXY, bypass: "localhost,127.0.0.1" } } : {});
  const errors = [];
  for (const reduced of [false, true]) {
    const label = reduced ? "reduced motion" : "full motion";
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, reducedMotion: reduced ? "reduce" : "no-preference", ignoreHTTPSErrors: proxied });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
    await page.goto(`${BASE}/practice`);
    await page.getByRole("button", { name: "Difficulty 0" }).click();
    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: "Deal me in" }).click();
    await page.locator("[data-table=practice]").waitFor();
    // Practice seats you at seat 0; the bot is "Prefect #1".
    const myName = (await page.locator("[data-seat='0'] span.truncate").first().innerText()).trim();

    // Watch each finished hand: who won, and whether the dragon appeared.
    await page.evaluate(() => {
      window.__victories = [];
      new MutationObserver(() => {
        const v = document.querySelector("[data-victory]");
        const hand = document.querySelector("[data-table=practice]")?.getAttribute("data-hand-number");
        if (v && !window.__victories.some((x) => x.hand === hand)) {
          window.__victories.push({ hand, kind: v.getAttribute("data-victory"), result: document.querySelector("[data-result]")?.textContent ?? "" });
        }
      }).observe(document.body, { subtree: true, childList: true });
    });

    const results = new Map();
    const deadline = Date.now() + 120_000;
    let shot = false;
    while (Date.now() < deadline && !(await page.getByText(/out of chips|took every chip/).isVisible().catch(() => false))) {
      const result = await page.locator("[data-result] p").allInnerTexts().catch(() => []);
      const hand = await page.locator("[data-table=practice]").getAttribute("data-hand-number");
      if (result.some((t) => / (wins|split) /.test(t))) results.set(hand, result.join(" "));
      if (!shot && SHOTS && (await page.locator("[data-victory=flight]").count())) {
        await page.waitForTimeout(1100);
        await page.screenshot({ path: `${SHOTS}/victory-practice.png` });
        shot = true;
      }
      // Fold the first hands so the bot wins some, then push all-in to win.
      const lostSoFar = [...results.values()].filter((r) => !r.includes(myName)).length;
      const fold = page.getByRole("button", { name: "Fold", exact: true });
      const allIn = page.getByRole("button", { name: "All-in", exact: true });
      if (lostSoFar < 2) {
        if (await fold.isEnabled({ timeout: 150 }).catch(() => false)) await fold.click().catch(() => {});
      } else if (await allIn.isEnabled({ timeout: 150 }).catch(() => false)) {
        await allIn.click();
        await page.getByRole("button", { name: /^(All-in|Call|Check)/ }).last().click().catch(() => {});
      } else {
        const call = page.getByRole("button", { name: /^(Call|Check)/ }).first();
        if (await call.isEnabled({ timeout: 150 }).catch(() => false)) await call.click().catch(() => {});
      }
      const wins = [...results.values()].filter((r) => r.includes(`${myName} wins`)).length;
      const losses = [...results.values()].filter((r) => !r.includes(myName)).length;
      if (wins >= 2 && losses >= 1) break;
    }
    await page.waitForTimeout(3500);
    const victories = await page.evaluate(() => window.__victories);
    const won = [...results].filter(([, r]) => r.includes(myName)).map(([h]) => h);
    const lost = [...results].filter(([, r]) => !r.includes(myName)).map(([h]) => h);
    console.log(`  ${label}: me=${myName}; hands won ${won.join(",") || "none"}; lost ${lost.join(",") || "none"}; dragon on ${victories.map((v) => v.hand).join(",") || "none"}`);
    check(won.length > 0, `${label}: won at least one hand during the test`);
    check(won.every((h) => victories.some((v) => v.hand === h)), `${label}: the dragon flew for every hand I won`);
    check(victories.every((v) => v.result.includes(myName)), `${label}: never for a hand a bot won`);
    check(victories.every((v) => v.kind === (reduced ? "still" : "flight")), `${label}: ${reduced ? "a still dragon instead of the flight" : "the full flight"}`);
    check((await page.locator("[data-victory]").count()) === 0, `${label}: the overlay is gone afterwards`);
    await ctx.close();
  }
  check(errors.length === 0, "no page errors", errors.join(" | "));
  await browser.close();
  console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
})();
