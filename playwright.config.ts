import { defineConfig, devices } from "@playwright/test";

// dev 서버 대신 프로덕션 빌드를 띄운다. Next 16은 같은 프로젝트에서 dev 서버를
// 두 개 띄우지 못해, 개발 중 켜둔 3000번 서버가 있으면 E2E가 시작조차 못 한다.
// CI와 같은 조건에서 도는 이점도 있다.
const PORT = 3101;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  // 파일끼리도 동시에 돌리지 않는다. fullyParallel: false는 한 파일 안에서만
  // 순서를 지켜줄 뿐이라, 기본값(코어 수의 절반)이면 스펙 파일 열한 개가 같은
  // DB와 같은 서버를 동시에 두들긴다. 커넥션 풀이 마르고, 고정 닉네임을 쓰는
  // 파일끼리 서로의 계정을 지운다. 느려도 결과가 믿을 만한 쪽을 택한다.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  // 기본 5초는 이 앱에 빠듯하다. DB가 싱가포르에 있어 개발 PC에서는 질의 하나가
  // 90ms, 한 화면이 대여섯 번 오간다. 무엇을 확인하는지는 그대로 두고 여유만 준다.
  expect: { timeout: 10_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    // 빌드까지 포함한 시간이다. 화면이 늘면서 120초로는 모자랐다.
    timeout: 300_000,
    // 프로덕션 모드로 띄우면 Auth.js가 Vercel이 아닌 호스트를 신뢰하지 않는다
    // (UntrustedHost). 로컬 테스트 서버에만 주는 값이라 코드에는 넣지 않는다.
    env: { AUTH_MODE: "mock", AUTH_TRUST_HOST: "true" },
  },
});
