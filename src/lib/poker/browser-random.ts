import type { RandomInt } from "./cards";

/**
 * Unbiased random integer in [0, maxExclusive) from the browser's
 * cryptographic generator. Used for practice games, which run entirely in
 * the browser. (Real tables are always shuffled on the server.)
 */
export const browserRandomInt: RandomInt = (maxExclusive) => {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 2 ** 32) {
    throw new Error("maxExclusive must be an integer in 1..2^32");
  }
  // Reject values from the incomplete top range so every result is equally likely.
  const limit = Math.floor(2 ** 32 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % maxExclusive;
  }
};
