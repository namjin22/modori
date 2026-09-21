import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { addTodo, homeReady } from "./todo-helpers";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-event-${testInfo.testId}@modori.test`;
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

/** 달력에서 그 날 칸. 완료 여부와 상관없이 날짜로 찾는다. */
function dayCell(page: Page, date: Date) {
  return page.getByRole("link", {
    name: new RegExp(`^${date.getUTCDate()}일, 완료`),
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("일정은 달력에 이름으로 뜨고, 할 일은 색으로만 남는다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `일정${testInfo.testId.slice(-6)}`);
  const today = todayKST();

  await page.getByText("+ 일정 만들기").click();
  await page.getByLabel("새 일정 이름").fill("중간고사");
  await page.getByRole("button", { name: "일정 넣기" }).click();

  // 오른쪽 목록과 왼쪽 달력 양쪽에 보인다.
  await expect(page.getByRole("listitem").filter({ hasText: "중간고사" })).toBeVisible();
  await expect(dayCell(page, today)).toContainText("중간고사");

  // 할 일은 이름이 달력에 나오지 않는다.
  await addTodo(page, "숨은 할 일");
  await page.getByRole("button", { name: "완료", exact: true }).click();
  // 한 일은 이름이 아니라 칸 색으로만 남는다.
  await expect(dayCell(page, today)).toHaveAttribute("aria-label", /완료 있음/);
  await expect(dayCell(page, today)).toHaveAttribute("style", /linear-gradient/);
  await expect(dayCell(page, today)).not.toContainText("숨은 할 일");
});

test("여러 날 일정은 그 기간의 모든 날에 뜬다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `기간${testInfo.testId.slice(-6)}`);
  const today = todayKST();
  const third = addDays(today, 2);

  await page.getByText("+ 일정 만들기").click();
  await page.getByLabel("새 일정 이름").fill("수학여행");
  await page.getByLabel("새 일정 종료일").fill(formatKST(third));
  await page.getByRole("button", { name: "일정 넣기" }).click();

  for (const day of [today, addDays(today, 1), third]) {
    await expect(dayCell(page, day)).toContainText("수학여행");
  }
  await expect(dayCell(page, addDays(today, 3))).not.toContainText("수학여행");

  // 기간 안의 다른 날로 가도 목록에 있다.
  await page.goto(`/?date=${formatKST(third)}`);
  await expect(page.getByRole("listitem").filter({ hasText: "수학여행" })).toBeVisible();
});

test("일정을 지우면 되돌릴 수 있다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `취소${testInfo.testId.slice(-6)}`);

  await page.getByText("+ 일정 만들기").click();
  await page.getByLabel("새 일정 이름").fill("동아리 발표");
  await page.getByRole("button", { name: "일정 넣기" }).click();

  const row = page.getByRole("listitem").filter({ hasText: "동아리 발표" });
  await row.getByText("수정").click();
  await row.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "동아리 발표" })).toHaveCount(0);

  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "동아리 발표" })).toBeVisible();
});
