import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      '@core': new URL('./src/core', import.meta.url).pathname,
      '@entities': new URL('./src/entities', import.meta.url).pathname,
      '@library': new URL('./src/library', import.meta.url).pathname
    }
  },
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    include: ["tests/firebase_emulator/**/*.test.ts"]
  }
});
