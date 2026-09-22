import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addTodo, homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-kbd-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

async function signInAndOnboard(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

// 화살표 버튼을 없앴으므로 키보드로 옮기는 길이 막히면 안 된다.
test("손잡이에서 키보드로 순서를 바꾼다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `키보${testInfo.testId.slice(-6)}${RUN_TAG}`);

  for (const content of ["하나", "둘", "셋"]) {
    await addTodo(page, content);
    await expect(page.getByText(content, { exact: true })).toBeVisible();
  }

  const handle = page
    .getByRole("listitem")
    .nth(0)
    .getByRole("button", { name: "순서 바꾸기 손잡이" });
  await handle.focus();

  // dnd-kit은 키를 누를 때마다 자리를 다시 잰다. 사람처럼 안내를 듣고 다음 키를 누른다.
  // 안내가 우리말로 나오는지도 여기서 같이 확인된다.
  const announcer = page.locator('[id^="DndLiveRegion"]');

  await page.keyboard.press("Space");
  await expect(announcer).toContainText("1번째 자리로 옮기는 중");
  // dnd-kit은 집을 때 누른 키를 이동으로 착각하지 않으려고 방향키 리스너를
  // 다음 틱에 붙인다. 안내는 그보다 먼저 뜨므로, 사람이 그렇듯 잠깐 뒤에 누른다.
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowDown");
  await expect(announcer).toContainText("2번째 자리로 옮기는 중");
  await page.keyboard.press("ArrowDown");
  await expect(announcer).toContainText("3번째 자리로 옮기는 중");
  await page.keyboard.press("Space");
  await expect(announcer).toContainText("3번째에 내려놓았어요");

  await expect(page.getByRole("listitem").nth(2)).toContainText("하나");
  await expect(page.locator("ul[aria-busy]")).toHaveAttribute("aria-busy", "false");

  await page.reload();
  await expect(page.getByRole("listitem").nth(0)).toContainText("둘");
  await expect(page.getByRole("listitem").nth(2)).toContainText("하나");
});
