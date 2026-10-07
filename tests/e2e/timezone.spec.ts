import { expect, test, type Page } from "@playwright/test";

import { dateIn, formatKST, weekdayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { addTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 캐나다에 사는 친구의 "오늘"이 서울 기준이라 하루 어긋나던 것(공개 직후 요청). 사람마다 시간대를 고른다.
const EMAIL = `e2e-timezone-${RUN_TAG}@modori.test`;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const heading = (zone: string) => {
  const day = dateIn(new Date(), zone);
  const [, month, date] = formatKST(day).split("-");
  return `${Number(month)}월 ${Number(date)}일 ${WEEKDAYS[weekdayKST(day)]}요일`;
};

async function signUp(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`시간대${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");
}

test.beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test("기본은 서울이고, 마이페이지에서 시간대를 고르면 오늘과 새 할 일의 날짜가 그 기준이 된다", async ({ page }) => {
  await signUp(page);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
  expect(me.timezone).toBe("Asia/Seoul");
  await expect(page.getByRole("heading", { name: heading("Asia/Seoul"), level: 1 })).toBeVisible();

  // 서울과 오늘이 가장 멀어지는 곳(뉴질랜드 +12/+13과 하와이 -10)을 번갈아 고른다.
  await page.goto("/settings");
  const select = page.getByLabel("시간대", { exact: true });
  await select.selectOption("Pacific/Honolulu");
  await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).timezone).toBe("Pacific/Honolulu");
  await expect(page.getByText(heading("Pacific/Honolulu").split(" ").slice(0, 2).join(" "), { exact: false }).first()).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: heading("Pacific/Honolulu"), level: 1 })).toBeVisible();

  // 이 화면에서 적은 할 일은 하와이의 오늘 날짜로 들어간다.
  await addTodo(page, "시간대 확인 할 일");
  const todo = await prisma.todo.findFirstOrThrow({ where: { userId: me.id, content: "시간대 확인 할 일" } });
  expect(formatKST(todo.date)).toBe(formatKST(dateIn(new Date(), "Pacific/Honolulu")));

  // 다시 서울로 돌리면 오늘도 서울 기준으로 돌아온다.
  await page.goto("/settings");
  await page.getByLabel("시간대", { exact: true }).selectOption("Asia/Seoul");
  await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } })).timezone).toBe("Asia/Seoul");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: heading("Asia/Seoul"), level: 1 })).toBeVisible();
});

test("목록에 없는 시간대는 서버가 받지 않는다", async ({ page }) => {
  await signUp(page);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
  // 서버 액션을 브라우저에서 직접 부르지 못하니 화면의 select 값을 조작해 보낸다.
  await page.goto("/settings");
  await page.getByLabel("시간대", { exact: true }).evaluate((el) => {
    const select = el as HTMLSelectElement;
    const option = document.createElement("option");
    option.value = "Mars/Olympus";
    option.textContent = "화성";
    select.appendChild(option);
  });
  await page.getByLabel("시간대", { exact: true }).selectOption("Mars/Olympus");
  await page.waitForTimeout(1500);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).timezone).toBe("Asia/Seoul");
});
