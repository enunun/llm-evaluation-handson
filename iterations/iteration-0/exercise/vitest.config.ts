import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // テストを書く前でもテストの実行が成功するようにする．
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["test/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
