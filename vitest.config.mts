import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Several tests run thousands of simulated hands; under parallel load
    // they can pass 5 s on a slow machine.
    testTimeout: 30_000,
    include: ["src/**/*.test.{ts,tsx}", "tests/db/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});
