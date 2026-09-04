import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    include: ["tests/firebase_emulator/**/*.test.ts"]
  }
});
