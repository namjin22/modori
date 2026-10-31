import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 데스크톱 앱 안 업데이트(2026-10-27 요청)의 화면. 앱(desktop/updater.js)이 하는 일은 desktop-app.spec.ts가 실제 앱으로 확인하고,
// 여기서는 앱이 내주는 window.modoriUpdater를 같은 모양의 가짜로 바꿔 화면이 상태대로 그려지고 눌린 것을 앱에 넘기는지 본다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-update-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

const WINDOWS_APP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36 ModoriDesktop/1.0.7";

type Patch = Partial<{ supported: boolean; status: string; version: string | null; percent: number; error: string | null }>;

/** preload.js가 내주는 window.modoriUpdater와 같은 모양의 가짜. 부른 것은 window.__updateCalls에 남는다. */
async function installFakeUpdater(page: Page, initial: Patch) {
  await page.addInitScript((first) => {
    type Listener = (state: unknown) => void;
    const listeners = new Set<Listener>();
    let state = { supported: true, current: "1.0.7", status: "idle", version: null, percent: 0, error: null, ...first };
    const calls: string[] = [];
    let reads = 0;
    Object.assign(window, {
      __updateCalls: calls,
      __stateReads: () => reads,
      __setUpdate: (patch: Patch) => {
        state = { ...state, ...patch };
        listeners.forEach((listener) => listener(state));
      },
      modoriUpdater: {
        getState: async () => {
          reads += 1;
          return state;
        },
        check: () => calls.push("check"),
        start: () => calls.push("start"),
        onState: (listener: Listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    });
  }, initial);
}

const setUpdate = (page: Page, patch: Patch) => page.evaluate((next) => (window as unknown as { __setUpdate: (p: Patch) => void }).__setUpdate(next), patch);
/**
 * 화면이 앱에 상태를 물어 그릴 준비를 마칠 때까지 기다린다. 서버가 그린 화면에는 이 카드가 늘 없어서,
 * 기다리지 않고 "없다"를 확인하면 화면이 틀려도(하이드레이션 전에) 통과한다.
 */
const waitUntilUpdateStateRead = (page: Page) =>
  expect.poll(() => page.evaluate(() => (window as unknown as { __stateReads: () => number }).__stateReads())).toBeGreaterThan(0);
const updateCalls = (page: Page) => page.evaluate(() => (window as unknown as { __updateCalls: string[] }).__updateCalls);

async function signUp(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

test("새 버전이 있으면 탭 화면 위에 알리고, 누르면 앱에 받기를 맡기고 진행을 보여 준다", async ({ browser, email }, testInfo) => {
  const context = await browser.newContext({ userAgent: WINDOWS_APP_UA });
  const page = await context.newPage();
  await installFakeUpdater(page, { status: "available", version: "1.0.8" });
  await signUp(page, email, `갱신${testInfo.testId.slice(-6)}${RUN_TAG}`);

  const banner = page.getByRole("region", { name: "앱 업데이트" });
  await expect(banner).toContainText("새 버전 1.0.8이 나왔어요");
  await banner.getByRole("button", { name: "업데이트", exact: true }).click();
  expect(await updateCalls(page)).toEqual(["start"]);

  // 앱이 받기 시작했다고 알리면 버튼은 눌리지 않고 진행률이 보인다.
  await setUpdate(page, { status: "downloading", percent: 42 });
  await expect(banner.getByRole("button", { name: "받는 중 42%" })).toBeDisabled();
  await expect(banner.getByRole("progressbar", { name: "업데이트 받는 중" })).toHaveAttribute("aria-valuenow", "42");

  // 다른 탭에도 같은 배너가 있다. 화면을 통째로 다시 열면 가짜가 새로 만들어져 호출 기록도 새로 시작한다(진짜 앱의 상태는 앱이 갖고 있다).
  await page.goto("/feed");
  await expect(page.getByRole("region", { name: "앱 업데이트" })).toContainText("1.0.8");
  expect(await updateCalls(page)).toEqual([]);

  // 받다가 실패하면 원문을 보이고 다시 시도할 수 있다.
  await setUpdate(page, { status: "error", error: "net::ERR_INTERNET_DISCONNECTED" });
  await expect(page.getByRole("alert").filter({ hasText: "net::ERR_INTERNET_DISCONNECTED" })).toBeVisible();
  await page.getByRole("region", { name: "앱 업데이트" }).getByRole("button", { name: "다시 시도" }).click();
  expect(await updateCalls(page)).toEqual(["start"]);
  await context.close();
});

test("설정에서 지금 버전을 보고 직접 확인한다. 확인만 실패하면 배너는 없고 줄에만 알린다", async ({ browser, email }, testInfo) => {
  const context = await browser.newContext({ userAgent: WINDOWS_APP_UA });
  const page = await context.newPage();
  await installFakeUpdater(page, { status: "none" });
  await signUp(page, email, `확인${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await waitUntilUpdateStateRead(page);
  await expect(page.getByRole("region", { name: "앱 업데이트" })).toHaveCount(0);

  await page.goto("/settings/preferences");
  const row = page.getByRole("heading", { name: "앱 업데이트" }).locator("..");
  await expect(row).toContainText("모도리 1.0.7");
  await expect(row).toContainText("최신 버전이에요");
  await row.getByRole("button", { name: "업데이트 확인" }).click();
  expect(await updateCalls(page)).toEqual(["check"]);

  await setUpdate(page, { status: "error", error: "Cannot find latest.yml" });
  await expect(row).toContainText("업데이트하지 못했어요: Cannot find latest.yml");
  await expect(row.getByRole("button", { name: "다시 확인" })).toBeEnabled();
  // 새 버전을 모르니 탭 위 배너는 만들지 않는다.
  await expect(page.getByRole("region", { name: "앱 업데이트" })).toHaveCount(0);

  await setUpdate(page, { status: "available", version: "1.0.9", error: null });
  await row.getByRole("button", { name: "업데이트", exact: true }).click();
  expect(await updateCalls(page)).toEqual(["check", "start"]);
  await context.close();
});

test("앱 안 업데이트를 못 하는 앱(맥)에는 아무것도 보이지 않는다", async ({ browser, email }, testInfo) => {
  const context = await browser.newContext({ userAgent: WINDOWS_APP_UA });
  const page = await context.newPage();
  await installFakeUpdater(page, { supported: false, status: "available", version: "1.0.8" });
  await signUp(page, email, `맥${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.goto("/settings/preferences");
  await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();
  await waitUntilUpdateStateRead(page);
  await expect(page.getByRole("heading", { name: "앱 업데이트" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "앱 업데이트" })).toHaveCount(0);
  await context.close();
});

const DOWNLOAD_URL = "https://github.com/namjin22/modori/releases/latest/download/Modori-Setup.exe";
const OUTDATED_NOTICE = "앱이 오래된 버전";

// 옛 앱 알림(2026-10-28 요청): 앱 안 업데이트가 없는 앱(1.0.6 이하)이 탭 화면 위에서 최신 버전으로 업데이트하라고 알린다.
test("앱 안 업데이트가 없는 옛 앱은 탭 화면 위에서 최신 버전으로 업데이트하라고 알린다", async ({ browser, email }, testInfo) => {
  const context = await browser.newContext({ userAgent: WINDOWS_APP_UA.replace("1.0.7", "1.0.6") });
  const page = await context.newPage();
  await signUp(page, email, `옛앱${testInfo.testId.slice(-6)}${RUN_TAG}`);

  const banner = page.getByRole("region", { name: "앱 업데이트" });
  await expect(banner).toContainText(OUTDATED_NOTICE);
  await expect(banner).toContainText("1.0.6");
  await expect(banner.getByRole("link", { name: "최신 버전 받기" })).toHaveAttribute("href", DOWNLOAD_URL);

  // 다른 탭으로 옮겨도 따라온다. "나중에"를 누르면 이 앱을 다시 켤 때까지 숨는다(탭을 옮겨도 다시 뜨지 않는다).
  await page.getByRole("link", { name: /소셜/ }).first().click();
  await expect(page).toHaveURL(/\/feed/);
  await expect(banner).toContainText(OUTDATED_NOTICE);
  await banner.getByRole("button", { name: "나중에" }).click();
  await expect(banner).toHaveCount(0);
  await page.getByRole("link", { name: /마이페이지/ }).first().click();
  await expect(page.getByRole("heading", { name: "마이페이지" })).toBeVisible();
  await expect(banner).toHaveCount(0);

  // 설정에는 같은 안내가 줄로 남아 있다.
  await page.getByRole("link", { name: /^설정/ }).click();
  await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "앱 업데이트" })).toBeVisible();
  await expect(page.getByRole("link", { name: "최신 버전 받기" })).toHaveAttribute("href", DOWNLOAD_URL);

  // 앱을 다시 켜는 것과 같다(화면을 통째로 다시 연다). 기기에 저장한 것이 없어 알림이 다시 뜬다.
  await page.reload();
  await expect(page.getByRole("region", { name: "앱 업데이트" })).toContainText(OUTDATED_NOTICE);
  await context.close();
});

test("옛 앱 알림은 서버가 사용자 에이전트로 정한다: 새 앱·맥 앱·보통 브라우저에는 없다", async ({ browser, email }, testInfo) => {
  // 서버가 그린 화면을 그대로 본다. 화면이 다 그려지기 전에 "없다"를 확인하면 틀려도 통과하기 때문이다.
  const serverHtml = async (page: Page, path: string) => (await page.request.get(path)).text();

  const legacy = await browser.newContext({ userAgent: WINDOWS_APP_UA.replace("1.0.7", "1.0.6") });
  const legacyPage = await legacy.newPage();
  await signUp(legacyPage, email, `분기${testInfo.testId.slice(-6)}${RUN_TAG}`);
  // 기준: 같은 계정이라도 옛 앱에서는 서버가 알림을 그려 보낸다.
  expect(await serverHtml(legacyPage, "/")).toContain(OUTDATED_NOTICE);
  expect(await serverHtml(legacyPage, "/settings/preferences")).toContain("옛 버전이에요");
  await legacy.close();

  const signIn = async (page: Page) => {
    await page.goto("/login");
    await page.getByLabel("테스트 이메일").fill(email);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    await expect(homeReady(page)).toBeVisible();
  };
  const cases = [
    // 앱 안 업데이트가 있는 앱은 스스로 새 버전을 알린다.
    ["앱 안 업데이트가 있는 1.0.7", WINDOWS_APP_UA],
    ["더 새로운 1.0.10", WINDOWS_APP_UA.replace("1.0.7", "1.0.10")],
    // 받기 링크가 Windows 설치 파일이라 맥 앱에는 보이지 않는다.
    ["맥 앱 1.0.6", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150 Safari/537.36 ModoriDesktop/1.0.6"],
    // 앱이 아닌 보통 브라우저.
    ["보통 브라우저", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36"],
  ] as const;
  for (const [name, userAgent] of cases) {
    const context = await browser.newContext({ userAgent });
    const page = await context.newPage();
    await signIn(page);
    expect(await serverHtml(page, "/"), `${name}: 홈`).not.toContain(OUTDATED_NOTICE);
    expect(await serverHtml(page, "/settings/preferences"), `${name}: 설정`).not.toContain("옛 버전이에요");
    await context.close();
  }
});
