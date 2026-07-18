import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/combat-zone/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@entities": fileURLToPath(new URL("./src/entities", import.meta.url)),
      "@hooks": fileURLToPath(new URL("./src/hooks", import.meta.url)),
      "@interaction": fileURLToPath(new URL("./src/interaction", import.meta.url)),
      "@library": fileURLToPath(new URL("./src/library", import.meta.url)),
      "@store": fileURLToPath(new URL("./src/store", import.meta.url)),
      "@tests": fileURLToPath(new URL("./tests", import.meta.url)),
      "@ui": fileURLToPath(new URL("./src/ui", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts"
  }
});
