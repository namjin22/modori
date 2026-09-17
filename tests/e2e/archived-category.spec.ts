import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-archived-${testInfo.testId}@modori.test`;
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
  await expect(page.getByLabel("할 일 내용", { exact: true })).toBeVisible();
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("카테고리를 보관해도 그 카테고리의 할 일은 이름을 달고 남는다", async ({
  page,
  email,
}, testInfo) => {
  await signInAndOnboard(page, email, `보관${testInfo.testId.slice(-6)}`);

  await page.getByLabel("할 일 내용", { exact: true }).fill("보관 전에 만든 일");
  await page.getByLabel("카테고리", { exact: true }).selectOption({ label: "공부" });
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText("보관 전에 만든 일")).toBeVisible();

  // 묶음 머리에 카테고리 이름이 보인다.
  // "공부"는 카테고리 고르는 목록에도 있으므로 그 할 일이 든 묶음 안에서 찾는다.
  const group = page.locator("section").filter({ hasText: "보관 전에 만든 일" });
  await expect(group.locator('span:text-is("공부")')).toBeVisible();

  await page.goto("/settings/categories");
  const row = page.getByRole("listitem").filter({ hasText: "공부" });
  // 보관하기는 "수정"을 펼쳐야 나온다.
  await row.getByText("수정").click();
  await row.getByRole("button", { name: "보관하기" }).click();
  await expect(page.getByText("보관함")).toBeVisible();

  await page.goto("/");
  // 할 일은 그대로 있고, 묶음 이름도 그대로다. 카테고리가 살아 있는 묶음 뒤로 간다.
  const groupAfter = page.locator("section").filter({ hasText: "보관 전에 만든 일" });
  await expect(groupAfter.getByText("보관 전에 만든 일")).toBeVisible();
  await expect(groupAfter.locator('span:text-is("공부")')).toBeVisible();

  // 새 할 일을 만들 때는 고를 수 없다.
  await expect(
    page.getByLabel("카테고리", { exact: true }).getByRole("option", { name: "공부" }),
  ).toHaveCount(0);
});
