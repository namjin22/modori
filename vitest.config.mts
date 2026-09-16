import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// tsconfig의 "@/*" 경로 별칭을 vitest에서도 쓰기 위한 설정.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    // E2E(Playwright)와 섞이지 않도록 유닛 테스트만 잡는다.
    include: ["tests/unit/**/*.test.ts"],
  },
});
