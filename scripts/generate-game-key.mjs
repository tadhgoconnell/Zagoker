#!/usr/bin/env node
/**
 * Generates a game server key.
 *
 * Prints (1) the line to put in .env.local / Vercel, which is secret, and
 * (2) the SQL to run once in the Supabase SQL editor, which contains only the
 * key's hash and is safe to share.
 *
 *   node scripts/generate-game-key.mjs [label]
 */
import { createHash, randomBytes } from "node:crypto";

const label = (process.argv[2] ?? "server").replace(/[^a-zA-Z0-9 _-]/g, "");
const key = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(key, "utf8").digest("hex");

console.log("1) Add this line to .env.local (and to Vercel). Keep it secret:\n");
console.log(`GAME_SERVER_KEY=${key}\n`);
console.log("2) Run this once in Supabase > SQL Editor:\n");
console.log(
  `insert into private.server_keys (key_hash, label) values (decode('${hash}', 'hex'), '${label}');\n`,
);
