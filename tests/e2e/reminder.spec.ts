import { expect, test as base, type Page } from "@playwright/test";

import { dateIn, formatKST, minuteOfDayIn } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { sendDueReminders } from "@/lib/reminder-send";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 할 일 리마인드(2026-10-14 운영자 결정): 앱에서만 켜고, 하루 한 번 고른 시각에 남은 할 일 수를 앱 푸시로 알린다.
const APP_UA = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 ModoriMobile/1.0.0";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-remind-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
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

test.describe("앱", () => {
  test.use({ userAgent: APP_UA, viewport: { width: 390, height: 844 } });

  test("마이페이지에서 리마인드를 켜고 시각을 고르고 끈다. 알림을 허용한 기기가 없으면 알려 준다", async ({ page, email }, testInfo) => {
    await signUp(page, email, `알림${testInfo.testId.slice(-6)}${RUN_TAG}`);
    const saved = async () => (await prisma.user.findUniqueOrThrow({ where: { email } })).reminderMinute;

    await page.goto("/settings");
    const toggle = page.getByRole("checkbox", { name: /할 일 리마인드/ });
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    // 처음 켜면 저녁 9시.
    await expect.poll(saved).toBe(21 * 60);
    // 시각은 휴대폰 기본 선택창이 아니라 앱의 창에서 고른다(2026-10-15 요청, components/time-sheet.tsx).
    const timeButton = page.getByRole("button", { name: /^알림 시각 / });
    await expect(timeButton).toHaveAccessibleName("알림 시각 오후 9:00, 바꾸기");
    await expect(page.getByRole("note")).toContainText("알림이 꺼져 있어 받을 수 없어요");

    await timeButton.click();
    const sheet = page.getByRole("dialog", { name: "알림 시각" });
    await sheet.getByRole("radio", { name: "10시" }).click();
    await sheet.getByRole("radio", { name: "30분" }).click();
    await expect(sheet).toContainText("오후 10:30");
    await sheet.getByRole("button", { name: "확인" }).click();
    await expect.poll(saved).toBe(22 * 60 + 30);

    // 새로 열어도 그대로이고, 알림을 받을 기기가 있으면 안내가 사라진다.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.pushToken.create({ data: { userId: user.id, token: `remind-${testInfo.testId}-${RUN_TAG}`, platform: "android" } });
    await page.reload();
    await expect(timeButton).toHaveAccessibleName("알림 시각 오후 10:30, 바꾸기");
    await expect(page.getByRole("note")).toHaveCount(0);

    await page.getByRole("checkbox", { name: /할 일 리마인드/ }).uncheck();
    await expect.poll(saved).toBeNull();
    await expect(timeButton).toHaveCount(0);
  });
});

test("웹 브라우저에는 푸시가 없어 리마인드 설정을 보이지 않는다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `웹알${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "마이페이지" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /할 일 리마인드/ })).toHaveCount(0);
});

test("때가 되면 남은 할 일이 있는 사람에게 하루 한 번만 보낸다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `보냄${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const now = new Date();
  const timezone = user.timezone;
  const today = dateIn(now, timezone);
  // 지금 시각(5분 단위로 내림)을 고른 것으로 둔다. 창(30분) 안이다.
  const minute = Math.floor(minuteOfDayIn(now, timezone) / 5) * 5;
  await prisma.user.update({ where: { id: user.id }, data: { reminderMinute: minute, reminderSentOn: null } });
  await prisma.pushToken.create({ data: { userId: user.id, token: `remind-send-${testInfo.testId}-${RUN_TAG}`, platform: "android" } });
  await prisma.todo.create({ data: { userId: user.id, date: today, content: "남은 일", done: false } });

  const sentOn = async () => {
    const value = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).reminderSentOn;
    return value ? formatKST(value) : null;
  };

  // 서버의 1분 반복이 먼저 보냈을 수도 있다. 어느 쪽이 보냈든 오늘로 적힌다.
  await sendDueReminders(now);
  expect(await sentOn()).toBe(formatKST(today));

  // 같은 날 다시 돌아도 이 사람은 이미 보냈다(다른 사람 몫은 셀 수 있어 이 사람의 차례만 본다).
  const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  await sendDueReminders(new Date(now.getTime() + 60_000));
  const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(after.reminderSentOn?.getTime()).toBe(before.reminderSentOn?.getTime());
});
