import { defineConfig, devices } from "@playwright/test";

// dev 서버 대신 프로덕션 빌드를 띄운다. Next 16은 같은 프로젝트에서 dev 서버를
// 두 개 띄우지 못해, 개발 중 켜둔 3000번 서버가 있으면 E2E가 시작조차 못 한다.
// CI와 같은 조건에서 도는 이점도 있다.
const PORT = 3101;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    // 프로덕션 모드로 띄우면 Auth.js가 Vercel이 아닌 호스트를 신뢰하지 않는다
    // (UntrustedHost). 로컬 테스트 서버에만 주는 값이라 코드에는 넣지 않는다.
    env: { AUTH_MODE: "mock", AUTH_TRUST_HOST: "true" },
  },
});
