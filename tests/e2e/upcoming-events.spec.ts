import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { RUN_TAG } from "./run-tag";
import { homeReady } from "./todo-helpers";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-upcoming-${testInfo.testId}-${RUN_TAG}@modori.test`;
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
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("고른 날의 일정 다섯 개가 다가오는 일정 세 개를 가리지 않는다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `다가옴${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const selected = addDays(todayKST(), 4);
  const later = addDays(selected, 1);
  await prisma.event.createMany({
    data: [
      ...Array.from({ length: 5 }, (_, index) => ({
        userId: user.id,
        title: `고른 날 ${index + 1}`,
        startDate: selected,
        endDate: selected,
        color: "#2563eb",
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        userId: user.id,
        title: `다가오는 날 ${index + 1}`,
        startDate: addDays(later, index),
        endDate: addDays(later, index),
        color: "#2563eb",
      })),
    ],
  });

  await page.goto(`/?date=${formatKST(selected)}`);
  const section = page.getByRole("region", { name: "일정" });
  for (let index = 1; index <= 5; index += 1) {
    await expect(section.getByRole("button", { name: new RegExp(`^고른 날 ${index}(?:\\s|$)`) })).toBeVisible();
  }
  for (let index = 1; index <= 3; index += 1) {
    await expect(section.getByRole("button", { name: new RegExp(`다가오는 날 ${index}`) })).toBeVisible();
  }
  await expect(section.getByRole("listitem")).toHaveCount(8);
});
