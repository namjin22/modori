import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { addEvent, addTodo, homeReady, openEvent } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-event-${testInfo.testId}-${RUN_TAG}@modori.test`;
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
  await signInAndOnboard(page, email, `일정${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const today = todayKST();

  await addEvent(page, "중간고사");

  // 오른쪽 목록과 왼쪽 달력 양쪽에 보인다.
  await expect(dayCell(page, today)).toContainText("중간고사");

  // 할 일은 이름이 달력에 나오지 않는다.
  await addTodo(page, "숨은 할 일");
  await page.getByRole("button", { name: "완료", exact: true }).click();
  // 달력에는 일정만 이름으로 남는다. 할 일은 이름이 나오지 않는다.
  await expect(dayCell(page, today)).toHaveAttribute("aria-label", /완료 있음/);
  await expect(dayCell(page, today)).not.toContainText("숨은 할 일");
});

test("여러 날 일정은 그 기간의 모든 날에 뜬다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `기간${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const today = todayKST();
  const third = addDays(today, 2);

  await addEvent(page, "수학여행", formatKST(third));

  for (const day of [today, addDays(today, 1), third]) {
    await expect(dayCell(page, day)).toContainText("수학여행");
  }
  await expect(dayCell(page, addDays(today, 3))).not.toContainText("수학여행");

  // 기간 안의 다른 날로 가도 목록에 있다.
  await page.goto(`/?date=${formatKST(third)}`);
  await expect(page.getByRole("listitem").filter({ hasText: "수학여행" })).toBeVisible();
});

test("일정을 지우면 되돌릴 수 있다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `취소${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await addEvent(page, "동아리 발표");

  await openEvent(page, "동아리 발표");
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "동아리 발표" })).toHaveCount(0);

  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "동아리 발표" })).toBeVisible();
});

test("일정 만들기 칸은 이름을 비운 채 다른 곳을 누르면 닫힌다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `빈일정${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const title = page.getByLabel("새 일정 이름");

  await page.getByRole("button", { name: "일정", exact: true }).click();
  await expect(title).toBeFocused();
  // 날짜 칸으로 옮겨 가는 것은 같은 칸 안이라 닫히지 않는다.
  await page.getByLabel("새 일정 시작일").focus();
  await expect(title).toBeVisible();

  await page.getByRole("heading", { level: 1 }).click();
  await expect(title).toBeHidden();

  await page.getByRole("button", { name: "일정", exact: true }).click();
  await title.fill("동아리 발표");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(title).toHaveValue("동아리 발표");
});

test("하루에 일정을 다섯 개까지 연달아 넣고, 여섯째는 막는다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `다섯${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const today = todayKST();

  // 하나를 넣은 뒤에도 더 넣을 버튼이 목록 아래에 보인다.
  await page.getByRole("button", { name: "시험이나 행사 적어두기" }).click();
  await page.getByLabel("새 일정 이름").fill("일정 1");
  await page.getByLabel("새 일정 이름").press("Enter");
  for (let index = 2; index <= 5; index += 1) {
    await page.getByRole("button", { name: "+ 일정 더 적기" }).click();
    await page.getByLabel("새 일정 이름").fill(`일정 ${index}`);
    await page.getByLabel("새 일정 이름").press("Enter");
    await expect(page.getByRole("listitem").filter({ hasText: `일정 ${index}` })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "+ 일정 더 적기" })).toHaveCount(0);
  await expect(page.getByText("일정은 하루에 5개까지 둘 수 있어요")).toBeVisible();

  // 어제부터 오늘까지 이어지는 일정도 오늘이 꽉 차서 들어가지 않는다.
  await page.goto(`/?date=${formatKST(addDays(today, -1))}`);
  await page.getByRole("button", { name: "시험이나 행사 적어두기" }).click();
  await page.getByLabel("새 일정 이름").fill("이틀짜리");
  await page.getByLabel("새 일정 종료일").fill(formatKST(today));
  await page.getByLabel("새 일정 이름").press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "일정이 벌써 5개예요" })).toBeVisible();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(await prisma.event.count({ where: { userId: user.id } })).toBe(5);
});
