import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 앱(iOS·안드로이드)의 시작 그림은 웹이 pageReady로 알려야 걷힌다. 처음 로딩이 길다는 제보(2026-10-29)의 원인은
// DOMContentLoaded를 기다린 것이었다. 탭 화면은 데이터가 다 준비될 때까지 응답이 이어져, 뼈대가 이미 그려진 뒤에도 시작 그림이 남았다.
const EMAIL = `e2e-splash-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

declare global {
  interface Window {
    readyAt: number[];
  }
}

test("시작 그림은 응답이 다 끝나기 전, 화면이 그려지면 한 번만 걷힌다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await page.addInitScript(() => {
    window.readyAt = [];
    Object.defineProperty(window, "Capacitor", {
      value: { Plugins: { Modori: { pageReady: async () => window.readyAt.push(performance.now()) } } },
      configurable: true,
    });
  });

  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`시작${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  // 응답이 늦게 끝나는 화면을 흉내 낸다: 맨 끝에 1.5초 걸리는 스크립트를 끼워 DOMContentLoaded를 미룬다. 그 앞의 화면은 그대로 그려진다.
  const SLOW_MS = 1500;
  await page.route("**/__slow.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
    await route.fulfill({ contentType: "text/javascript", body: "" });
  });
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      if (route.request().resourceType() !== "document") return route.continue();
      const response = await route.fetch();
      const html = (await response.text()).replace("</body>", '<script src="/__slow.js"></script></body>');
      return route.fulfill({ response, body: html });
    },
  );

  await page.goto("/", { waitUntil: "commit" });
  await expect(homeReady(page)).toBeVisible();
  await page.waitForLoadState("domcontentloaded");
  const { readyAt, domContentLoaded } = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return { readyAt: window.readyAt, domContentLoaded: nav.domContentLoadedEventStart };
  });

  expect(readyAt).toHaveLength(1);
  expect(domContentLoaded - readyAt[0]).toBeGreaterThan(SLOW_MS - 500);
});
