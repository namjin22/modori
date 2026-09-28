import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

// 릴리스 스크린샷(docs/screenshots/README.md). E2E와 같은 서버(프로덕션 빌드, 우회 로그인)를 띄우고
// 데모 계정으로 정해 둔 화면을 찍는다. 검사가 아니라서 `npm run verify`에는 들어가지 않는다.
export default defineConfig({
  ...base,
  testDir: "tests/screenshots",
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 180_000,
});
