import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    dir: "test",
    watch: false,
    passWithNoTests: true,
    reporters: ["verbose"],
    deps: {
      interopDefault: true,
      registerNodeLoader: true,
    },
  },
});
