import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 폰에서 길게 누르면 브라우저가 링크 메뉴·글자 선택 메뉴를 띄워 할 일·일정을 집을 수 없었다. 폰에서는 어디를 눌러도 막고,
// 글 적는 칸만 남긴다. 마우스 화면에는 걸지 않는다(components/touch-menu-guard.tsx).
const EMAIL = `e2e-touchmenu-${RUN_TAG}@modori.test`;

async function signUp(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`메뉴${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  // 이벤트는 화면이 붙은(hydration) 뒤에만 받아진다.
  await page.waitForFunction(() => {
    const cell = document.querySelector("a[data-date]");
    return !!cell && Object.keys(cell).some((key) => key.startsWith("__reactProps"));
  });
  // 문서 전체 감시자는 effect에서 붙으므로 한 틱 더 둔다.
  await page.waitForTimeout(300);
}

/** 길게 누르면 브라우저가 보내는 contextmenu를 선택한 요소에 보내 기본 동작(메뉴)이 막혔는지 돌려준다. */
async function menuBlocked(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    if (!element) throw new Error(`요소가 없다: ${target}`);
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }, selector);
}

test.beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test.describe("폰", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("링크·글자·버튼·아래 탭 어디를 길게 눌러도 메뉴가 뜨지 않고, 글 적는 칸만 남는다", async ({ page }) => {
    await signUp(page);

    // 링크(날짜 칸, 위쪽 화살표, 아래 탭), 글자, 버튼.
    expect(await menuBlocked(page, "a[data-date]")).toBe(true);
    expect(await menuBlocked(page, 'a[aria-label="이전 날"]')).toBe(true);
    // 아래 소셜 탭 링크(주소가 /feed로 시작).
    expect(await menuBlocked(page, 'nav a[href^="/feed"]')).toBe(true);
    expect(await menuBlocked(page, "h1")).toBe(true);
    expect(await menuBlocked(page, 'button[aria-label$="에 할 일 쓰기"]')).toBe(true);

    // 글을 적는 칸은 붙여넣기·선택 메뉴가 필요해서 막지 않는다.
    await page.getByRole("button", { name: /에 할 일 쓰기$/ }).first().click();
    expect(await menuBlocked(page, 'input[aria-label$="할 일"]')).toBe(false);

    // 글자 선택 막대를 띄우지 않도록 선택도 막혀 있다(글 적는 칸 밖).
    const selectable = await page.evaluate(() => getComputedStyle(document.body).userSelect);
    expect(selectable).toBe("none");
  });
});

test.describe("컴퓨터", () => {
  test("마우스 화면에서는 링크의 오른쪽 단추 메뉴를 막지 않는다", async ({ page }) => {
    await signUp(page);
    expect(await menuBlocked(page, 'nav a[href^="/feed"], a[href^="/feed"]')).toBe(false);
    expect(await menuBlocked(page, "h1")).toBe(false);
    const selectable = await page.evaluate(() => getComputedStyle(document.body).userSelect);
    expect(selectable).not.toBe("none");
  });
});
