/**
 * End-to-end test of accounts against a running site and a real Supabase
 * project. Creates throwaway accounts named zagtest_*.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/auth.e2e.cjs
 *
 * Needs `playwright` and reads NEXT_PUBLIC_SUPABASE_* from .env.local.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOT_DIR;
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, "../../.env.local"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

let failed = 0;
const check = (ok, label, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${extra ? ` (${extra})` : ""}`);
};
const id = Math.random().toString(36).slice(2, 8);
const A = { username: `zagtest_${id}a`, email: `zagtest_${id}a@example.com`, password: `pw-${id}-Alpha!` };
const B = { username: `zagtest_${id}b`, email: `zagtest_${id}b@example.com`, password: `pw-${id}-Bravo!` };

async function register(page, u) {
  await page.goto(`${BASE}/register`);
  await page.fill("[name=username]", u.username);
  await page.fill("[name=email]", u.email);
  await page.fill("[name=password]", u.password);
  await page.click("main button[type=submit]");
}
async function login(page, u, password = u.password) {
  await page.fill("[name=email]", u.email);
  await page.fill("[name=password]", password);
  await page.click("main button[type=submit]");
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  // Two independent browser sessions, like two people on different devices.
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));

  // --- Registration ---------------------------------------------------------
  await register(a, A);
  await a.waitForURL("**/profile?welcome=1", { timeout: 20000 }).catch(() => {});
  check(a.url().endsWith("/profile?welcome=1"), "register signs the user in and lands on profile", a.url());
  await a.waitForSelector("h1");
  check((await a.textContent("h1")).trim() === A.username, "profile shows the username");
  const main = await a.textContent("main");
  check(main.includes("10,000"), "profile shows 10,000 chips");
  check(main.includes("Welcome bonus") && main.includes("+10,000"), "chip history shows the welcome bonus");
  await a.waitForSelector(`header a:has-text("${A.username}")`);
  check((await a.textContent("header")).includes("10,000"), "header shows username and chip balance");
  if (SHOTS) await a.screenshot({ path: `${SHOTS}/profile-desktop.png`, fullPage: true });

  // --- Avatar ---------------------------------------------------------------
  await a.click('button[aria-label="crown avatar"]');
  await a.waitForSelector('button[aria-label="crown avatar (current)"]', { timeout: 15000 }).catch(() => {});
  await a.reload();
  check(await a.locator('button[aria-label="crown avatar (current)"]').count() === 1, "avatar change is saved and survives a reload");

  // --- Session ----------------------------------------------------------------
  const a2 = await ctxA.newPage();
  await a2.goto(`${BASE}/profile`);
  check(a2.url().endsWith("/profile"), "session persists in a new tab");
  await a2.goto(`${BASE}/login`);
  check(a2.url().endsWith("/lobby"), "signed-in user is sent away from /login");
  await a2.close();

  // --- Second, independent user on a phone-sized screen ----------------------
  await b.goto(`${BASE}/profile`);
  check(b.url().includes("/play?next=%2Fprofile"), "a visitor without a session is sent to the guest entry page", b.url());
  await register(b, { ...B, username: A.username.toUpperCase() });
  await b.waitForSelector("#field-username-error");
  check((await b.textContent("#field-username-error")).includes("taken"), "duplicate username (different case) is rejected");
  await register(b, { ...B, email: A.email });
  await b.waitForSelector("#field-email-error, form [role=alert], [role=status]");
  check(!b.url().includes("/profile"), "duplicate email does not create an account", (await b.textContent("main")).match(/already exists|wrong|Almost/)?.[0]);
  await register(b, B);
  await b.waitForURL("**/profile?welcome=1", { timeout: 20000 }).catch(() => {});
  check(b.url().endsWith("/profile?welcome=1"), "second user registers");
  await b.waitForSelector("h1");
  check((await b.textContent("h1")).trim() === B.username, "second user sees their own profile, not the first user's");
  const overflow = await b.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check(!overflow, "profile has no horizontal scroll on mobile");
  if (SHOTS) await b.screenshot({ path: `${SHOTS}/profile-mobile.png`, fullPage: true });
  await b.click('button[aria-label="Open menu"]');
  await b.waitForSelector("#mobile-menu");
  check((await b.textContent("#mobile-menu")).includes(B.username), "mobile menu shows the signed-in user");
  if (SHOTS) await b.screenshot({ path: `${SHOTS}/menu-mobile-user.png` });
  await b.click('#mobile-menu button:has-text("Log out")');
  await b.waitForURL(`${BASE}/`);
  check(true, "mobile log out returns to home");

  // --- Logout and login -------------------------------------------------------
  await a.click('header button[aria-label="Log out"]');
  await a.waitForURL(`${BASE}/`);
  await a.waitForSelector('header a:has-text("Play now")');
  check(true, "log out returns to home with signed-out header");
  await a.goto(`${BASE}/profile`);
  check(a.url().includes("/play?next=%2Fprofile"), "profile is protected after log out");
  await a.goto(`${BASE}/login?next=%2Fprofile`);
  await login(a, A, "wrong-password");
  await a.waitForSelector("form [role=alert]");
  check((await a.textContent("form [role=alert]")).includes("Incorrect email or password"), "wrong password is rejected");
  await login(a, A);
  await a.waitForURL("**/profile", { timeout: 20000 }).catch(() => {});
  check(a.url().endsWith("/profile"), "login works and returns to the page originally requested");
  await a.waitForSelector("h1");
  check((await a.textContent("main")).includes("10,000"), "balance is still 10,000 after logging back in (no second bonus)");

  // --- Password reset request -------------------------------------------------
  await b.goto(`${BASE}/forgot-password`);
  await b.fill("[name=email]", `nobody_${id}@example.com`);
  await b.click("main button[type=submit]");
  await b.waitForSelector("[role=status]");
  check((await b.textContent("[role=status]")).includes("If an account exists"), "password reset gives the same answer for unknown emails");

  // --- Direct API attacks with a real signed-in token --------------------------
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: auth } = await sb.auth.signInWithPassword({ email: A.email, password: A.password });
  const uid = auth.user.id;
  const { data: other } = await sb.from("profiles").select("id").eq("username", B.username).single();
  const r1 = await sb.from("profiles").update({ chips: 9_999_999 }).eq("id", uid);
  check(!!r1.error, "API: user cannot set their own chips", r1.error?.message);
  const r2 = await sb.from("profiles").update({ username: `hax_${id}` }).eq("id", uid);
  check(!!r2.error, "API: user cannot change username", r2.error?.message);
  const r3 = await sb.from("profiles").update({ avatar: "cat" }).eq("id", other.id).select();
  check(!r3.error && r3.data.length === 0, "API: user cannot change another player's avatar");
  const r4 = await sb.rpc("apply_chip_delta", { p_user_id: uid, p_amount: 5000, p_kind: "adjustment" });
  check(!!r4.error, "API: user cannot call the chip function", r4.error?.message);
  const r5 = await sb.from("chip_transactions").insert({ user_id: uid, amount: 5000, balance_after: 15000, kind: "adjustment" });
  check(!!r5.error, "API: user cannot write to the chip ledger", r5.error?.message);
  const r6 = await sb.from("chip_transactions").select("user_id");
  check(!r6.error && r6.data.length === 1 && r6.data[0].user_id === uid, "API: user sees only their own chip history");
  const r7 = await sb.from("player_stats").update({ hands_won: 999 }).eq("user_id", uid);
  check(!!r7.error, "API: user cannot edit statistics", r7.error?.message);
  const r8 = await sb.from("profiles").delete().eq("id", other.id);
  check(!!r8.error, "API: user cannot delete profiles", r8.error?.message);
  const { data: final } = await sb.from("profiles").select("username, chips, avatar").in("id", [uid, other.id]).order("username");
  check(final.length === 2 && final.every((p) => Number(p.chips) === 10000), "both balances are exactly 10,000 after all attempts", JSON.stringify(final));

  // --- Guest play (no account) ---------------------------------------------------
  const settings = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY } })).json();
  const guestsOn = settings.external?.anonymous_users === true;
  const ctxG = await browser.newContext({ viewport: { width: 820, height: 1100 } });
  const g = await ctxG.newPage();
  g.on("pageerror", (e) => errors.push(e.message));
  const guestName = `zagtest_${id}g`;
  await g.goto(`${BASE}/`);
  await g.click('main a:has-text("Play now")');
  await g.waitForURL("**/play");
  check(true, "'Play now' on the home page opens the guest entry page");
  await g.fill("[name=username]", "x");
  await g.click("main button[type=submit]");
  await g.waitForSelector("#field-username-error");
  check(true, "a guest name that is too short is rejected");
  await g.fill("[name=username]", A.username);
  await g.click("main button[type=submit]");
  await g.waitForFunction(() => document.querySelector("#field-username-error")?.textContent?.includes("taken"));
  check(true, "a guest cannot take a name that is already in use");
  await g.goto(`${BASE}/play?next=%2Fleaderboard`);
  await g.fill("[name=username]", guestName);
  await g.click("main button[type=submit]");
  if (!guestsOn) {
    await g.waitForSelector("form [role=alert]");
    check((await g.textContent("form [role=alert]")).includes("Guest play is switched off"), "with guest sign-in disabled in Supabase, the visitor gets a clear message");
    console.log("SKIP - guest play checks: enable 'Allow anonymous sign-ins' in Supabase to run them");
  } else {
    await g.waitForURL("**/leaderboard", { timeout: 20000 });
    check(true, "a guest enters with only a name and continues to the page they wanted");
    await g.goto(`${BASE}/profile`);
    await g.waitForSelector("h1");
    const gp = await g.textContent("main");
    check((await g.textContent("h1")).trim() === guestName && gp.includes("10,000") && gp.includes("Guest"), "the guest has a profile, 10,000 chips and is marked as a guest");
    check(gp.includes("Save your account"), "the guest is offered the option to save their account");
    await g.waitForSelector('header a:has-text("Save account")');
    check((await g.locator('header button[aria-label="Log out"]').count()) === 0, "a guest is shown 'Save account' instead of a log-out button");
    const lobby = await ctxG.request.get(`${BASE}/api/tables`);
    check(lobby.status() === 200, "a guest can use the game API", lobby.status());
    const bonus = await ctxG.request.post(`${BASE}/api/bonus`, { data: {} });
    check(bonus.status() === 200, "a guest can claim the daily bonus", bonus.status());
    const g2 = await ctxG.newPage();
    await g2.goto(`${BASE}/lobby`);
    check(g2.url().endsWith("/lobby"), "the guest session persists across tabs");
    await g2.close();

    // Saving the account keeps the same player.
    const saved = { email: `zagtest_${id}g@example.com`, password: `pw-${id}-Guest!` };
    await g.fill("[name=email]", A.email);
    await g.fill("[name=password]", saved.password);
    await g.click('main form button[type=submit]:has-text("Save my account")');
    await g.waitForSelector("#field-email-error");
    check((await g.textContent("#field-email-error")).includes("already exists"), "a guest cannot save their account with someone else's email");
    await g.fill("[name=email]", saved.email);
    await g.fill("[name=password]", saved.password);
    await g.click('main form button[type=submit]:has-text("Save my account")');
    await g.waitForURL("**/profile?saved=1", { timeout: 20000 });
    await g.waitForSelector("h1");
    const sp = await g.textContent("main");
    check((await g.textContent("h1")).trim() === guestName && sp.includes("11,000") && !sp.includes("Save your account"), "after saving, the same name and chips are kept and the guest notice is gone");
    await g.click('header button[aria-label="Log out"]');
    await g.waitForURL(`${BASE}/`);
    await g.goto(`${BASE}/login`);
    await login(g, { ...saved });
    await g.waitForURL("**/lobby", { timeout: 20000 });
    await g.goto(`${BASE}/profile`);
    await g.waitForSelector("h1");
    check((await g.textContent("h1")).trim() === guestName, "the saved account can log in again with email and password");
  }

  check(errors.length === 0, "no browser errors", errors.join("; "));
  console.log(`\nTest accounts created: ${A.email}, ${B.email}`);
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
