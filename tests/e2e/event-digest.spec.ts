import { expect, test as base, type Page } from "@playwright/test";

import { dateIn, formatKST, minuteOfDayIn } from "@/lib/date";
import { sendDueEventDigests } from "@/lib/event-digest-send";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 오늘 일정 알림(2026-10-29 운영자 요청): 일정이 있는 날 아침 6시(기본, 바꿀 수 있음)에 앱 푸시로 오늘 일정을 알린다. 기본은 켜짐.
const APP_UA = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 ModoriMobile/1.0.0";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-digest-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
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

  test("처음부터 켜져 있고(아침 6시), 시각을 바꾸고, 끄고, 다시 켠다. 알림을 허용한 기기가 없으면 알려 준다", async ({ page, email }, testInfo) => {
    await signUp(page, email, `일정${testInfo.testId.slice(-6)}${RUN_TAG}`);
    const saved = async () => (await prisma.user.findUniqueOrThrow({ where: { email } })).eventDigestMinute;
    expect(await saved()).toBe(6 * 60);

    await page.goto("/settings/preferences");
    const toggle = page.getByRole("checkbox", { name: /오늘 일정 알림/ });
    await expect(toggle).toBeChecked();
    await expect(page.getByRole("button", { name: "오늘 일정 알림 시각 오전 6:00, 바꾸기" })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("알림이 꺼져 있어 받을 수 없어요");

    await page.getByRole("button", { name: /^오늘 일정 알림 시각 .*바꾸기$/ }).click();
    const sheet = page.getByRole("dialog", { name: "오늘 일정 알림 시각" });
    await sheet.getByRole("radio", { name: "7시" }).click();
    await sheet.getByRole("radio", { name: "30분" }).click();
    await sheet.getByRole("button", { name: "확인", exact: true }).click();
    await expect.poll(saved).toBe(7 * 60 + 30);

    // 새로 열어도 그대로이고, 알림을 받을 기기가 있으면 안내가 사라진다.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.pushToken.create({ data: { userId: user.id, token: `digest-${testInfo.testId}-${RUN_TAG}`, platform: "android" } });
    await page.reload();
    await expect(page.getByRole("button", { name: "오늘 일정 알림 시각 오전 7:30, 바꾸기" })).toBeVisible();
    await expect(page.getByRole("note")).toHaveCount(0);

    await page.getByRole("checkbox", { name: /오늘 일정 알림/ }).uncheck();
    await expect.poll(saved).toBeNull();
    await expect(page.getByRole("button", { name: /^오늘 일정 알림 시각/ })).toHaveCount(0);

    // 다시 켜면 아침 6시부터.
    await page.getByRole("checkbox", { name: /오늘 일정 알림/ }).check();
    await expect.poll(saved).toBe(6 * 60);
  });
});

test("웹 브라우저에는 앱 푸시가 없어 오늘 일정 알림 설정을 보이지 않는다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `웹일${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.goto("/settings/preferences");
  await expect(page.getByRole("heading", { name: "설정" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /오늘 일정 알림/ })).toHaveCount(0);
});

test("때가 되면 오늘 일정이 있는 사람에게 하루 한 번만 보내고, 일정이 없는 사람은 조용히 넘어간다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `보냄${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const now = new Date();
  const today = dateIn(now, user.timezone);
  // 지금 시각(5분 단위로 내림)을 고른 것으로 둔다. 창(30분) 안이다.
  const minute = Math.floor(minuteOfDayIn(now, user.timezone) / 5) * 5;
  await prisma.user.update({ where: { id: user.id }, data: { eventDigestMinute: minute, eventDigestSentOn: null } });
  await prisma.pushToken.create({ data: { userId: user.id, token: `digest-send-${testInfo.testId}-${RUN_TAG}`, platform: "android" } });
  await prisma.event.create({
    data: { userId: user.id, title: "치과", startDate: today, endDate: today, startTime: 15 * 60, color: "#4f8cff" },
  });

  const sentOn = async () => {
    const value = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).eventDigestSentOn;
    return value ? formatKST(value) : null;
  };

  // 서버의 1분 반복이 먼저 보냈을 수도 있다. 어느 쪽이 보냈든 오늘로 적힌다.
  await sendDueEventDigests(now);
  expect(await sentOn()).toBe(formatKST(today));

  // 같은 날 다시 돌아도 이 사람은 이미 보냈다(다른 사람 몫은 셀 수 있어 이 사람의 차례만 본다).
  const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  await sendDueEventDigests(new Date(now.getTime() + 60_000));
  const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(after.eventDigestSentOn?.getTime()).toBe(before.eventDigestSentOn?.getTime());

  // 일정이 없는 날도 오늘 몫은 적힌다(보낼 것이 없어 푸시만 안 간다).
  await prisma.event.deleteMany({ where: { userId: user.id } });
  await prisma.user.update({ where: { id: user.id }, data: { eventDigestSentOn: null } });
  await sendDueEventDigests(now);
  expect(await sentOn()).toBe(formatKST(today));
});
