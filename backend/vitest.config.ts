import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: path.resolve(__dirname, ".env.test") });

export default defineConfig({
  resolve: {
    alias: {
      "@modules": path.resolve(__dirname, "src/modules"),
      "@common": path.resolve(__dirname, "src/common"),
      "@config": path.resolve(__dirname, "src/config"),
      "@database": path.resolve(__dirname, "src/database"),
      "@utils": path.resolve(__dirname, "src/utils"),
    },
  },
});
