import { expect, test as base, type Page } from "@playwright/test";

import { MAX_ALARMS } from "@/lib/alarm";
import { sendDueAlarms } from "@/lib/alarm-send";
import { formatKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 내가 정한 알림(2026-10-26 운영자 요청): 정한 시각·요일에 내가 쓴 문구가 푸시로 온다. 마이페이지에서 만들고 고치고 끄고 지운다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-alarm-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
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

/** 시각 고르기 창(components/time-sheet.tsx)에서 오전/오후, 시, 분을 골라 확인한다. 단추 이름은 "알림 시각 오전 9:00, 바꾸기"다. */
async function pickTime(page: Page, period: "오전" | "오후", hour: number, minute: number) {
  await page.getByRole("button", { name: /^알림 시각 .*바꾸기$/ }).click();
  const sheet = page.getByRole("dialog", { name: "알림 시각" });
  await sheet.getByRole("radio", { name: period }).click();
  await sheet.getByRole("radio", { name: `${hour}시` }).click();
  await sheet.getByRole("radio", { name: `${minute}분` }).click();
  await sheet.getByRole("button", { name: "확인", exact: true }).click();
}

test("마이페이지에서 알림을 만들고, 고치고, 끄고, 지운다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `알람${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });

  // 마이페이지의 알림 칸에서 들어간다.
  await page.goto("/settings");
  await page.getByRole("link", { name: /내가 정한 알림/ }).click();
  await expect(page.getByRole("heading", { name: "내가 정한 알림" })).toBeVisible();
  await expect(page.getByText("아직 만든 알림이 없어요")).toBeVisible();
  // 알림을 받을 기기가 없으면 만들기 전에 알린다.
  await expect(page.getByRole("note")).toContainText("알림을 받을 기기가 없어요");

  // 만들기: 문구가 없으면 거절한다.
  await page.getByRole("button", { name: "+ 알림 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "새 알림" });
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog.getByLabel("알림 문구")).toBeFocused();

  await dialog.getByLabel("알림 문구").fill("물 한 컵 마시기");
  await pickTime(page, "오후", 6, 30);
  await dialog.getByRole("button", { name: "월", exact: true }).click();
  await dialog.getByRole("button", { name: "수", exact: true }).click();
  await dialog.getByRole("button", { name: "금", exact: true }).click();
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole("listitem").filter({ hasText: "물 한 컵 마시기" });
  await expect(row).toContainText("오후 6:30");
  await expect(row).toContainText("월·수·금");
  const saved = await prisma.alarm.findFirstOrThrow({ where: { userId: me.id } });
  expect(saved).toMatchObject({ minute: 18 * 60 + 30, weekdays: [1, 3, 5], message: "물 한 컵 마시기", enabled: true });

  // 고치기: 문구와 요일.
  await row.getByRole("button", { name: "물 한 컵 마시기 고치기" }).click();
  const edit = page.getByRole("dialog", { name: "알림 고치기" });
  await edit.getByLabel("알림 문구").fill("스트레칭");
  await edit.getByRole("button", { name: "월", exact: true }).click(); // 월 빼기
  await edit.getByRole("button", { name: "저장" }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByRole("listitem").filter({ hasText: "스트레칭" })).toContainText("수·금");
  await expect.poll(async () => (await prisma.alarm.findUniqueOrThrow({ where: { id: saved.id } })).weekdays).toEqual([3, 5]);

  // 끄고 켜기.
  const toggle = page.getByRole("switch", { name: "스트레칭 켜기" });
  await toggle.uncheck();
  await expect.poll(async () => (await prisma.alarm.findUniqueOrThrow({ where: { id: saved.id } })).enabled).toBe(false);
  await toggle.check();
  await expect.poll(async () => (await prisma.alarm.findUniqueOrThrow({ where: { id: saved.id } })).enabled).toBe(true);

  // 마이페이지에 몇 개인지 보인다.
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: /내가 정한 알림/ })).toContainText("1개");

  // 지우기.
  await page.goto("/settings/alarms");
  await page.getByRole("button", { name: "스트레칭 고치기" }).click();
  await page.getByRole("dialog", { name: "알림 고치기" }).getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("아직 만든 알림이 없어요")).toBeVisible();
  expect(await prisma.alarm.count({ where: { userId: me.id } })).toBe(0);
});

test("알림은 열 개까지만 만들 수 있다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `한도${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.alarm.createMany({
    data: Array.from({ length: MAX_ALARMS }, (_, index) => ({ userId: me.id, minute: index * 60, message: `알림 ${index + 1}` })),
  });

  await page.goto("/settings/alarms");
  await expect(page.getByRole("button", { name: `알림은 ${MAX_ALARMS}개까지예요` })).toBeDisabled();
  expect(await prisma.alarm.count({ where: { userId: me.id } })).toBe(MAX_ALARMS);
});

test("때가 된 알림은 하루에 한 번만 보내고, 켜 있고 받을 기기가 있는 사람 것만 보낸다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `보냄${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  // 서울 2026-10-26(월) 07:00.
  const now = new Date("2026-10-25T22:00:00Z");
  const due = await prisma.alarm.create({ data: { userId: me.id, minute: 7 * 60, weekdays: [1], message: "약 먹기" } });
  const off = await prisma.alarm.create({ data: { userId: me.id, minute: 7 * 60, message: "꺼 둔 알림", enabled: false } });

  // 받을 기기가 없으면 보낼 곳이 없다.
  expect(await sendDueAlarms(now)).toBe(0);
  expect((await prisma.alarm.findUniqueOrThrow({ where: { id: due.id } })).lastSentOn).toBeNull();

  await prisma.pushToken.create({ data: { userId: me.id, token: `e2e-alarm-token-${RUN_TAG}-${testInfo.testId.slice(-6)}`.padEnd(30, "x"), platform: "android" } });
  expect(await sendDueAlarms(now)).toBe(1);
  expect(formatKST((await prisma.alarm.findUniqueOrThrow({ where: { id: due.id } })).lastSentOn as Date)).toBe("2026-10-26");
  expect((await prisma.alarm.findUniqueOrThrow({ where: { id: off.id } })).lastSentOn).toBeNull();

  // 같은 때에 다시 돌아도 하루에 한 번.
  expect(await sendDueAlarms(now)).toBe(0);
  // 다음 주 월요일에는 다시 간다.
  expect(await sendDueAlarms(new Date("2026-11-01T22:00:00Z"))).toBe(1);
});
