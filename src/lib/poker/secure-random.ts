import "server-only";
import { randomInt } from "node:crypto";
import type { RandomInt } from "./cards";

/**
 * Cryptographically secure, unbiased integer in [0, maxExclusive).
 * This is the only random source the live game uses for shuffling. It lives
 * in its own server-only module so the engine itself stays platform-neutral
 * and so a browser bundle can never be the one shuffling cards.
 */
export const secureRandomInt: RandomInt = (maxExclusive) => randomInt(maxExclusive);
