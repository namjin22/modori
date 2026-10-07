import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";

// 공개 첫날 가입 40명 중 35명이 할 일을 한 번도 안 썼고, 61명 중 51명이 아무도 팔로우하지 않았다.
// 빈 화면에 바로 할 일을 쓰는 큰 버튼과 추천 친구를 둔다.
const emails = [0, 1].map((n) => `e2e-firstrun-${n}-${RUN_TAG}@modori.test`);

async function signUp(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");
}

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

test("할 일이 없는 첫 화면의 큰 버튼을 누르면 입력칸이 열려 바로 적을 수 있다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: emails[0] } });
  await signUp(page, emails[0], `처음${RUN_TAG}`);

  const button = page.getByRole("button", { name: "첫 할 일 적기" });
  await expect(button).toBeVisible();
  await button.click();

  const input = page.getByLabel("오늘 할 일");
  await expect(input).toBeFocused();
  await input.fill("처음 적는 할 일");
  await input.press("Enter");
  await expect(page.getByRole("button", { name: "처음 적는 할 일", exact: true })).toBeVisible();

  // 할 일이 생기면 큰 버튼은 사라진다.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "첫 할 일 적기" })).toHaveCount(0);
});

test("지난 날의 빈 화면에는 큰 버튼을 두지 않는다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: emails[0] } });
  await signUp(page, emails[0], `처음${RUN_TAG}`);
  await page.goto("/?date=2020-01-02");
  await expect(page.getByText("아직 할 일이 없어요")).toBeVisible();
  await expect(page.getByRole("button", { name: "첫 할 일 적기" })).toHaveCount(0);
});

test("아무도 팔로우하지 않은 사람의 소셜 화면에 추천 친구가 바로 보이고, 팔로우할 수 있다", async ({ page, browser }) => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  const other = await browser.newContext();
  await signUp(await other.newPage(), emails[1], `추천받음${RUN_TAG}`);
  await other.close();
  await signUp(page, emails[0], `처음${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] } });

  await page.goto("/feed");
  await expect(page.getByText("아직 팔로우한 친구가 없어요")).toBeVisible();
  const section = page.getByRole("region", { name: "추천 친구" });
  await expect(section).toBeVisible();
  await expect(section.getByRole("button", { name: "팔로우", exact: true }).first()).toBeVisible();

  // 다시 뽑기는 이 화면(/feed)에 머문다.
  await section.getByRole("button", { name: /다른 사람 보기/ }).click();
  await expect(page).toHaveURL(/\/feed\?r=[a-z0-9]+/);

  await section.getByRole("button", { name: "팔로우", exact: true }).first().click();
  await expect.poll(() => prisma.follow.count({ where: { followerId: me.id } })).toBe(1);

  // 한 명이라도 팔로우하면 이 추천 칸은 소셜 화면에서 사라진다.
  await page.goto("/feed");
  await expect(page.getByRole("region", { name: "추천 친구" })).toHaveCount(0);
});
