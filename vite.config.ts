import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    dir: "test",
    watch: false,
    passWithNoTests: true,
    reporters: ["verbose"],
    coverage: {
      reporter: ["json", "html", "lcov"],
      provider: "v8",
    },
    deps: {
      interopDefault: true,
      registerNodeLoader: true,
    },
    testTimeout: 60 * 1000 * 60,
    threads: true,
  },
});
