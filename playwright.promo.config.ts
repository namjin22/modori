import { defineConfig } from "@playwright/test";

import screenshots from "./playwright.screenshots.config";

// 홍보 영상 녹화(docs/promo/README.md). 검사가 아니라서 `npm run verify`에는 들어가지 않는다.
export default defineConfig({
  ...screenshots,
  testIgnore: undefined,
  testMatch: "promo.spec.ts",
});
