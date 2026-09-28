import { expect, test, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { PRIVACY_MANAGER } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const EMAIL = `e2e-metrics-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

async function signUp(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

test("가입을 마치고 화면을 열면 오늘 쓴 날로 한 번 적히고, 계정을 지우면 같이 지워진다", async ({ page }) => {
  await signUp(page, EMAIL, `지표${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "마이페이지" })).toBeVisible();
  expect(await prisma.activeDay.findMany({ where: { userId: user.id } })).toEqual([
    { userId: user.id, date: todayKST() },
  ]);

  // 운영자가 아니면 지표 화면은 없는 주소이고 링크도 없다.
  await expect(page.getByRole("link", { name: "지표", exact: true })).toHaveCount(0);
  await page.goto("/admin/metrics");
  await expect(page.getByRole("heading", { name: "없는 주소예요" })).toBeVisible();

  await prisma.user.delete({ where: { id: user.id } });
  expect(await prisma.activeDay.count({ where: { userId: user.id } })).toBe(0);
});

test("운영자는 지표 화면에서 가입 단계를 본다", async ({ page }) => {
  // 테스트 DB를 로컬과 CI가 같이 쓴다. 누가 운영자 계정을 쓰고 있으면 건드리지 않는다.
  const existing = await prisma.user.findUnique({ where: { email: PRIVACY_MANAGER.email } });
  test.skip(existing !== null, "테스트 DB에 운영자 계정이 이미 있다");
  try {
    await signUp(page, PRIVACY_MANAGER.email, `운영${RUN_TAG}`);
    await page.goto("/settings");
    await page.getByRole("link", { name: "지표", exact: true }).click();
    await expect(page.getByRole("heading", { name: "지표", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "가입 단계" })).toBeVisible();
    await expect(page.getByText("가입 완료(닉네임)")).toBeVisible();
  } finally {
    await prisma.user.deleteMany({ where: { email: PRIVACY_MANAGER.email } });
  }
});
