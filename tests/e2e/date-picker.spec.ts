import { expect, test, type Page } from "@playwright/test";

import { addDays, addMonths, formatKST, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const EMAIL = `e2e-datepick-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test.beforeEach(async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`달력${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
});

const dayName = (date: Date) => `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;

async function openEventForm(page: Page) {
  await page.getByRole("button", { name: "일정", exact: true }).click();
  await expect(page.getByLabel("새 일정 이름")).toBeVisible();
}

test("날짜 단추를 누르면 달력이 뜨고, 날을 누르면 바로 정해진다", async ({ page }) => {
  const today = todayKST();
  await openEventForm(page);

  // 처음 값은 오늘이고, 한글 날짜로 읽힌다.
  const start = page.getByRole("button", { name: /^새 일정 시작일:/ });
  await expect(start).toHaveAccessibleName(new RegExp(dayName(today)));

  await start.click();
  const dialog = page.getByRole("dialog", { name: "날짜 고르기" });
  await expect(dialog.getByRole("button", { name: dayName(today), exact: true })).toHaveAttribute("aria-pressed", "true");

  // 이번 달 안의 다른 날을 누른다(오늘과 다른 날, 같은 달).
  const other = addDays(today, today.getUTCDate() > 15 ? -5 : 5);
  await dialog.getByRole("button", { name: dayName(other), exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(start).toHaveAccessibleName(new RegExp(dayName(other)));

  // 폼은 숨은 칸으로 값을 보낸다: 저장하면 그 날짜로 일정이 생긴다.
  await page.getByLabel("새 일정 이름").fill("달력으로 고른 일정");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByLabel("새 일정 이름")).toBeHidden();
  const saved = await prisma.event.findFirstOrThrow({ where: { user: { email: EMAIL }, title: "달력으로 고른 일정" } });
  expect(formatKST(saved.startDate)).toBe(formatKST(other));
});

test("달을 넘기고, 연도·월 고르기로 먼 달로 간다", async ({ page }) => {
  const today = todayKST();
  await openEventForm(page);
  await page.getByRole("button", { name: /^새 일정 시작일:/ }).click();
  const dialog = page.getByRole("dialog", { name: "날짜 고르기" });

  const next = addMonths(today, 1);
  await dialog.getByRole("button", { name: "다음 달" }).click();
  await expect(
    dialog.getByRole("button", { name: `${next.getUTCFullYear()}년 ${next.getUTCMonth() + 1}월, 연도·월 고르기` }),
  ).toBeVisible();

  // 제목을 누르면 월 목록이 나온다. 연도를 넘기고 월을 누르면 그 달로 돌아온다.
  await dialog.getByRole("button", { name: "연도·월 고르기" }).click();
  await dialog.getByRole("button", { name: "다음 해" }).click();
  await dialog.getByRole("button", { name: "3월", exact: true }).click();
  const target = addMonths(next, 12 + (3 - (next.getUTCMonth() + 1)));
  await expect(dialog.getByRole("group", { name: `${target.getUTCFullYear()}년 3월` })).toBeVisible();
});

test("오늘·내일 칸과 직접 입력, 잘못된 날짜 안내", async ({ page }) => {
  const today = todayKST();
  await openEventForm(page);
  const end = page.getByRole("button", { name: /^새 일정 종료일:/ });

  await end.click();
  const dialog = page.getByRole("dialog", { name: "날짜 고르기" });
  await dialog.getByRole("button", { name: "일주일 뒤" }).click();
  await expect(end).toHaveAccessibleName(new RegExp(dayName(addDays(today, 7))));

  await end.click();
  await dialog.getByLabel("날짜 직접 입력").fill("2026-02-31");
  await dialog.getByRole("button", { name: "적용", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("2026-10-02처럼 적어 주세요.");

  // Enter로도 적용하고, 폼이 저장되지는 않는다.
  await dialog.getByLabel("날짜 직접 입력").fill(formatKST(addDays(today, 2)));
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(end).toHaveAccessibleName(new RegExp(dayName(addDays(today, 2))));
  await expect(page.getByLabel("새 일정 이름")).toBeVisible();
});

test("시작일을 종료일보다 뒤로 옮기면 종료일도 따라온다", async ({ page }) => {
  const today = todayKST();
  await openEventForm(page);
  const later = addDays(today, 3);

  await page.getByRole("button", { name: /^새 일정 시작일:/ }).click();
  const dialog = page.getByRole("dialog", { name: "날짜 고르기" });
  await dialog.getByLabel("날짜 직접 입력").fill(formatKST(later));
  await dialog.getByRole("button", { name: "적용", exact: true }).click();

  await expect(page.getByRole("button", { name: /^새 일정 종료일:/ })).toHaveAccessibleName(new RegExp(dayName(later)));
});

test("루틴 종료일은 비울 수 있다", async ({ page }) => {
  await page.goto("/routines");
  // 루틴 만들기 칸은 펼침 안에 있다.
  await page.getByText("루틴 만들기").first().click();
  const end = page.getByRole("button", { name: /^루틴 종료일:/ });
  await expect(end).toHaveAccessibleName(/계속 \(종료일 없음\)/);

  await end.click();
  const dialog = page.getByRole("dialog", { name: "날짜 고르기" });
  await dialog.getByRole("button", { name: "내일" }).click();
  await expect(end).toHaveAccessibleName(new RegExp(dayName(addDays(todayKST(), 1))));

  await end.click();
  await dialog.getByRole("button", { name: "날짜 없음" }).click();
  await expect(end).toHaveAccessibleName(/계속 \(종료일 없음\)/);
});
