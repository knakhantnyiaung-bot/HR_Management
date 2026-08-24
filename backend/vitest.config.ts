import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: path.resolve(__dirname, ".env.test") });

export default defineConfig({
  // These are integration tests against one shared Postgres instance with no
  // per-file isolation (no schema-per-file, no transactional rollback), so
  // running test files in parallel causes cross-file interference — e.g. one
  // suite's leftover state racing another's assertions.
  test: {
    fileParallelism: false,
  },
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
