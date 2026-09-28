import { expect, test as base, type Page } from "@playwright/test";

import { addDays, daysInMonthKST, formatKST, todayKST } from "@/lib/date";
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
  await page.getByRole("button", { name: "저장", exact: true }).click();
  for (let index = 2; index <= 5; index += 1) {
    await page.getByRole("button", { name: "+ 일정 더 적기" }).click();
    await page.getByLabel("새 일정 이름").fill(`일정 ${index}`);
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByRole("listitem").filter({ hasText: `일정 ${index}` })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "+ 일정 더 적기" })).toHaveCount(0);
  await expect(page.getByText("일정은 하루에 5개까지 둘 수 있어요")).toBeVisible();

  // 어제부터 오늘까지 이어지는 일정도 오늘이 꽉 차서 들어가지 않는다.
  await page.goto(`/?date=${formatKST(addDays(today, -1))}`);
  await page.getByRole("button", { name: "시험이나 행사 적어두기" }).click();
  await page.getByLabel("새 일정 이름").fill("이틀짜리");
  await page.getByLabel("새 일정 종료일").fill(formatKST(today));
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "일정이 벌써 5개예요" })).toBeVisible();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(await prisma.event.count({ where: { userId: user.id } })).toBe(5);
});

test("일정에 시간을 넣으면 목록에 시간이 보이고 시간순으로 선다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `시간${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.getByRole("button", { name: "시험이나 행사 적어두기" }).click();
  await page.getByLabel("새 일정 이름").fill("오후 발표");
  await page.getByLabel("새 일정 시작 시간").fill("14:00");
  await page.getByLabel("새 일정 종료 시간").fill("15:30");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "오후 발표" })).toContainText("14:00 ~ 15:30");

  await page.getByRole("button", { name: "+ 일정 더 적기" }).click();
  await page.getByLabel("새 일정 이름").fill("아침 조회");
  await page.getByLabel("새 일정 시작 시간").fill("08:40");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "아침 조회" })).toContainText("08:40");

  // 늦게 만들었어도 이른 시간이 위에 온다.
  const titles = page.getByRole("region", { name: "일정" }).getByRole("listitem");
  await expect(titles.first()).toContainText("아침 조회");

  // 끝나는 시간이 시작보다 이르면 막는다.
  await page.getByRole("button", { name: "+ 일정 더 적기" }).click();
  await page.getByLabel("새 일정 이름").fill("거꾸로");
  await page.getByLabel("새 일정 시작 시간").fill("10:00");
  await page.getByLabel("새 일정 종료 시간").fill("09:00");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "끝나는 시간이 시작 시간보다" })).toBeVisible();

  // 고치는 창에도 시간이 그대로 들어 있다.
  await page.keyboard.press("Escape");
  await openEvent(page, "오후 발표");
  await expect(page.getByLabel("일정 시작 시간", { exact: true })).toHaveValue("14:00");
});

test("달력에서 일정 이름을 다른 날로 끌면 기간이 늘어난다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `끌기${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const today = todayKST();
  // 같은 달 안에서 끈다. 월말이면 앞으로 끌어 시작일을 당긴다.
  const forward = today.getUTCDate() + 2 <= daysInMonthKST(today);
  const target = addDays(today, forward ? 2 : -2);

  await addEvent(page, "잘못 만든 하루");
  const chip = dayCell(page, today).locator("[data-event-id]");
  await expect(chip).toHaveText("잘못 만든 하루");

  const from = await chip.boundingBox();
  const to = await dayCell(page, target).boundingBox();
  if (!from || !to) throw new Error("달력 칸을 찾지 못했다");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  // 끄는 동안 바뀔 기간의 칸이 칠해진다.
  await expect(dayCell(page, target)).toHaveAttribute("data-drag-range", "");
  await page.mouse.up();

  await expect(dayCell(page, target).locator("[data-event-id]")).toHaveText("잘못 만든 하루");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const event = await prisma.event.findFirstOrThrow({ where: { userId: user.id } });
  expect(formatKST(event.startDate)).toBe(formatKST(forward ? today : target));
  expect(formatKST(event.endDate)).toBe(formatKST(forward ? target : today));

  // 끌지 않고 누르면 예전처럼 그날로 간다.
  await dayCell(page, target).locator("[data-event-id]").click();
  await expect(page).toHaveURL(new RegExp(`date=${formatKST(target)}`));
});

test("여러 날 일정의 첫날을 잡고 끌면 시작일이 움직여 줄어든다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `줄이기${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const today = todayKST();
  // 같은 달 안에 사흘짜리 일정을 둔다.
  const first = today.getUTCDate() + 2 <= daysInMonthKST(today) ? today : addDays(today, -2);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.event.create({
    data: { userId: user.id, title: "사흘 일정", startDate: first, endDate: addDays(first, 2), color: "#2563eb" },
  });
  await page.goto("/");

  const from = await dayCell(page, first).locator("[data-event-id]").boundingBox();
  const to = await dayCell(page, addDays(first, 1)).boundingBox();
  if (!from || !to) throw new Error("달력 칸을 찾지 못했다");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(dayCell(page, first).locator("[data-event-id]")).toHaveCount(0);
  const event = await prisma.event.findFirstOrThrow({ where: { userId: user.id } });
  expect(formatKST(event.startDate)).toBe(formatKST(addDays(first, 1)));
  expect(formatKST(event.endDate)).toBe(formatKST(addDays(first, 2)));
});

test("일정은 Enter가 아니라 저장 버튼으로 저장하고, 취소하면 고친 게 남지 않는다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `저장${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  await page.getByRole("button", { name: "시험이나 행사 적어두기" }).click();
  await page.getByLabel("새 일정 이름").fill("수학 시험");
  // Enter는 저장하지 않는다. 날짜 칸을 옮겨 다니다 덜 고친 채 저장되지 않게.
  await page.getByLabel("새 일정 이름").press("Enter");
  await page.getByLabel("새 일정 시작 시간").fill("09:00");
  await page.getByLabel("새 일정 시작 시간").press("Enter");
  expect(await prisma.event.count({ where: { userId: user.id } })).toBe(0);

  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "수학 시험" })).toContainText("09:00");

  // 고치다 취소하면 그대로다.
  await openEvent(page, "수학 시험");
  await page.getByLabel("일정 이름", { exact: true }).fill("영어 시험");
  await page.getByRole("dialog").getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("listitem").filter({ hasText: "수학 시험" })).toBeVisible();

  // 고치고 저장하면 바뀐다.
  await openEvent(page, "수학 시험");
  await page.getByLabel("일정 이름", { exact: true }).fill("영어 시험");
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "영어 시험" })).toBeVisible();
});

