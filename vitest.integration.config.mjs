import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Opt-in integration tests: run with `npm run test:integration` (see scripts/test-integration.sh).
export default defineConfig({
  test: { environment: "node", include: ["tests/integration/**/*.itest.js"], testTimeout: 20_000 },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
