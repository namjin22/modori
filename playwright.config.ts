import { defineConfig, devices } from "@playwright/test";
import { generateVAPIDKeys } from "web-push";

// dev 서버 대신 프로덕션 빌드를 띄운다. Next 16은 같은 프로젝트에서 dev 서버를
// 두 개 띄우지 못해, 개발 중 켜둔 3000번 서버가 있으면 E2E가 시작조차 못 한다.
// CI와 같은 조건에서 도는 이점도 있다.
const PORT = 3101;
const baseURL = `http://localhost:${PORT}`;

// 웹 푸시 서버 열쇠(VAPID). 시험 서버에만 주는 일회용 값이라 돌 때마다 새로 만든다(운영 열쇠는 VM .env에만 있다).
const vapid = generateVAPIDKeys();

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  // 파일은 같이, 파일 안은 차례대로. fullyParallel: false라 한 파일 안의 순서는
  // 지켜진다. 예전에는 파일끼리도 막아 뒀는데, 계정 이름이 파일마다 고정이라
  // 서로의 계정을 지웠기 때문이다. 이제 이름에 실행 꼬리표(run-tag.ts)와
  // 테스트 번호가 들어가서 겹치지 않는다. 개발 PC에서 13분이 3분으로 준다.
  //
  // CI는 하나로 둔다. 러너는 4 vCPU·16GB이고 시험 DB가 러너 안에 있어 둘·셋도 돌지만(2026-11-23 실측),
  // 조각마다 불안정한 시험이 1~2개씩 드러난다(앱 URL 열기 시험의 준비 경쟁, 로그인 뒤 이동 시간 초과).
  // 그래서 워커 대신 조각을 늘려 시간을 줄인다(scripts/e2e-shard.mjs, docs/ci-cd.md).
  workers: process.env.CI ? 1 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // 브라우저(기기) 시간대는 서울로 고정한다. 시험하는 사람의 PC 시간대가 달라도 "시간대 안내" 카드(기기와 저장된 시간대가 다르면 뜸)가 끼어들지 않게 한다.
  use: { baseURL, trace: "on-first-retry", timezoneId: "Asia/Seoul" },
  // 기본 5초는 이 앱에 빠듯하다. DB가 싱가포르에 있어 개발 PC에서는 질의 하나가
  // 90ms, 한 화면이 대여섯 번 오간다. 무엇을 확인하는지는 그대로 두고 여유만 준다.
  expect: { timeout: 10_000 },
  // 두 계정을 오가는 테스트는 개발 PC에서도 13~17초다. CI 러너는 미국에 있어 DB(싱가포르)
  // 왕복이 더 길고, 같은 테스트가 기본 30초를 넘겨 계속 깨졌다. 확인하는 내용은 그대로다.
  timeout: process.env.CI ? 60_000 : 30_000,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    // 빌드까지 포함한 시간이다. 화면이 늘면서 120초로는 모자랐다.
    timeout: 300_000,
    // 프로덕션 모드로 띄우면 Auth.js가 Vercel이 아닌 호스트를 신뢰하지 않는다
    // (UntrustedHost). 로컬 테스트 서버에만 주는 값이라 코드에는 넣지 않는다.
    env: {
      AUTH_MODE: "mock",
      AUTH_TRUST_HOST: "true",
      VAPID_PUBLIC_KEY: vapid.publicKey,
      VAPID_PRIVATE_KEY: vapid.privateKey,
      // AI 도우미(2026-11-17)는 시험에서 진짜 AI 서비스를 부르지 않는다. tests/e2e/ai-chat.spec.ts가 이 주소에 가짜 서버를 띄운다.
      AI_API_KEY: "e2e-fake-key",
      AI_API_BASE: "http://127.0.0.1:3199/ai/v1",
      AI_MODEL: "fake-model",
    },
  },
});
