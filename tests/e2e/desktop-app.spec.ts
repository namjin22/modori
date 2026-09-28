import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { _electron as electron, expect, test as base, type ElectronApplication } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 데스크톱 앱(desktop/main.js)을 실제로 띄워 본다. 앱 폴더에 Electron을 설치한 곳에서만 돈다
// (cd desktop && npm install). CI처럼 없으면 건너뛴다.
const DESKTOP = path.join(process.cwd(), "desktop");
const electronBin = path.join(DESKTOP, "node_modules", "electron");
const installed = existsSync(path.join(electronBin, "path.txt"));

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-app-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

// 앱은 하나만 뜨게 되어 있어(requestSingleInstanceLock) 이 파일 안에서는 차례로 돈다.
test.describe.configure({ mode: "serial" });
test.skip(!installed, "desktop/에 Electron이 설치되지 않았다");

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function launch(url: string): Promise<ElectronApplication> {
  const executablePath = createRequire(path.join(DESKTOP, "package.json"))("electron") as unknown as string;
  // VS Code처럼 Electron으로 만든 편집기 안에서 돌리면 ELECTRON_RUN_AS_NODE가 물려 와서
  // Electron이 그냥 Node로 뜬다(app이 없고 디버깅 옵션을 거절한다). 앱을 띄울 때는 뺀다.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return electron.launch({
    executablePath,
    // 앱 폴더를 넘겨야 package.json(이름·버전)을 읽는다.
    args: [DESKTOP],
    env: { ...env, MODORI_URL: url, MODORI_TEST_EXTERNAL: "record" },
  });
}

const externalOpened = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as unknown as { modoriExternalOpened: string[] }).modoriExternalOpened);

test("앱에서 브라우저 로그인을 마치면 modori:// 링크로 앱 창이 로그인된다", async ({ page, email }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL ?? "";
  const app = await launch(baseURL);
  try {
    const win = await app.firstWindow();
    await expect(win).toHaveTitle(/모도리/);

    // 앱 창에도 웹과 같은 로그인 버튼이 있다. 누르면 평소 브라우저가 그 로그인으로 열린다.
    // Playwright의 마우스 입력은 이 Electron 창에 닿지 않아(창 안에서 보낸 클릭·주소 이동은 된다) 클릭 이벤트를 직접 보낸다.
    await win.getByRole("link", { name: "Google로 계속하기" }).dispatchEvent("click");
    await expect.poll(async () => (await externalOpened(app)).length).toBe(1);
    const [opened] = await externalOpened(app);
    const loginUrl = new URL(opened);
    expect(loginUrl.pathname).toBe("/desktop/login");
    expect(loginUrl.searchParams.get("challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(loginUrl.searchParams.get("provider")).toBe("google");
    // 앱 창은 그대로 로그인 화면에 남는다.
    expect(win.url()).toMatch(/\/login$/);

    // 시험에서는 실제 Google 대신 테스트 로그인으로 브라우저 쪽을 마친다.
    loginUrl.searchParams.delete("provider");
    // 평소 브라우저에서 가입까지 마친다.
    await page.goto(loginUrl.toString());
    await page.getByLabel("테스트 이메일").fill(email);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    await page.getByPlaceholder("닉네임").fill(`앱창${testInfo.testId.slice(-6)}${RUN_TAG}`);
    await page.getByLabel("개인정보 수집·이용에 동의해요").check();
    await page.getByRole("button", { name: "시작하기" }).click();
    const deepLink = (await page.getByRole("link", { name: "모도리 앱 열기" }).getAttribute("href")) ?? "";

    // 운영체제가 modori:// 링크를 앱에 넘겨준 것처럼 한다.
    await app.evaluate((_electron, link) => {
      (globalThis as unknown as { modoriHandleDeepLink: (url: string) => void }).modoriHandleDeepLink(link);
    }, deepLink);
    await expect(homeReady(win)).toBeVisible();

    // 모도리 밖으로 가는 링크(의견 메일)는 앱 창이 아니라 바깥에서 연다.
    await win.goto(new URL("/settings", baseURL).toString());
    await win.getByRole("link", { name: "penamjin@gmail.com" }).dispatchEvent("click");
    await expect.poll(async () => (await externalOpened(app)).at(-1)).toMatch(/^mailto:penamjin@gmail\.com/);
    expect(win.url()).toMatch(/\/settings$/);
  } finally {
    await app.close();
  }
});

test("서버에 닿지 못하면 흰 화면 대신 연결 안내를 띄운다", async () => {
  // 아무것도 듣지 않는 주소.
  const app = await launch("http://127.0.0.1:9");
  try {
    const win = await app.firstWindow();
    await expect(win.getByRole("heading", { name: "모도리에 연결하지 못했어요" })).toBeVisible();
    await expect(win.getByRole("button", { name: "다시 시도" })).toBeVisible();
  } finally {
    await app.close();
  }
});
