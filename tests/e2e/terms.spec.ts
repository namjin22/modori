import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const EMAIL = `e2e-terms-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test("이용약관은 로그인하지 않아도 볼 수 있다", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "이용약관", level: 1 })).toBeVisible();
  await expect(page.getByText(/^시행일:/)).toBeVisible();
});

test("마이페이지의 개인정보처리방침 옆에 이용약관 링크가 있다", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`약관${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  await page.goto("/settings");
  const footer = page.getByRole("navigation", { name: "계정과 약관" });
  await expect(footer.getByRole("link")).toHaveText([/개인정보처리방침/, /이용약관/, /계정 지우기/]);
  await footer.getByRole("link", { name: "이용약관" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { name: "이용약관", level: 1 })).toBeVisible();
});
