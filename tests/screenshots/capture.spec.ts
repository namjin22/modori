import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { formatKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { FRIEND, ME, seed, today, type Seeded } from "./seed";

const OUT = path.join("docs", "screenshots", process.env.SCREENSHOT_DIR ?? formatKST(today));

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

/**
 * 창을 페이지 높이만큼 늘려 찍고 되돌린다. fullPage로 찍으면 아래 탭 바(fixed)가 원래 창 높이 자리에 박혀
 * 내용 한가운데를 가린다.
 */
async function shoot(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("창 크기를 알 수 없다.");
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, height) });
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 80 });
  await page.setViewportSize(viewport);
}

/**
 * Google Play 스토어 등록정보용. 스토어는 9:16(또는 16:9)만 받아서 창을 늘리지 않고 화면 한 장 크기로 찍는다.
 * 1080×1920이 되도록 405×720에 배율 2.667을 준다. STORE_ASSETS=1일 때만 돈다.
 */
async function shootStore(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // 스크롤바가 찍혀 오른쪽이 잘려 보인다.
  await page.addStyleTag({ content: "::-webkit-scrollbar{display:none}html{scrollbar-width:none}" });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), type: "png" });
}

let seeded: Seeded;

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  seeded = await seed();
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [ME, FRIEND] } } });
  await prisma.$disconnect();
});

const STORE = process.env.STORE_ASSETS === "1";

test.describe("스토어 스크린샷", () => {
  test.skip(!STORE, "STORE_ASSETS=1일 때만 찍는다");
  test.use({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 2.667 });

  test("휴대전화", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    await page.getByLabel("테스트 이메일").fill(ME);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    await expect(page.getByRole("button", { name: "공부에 할 일 쓰기" })).toBeVisible();

    const screens: [string, string][] = [
      ["1-home", "/"],
      ["2-calendar", "/?view=month"],
      ["3-social", "/feed"],
      ["4-friend", `/feed/u/${seeded.friendId}`],
      ["5-notifications", "/feed/reactions"],
      ["6-stats", "/stats"],
    ];
    for (const [name, url] of screens) {
      await page.goto(url);
      await shootStore(page, `store-phone-${name}`);
    }
  });
});

for (const viewport of STORE ? [] : VIEWPORTS) {
  test(`${viewport.name} 화면`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ colorScheme: "light" });

    await page.goto("/login");
    await shoot(page, `${viewport.name}-01-login`);

    await page.getByLabel("테스트 이메일").fill(ME);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    // 데모 계정은 기본 카테고리 대신 직접 만든 카테고리를 쓴다.
    await expect(page.getByRole("button", { name: "공부에 할 일 쓰기" })).toBeVisible();

    const screens: [string, string][] = [
      ["02-home", "/"],
      ...(viewport.name === "phone" ? [["03-calendar", "/?view=month"] as [string, string]] : []),
      ["04-social", "/feed"],
      ["05-friend", `/feed/u/${seeded.friendId}`],
      ["06-notifications", "/feed/reactions"],
      ["07-stats", "/stats"],
      ["08-mypage", "/settings"],
    ];
    for (const [name, url] of screens) {
      await page.goto(url);
      await shoot(page, `${viewport.name}-${name}`);
    }

    // 할 일을 눌렀을 때 뜨는 창(메모, 다른 날에 하기).
    await page.goto("/");
    await page.getByRole("button", { name: /^수학 문제집 3장/ }).click();
    await page.getByRole("button", { name: "다른 날에 하기" }).click();
    await shoot(page, `${viewport.name}-10-todo-sheet`);

    // 9/30 이후 새로 생긴 화면: 친구의 팔로우 목록, 반응을 누른 사람 창, 일정 만들기 창.
    await page.goto(`/feed/u/${seeded.friendId}/following`);
    await shoot(page, `${viewport.name}-11-friend-following`);

    await page.goto("/feed");
    await page.getByRole("button", { name: /누가 눌렀는지 보기/ }).first().click();
    await expect(page.getByRole("dialog", { name: "누가 눌렀어요" })).toBeVisible();
    await shoot(page, `${viewport.name}-12-reaction-who`);

    await page.goto("/");
    await page.getByRole("button", { name: "일정", exact: true }).click();
    await expect(page.getByLabel("새 일정 이름")).toBeVisible();
    await shoot(page, `${viewport.name}-13-event-form`);

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await shoot(page, `${viewport.name}-09-home-dark`);
  });
}
