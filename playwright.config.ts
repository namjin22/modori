import { defineConfig, devices } from "@playwright/test";

// dev 서버 대신 프로덕션 빌드를 띄운다. Next 16은 같은 프로젝트에서 dev 서버를
// 두 개 띄우지 못해, 개발 중 켜둔 3000번 서버가 있으면 E2E가 시작조차 못 한다.
// CI와 같은 조건에서 도는 이점도 있다.
const PORT = 3101;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  // 파일은 같이, 파일 안은 차례대로. fullyParallel: false라 한 파일 안의 순서는
  // 지켜진다. 예전에는 파일끼리도 막아 뒀는데, 계정 이름이 파일마다 고정이라
  // 서로의 계정을 지웠기 때문이다. 이제 이름에 실행 꼬리표(run-tag.ts)와
  // 테스트 번호가 들어가서 겹치지 않는다. 한 번 도는 데 걸리는 시간이 크게 준다.
  workers: process.env.CI ? 2 : 4,
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
