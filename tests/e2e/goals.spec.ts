import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, parseKSTDate, todayKST } from "@/lib/date";
import { LIMITS } from "@/lib/limits";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { homeReady } from "./todo-helpers";

// 목표(2026-11-19, docs/decisions.md): 홈 위쪽 목표 칸, 관리 메뉴의 "목표", 세부 목표 직접 체크, 기한(선택), 친구 공개(기본 공개, 비공개 스위치), 상한.
const test = base.extend<{ emails: { me: string; friend: string } }>({
  emails: async ({}, provide, testInfo) => {
    const tag = testInfo.testId.slice(-6);
    const emails = { me: `e2e-goal-me-${tag}-${RUN_TAG}@modori.test`, friend: `e2e-goal-you-${tag}-${RUN_TAG}@modori.test` };
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await provide(emails);
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
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

const section = (page: Page) => page.getByRole("region", { name: "목표", exact: true });
const day = (offset: number) => formatKST(addDays(todayKST(), offset));

test("관리 메뉴의 목표로 만들면 기본은 공개이고, 세부 목표를 더해 체크하면 진행이 오르며, 다 하면 달성이다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `나목${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });

  // 목표가 없으면 점선 상자가 보이고, 누르면 만들기 칸이 열린다(관리 메뉴에는 목표 항목이 없다, 2026-11-19).
  await section(page).getByRole("button", { name: "이루고 싶은 큰 목표 적어두기" }).click();
  await page.getByLabel("새 목표 이름").fill("토익 900점");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const card = page.getByRole("button", { name: "토익 900점 펼치기" });
  await expect(card).toBeVisible();
  const goal = await prisma.goal.findFirstOrThrow({ where: { userId: me.id, title: "토익 900점" } });
  expect(goal).toMatchObject({ parentId: null, isPublic: true, dueDate: null, doneAt: null });

  // 세부 목표가 없는 목표는 바로 체크할 수 있다.
  const leafCheck = page.getByRole("checkbox", { name: "토익 900점 달성 표시" });
  await expect(leafCheck).toHaveAttribute("aria-checked", "false");

  // 펼쳐서 세부 목표를 더한다. 더하면 목표의 직접 체크 칸은 사라진다(세부 목표를 센 값이다).
  await card.click();
  await expect(page.getByText("세부 목표를 더하면 하나씩 체크하며 진행을 볼 수 있어요.")).toBeVisible();
  for (const title of ["단어 1000개", "LC 모의고사 5회"]) {
    await page.getByLabel("토익 900점의 세부 목표 이름").fill(title);
    await page.getByRole("button", { name: "추가", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: `${title} 달성 표시` })).toBeVisible();
  }
  await expect(leafCheck).toHaveCount(0);
  await expect(page.getByRole("progressbar", { name: "세부 목표 2개 중 0개 달성" })).toBeVisible();
  expect(await prisma.goal.count({ where: { userId: me.id, parentId: goal.id } })).toBe(2);

  // 하나 체크하면 1/2, 둘 다 하면 달성 표시. 다시 끄면 돌아온다.
  const first = page.getByRole("checkbox", { name: "단어 1000개 달성 표시" });
  await first.click();
  await expect(first).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("progressbar", { name: "세부 목표 2개 중 1개 달성" })).toBeVisible();
  await expect(section(page).getByText("1/2")).toBeVisible();
  await expect.poll(async () => (await prisma.goal.findFirstOrThrow({ where: { userId: me.id, title: "단어 1000개" } })).doneAt !== null).toBe(true);

  await page.getByRole("checkbox", { name: "LC 모의고사 5회 달성 표시" }).click();
  await expect(section(page).getByText("달성", { exact: true })).toBeVisible();
  await first.click();
  await expect(section(page).getByText("달성", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("progressbar", { name: "세부 목표 2개 중 1개 달성" })).toBeVisible();

  // 세부 목표 지우기.
  await page.getByRole("button", { name: "LC 모의고사 5회 지우기" }).click();
  await expect(page.getByRole("checkbox", { name: "LC 모의고사 5회 달성 표시" })).toHaveCount(0);
  await expect.poll(() => prisma.goal.count({ where: { userId: me.id, parentId: goal.id } })).toBe(1);

  // 목표 지우기는 되돌릴 수 있다(세부 목표까지 되살아난다).
  await page.getByRole("button", { name: "고치기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "목표 고치기" });
  await dialog.getByLabel("목표 이름").fill("토익 950점");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  // 고친 뒤에도 카드는 펼쳐진 채라 이름표가 "접기"다(처음 만든 카드는 접힌 "펼치기").
  await expect(page.getByRole("button", { name: /^토익 950점 (펼치기|접기)$/ })).toBeVisible();
  await page.getByRole("button", { name: "고치기", exact: true }).click();
  await page.getByRole("dialog", { name: "목표 고치기" }).getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("button", { name: /^토익 950점 (펼치기|접기)$/ })).toHaveCount(0);
  expect(await prisma.goal.count({ where: { userId: me.id } })).toBe(0);
  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("button", { name: "토익 950점 펼치기" })).toBeVisible();
  const restored = await prisma.goal.findMany({ where: { userId: me.id }, orderBy: { createdAt: "asc" } });
  expect(restored.map((row) => [row.title, row.parentId === null ? "목표" : "세부"])).toEqual([["토익 950점", "목표"], ["단어 1000개", "세부"]]);
});

test("비공개 스위치를 켜면 나만 보고, 목표 카드에 잠금 표시가 붙는다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `나비${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });

  await section(page).getByRole("button", { name: "이루고 싶은 큰 목표 적어두기" }).click();
  await page.getByLabel("새 목표 이름").fill("남에게 말 못 할 목표");
  // 스위치는 기본이 꺼짐(공개)이다. 켜면 나만 본다.
  const privateSwitch = page.getByRole("checkbox", { name: /^비공개/ });
  await expect(privateSwitch).not.toBeChecked();
  await privateSwitch.check();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("button", { name: "남에게 말 못 할 목표 펼치기" })).toBeVisible();
  await expect(section(page).getByRole("img", { name: "비공개 목표" })).toBeVisible();
  expect((await prisma.goal.findFirstOrThrow({ where: { userId: me.id } })).isPublic).toBe(false);
});

test("친구에게는 공개한 목표만 보이고(비공개는 페이지 데이터에도 없다), 팔로우하지 않으면 아무것도 안 보인다", async ({ page, emails }, testInfo) => {
  const tag = testInfo.testId.slice(-6);
  await signUp(page, emails.me, `나공${tag}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  const friend = await prisma.user.create({ data: { email: emails.friend, nickname: `친공${tag}${RUN_TAG}` } });
  await prisma.goal.create({
    data: {
      userId: friend.id,
      title: "공개한 큰 목표",
      isPublic: true,
      children: { create: [{ userId: friend.id, title: "공개한 세부 하나", doneAt: new Date() }, { userId: friend.id, title: "공개한 세부 둘" }] },
    },
  });
  await prisma.goal.create({
    data: { userId: friend.id, title: "숨긴 큰 목표", isPublic: false, children: { create: [{ userId: friend.id, title: "숨긴 세부 하나" }] } },
  });
  await prisma.follow.create({ data: { followerId: me.id, followingId: friend.id } });

  const response = await page.goto(`/feed/u/${friend.id}`);
  const html = (await response?.text()) ?? "";
  await expect(page.getByRole("region", { name: "목표", exact: true }).getByText("공개한 큰 목표")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "세부 목표 2개 중 1개 달성" })).toBeVisible();
  // 세부 목표는 눌러서 펼친다. 친구 화면에서는 체크할 수 없다.
  await page.getByText("공개한 큰 목표").click();
  await expect(page.getByText("공개한 세부 하나")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  // 숨긴 목표와 그 세부 목표는 화면에도, 서버가 보낸 페이지 안에도 없다.
  await expect(page.getByText("숨긴 큰 목표")).toHaveCount(0);
  expect(html).not.toContain("숨긴 큰 목표");
  expect(html).not.toContain("숨긴 세부 하나");

  // 친구가 비공개로 돌리면 사라진다.
  await prisma.goal.updateMany({ where: { userId: friend.id, title: "공개한 큰 목표" }, data: { isPublic: false } });
  await page.reload();
  await expect(page.getByText("공개한 큰 목표")).toHaveCount(0);

  // 팔로우하지 않은 사람에게는 공개 목표도 가지 않는다.
  await prisma.goal.updateMany({ where: { userId: friend.id, title: "공개한 큰 목표" }, data: { isPublic: true } });
  await prisma.follow.delete({ where: { followerId_followingId: { followerId: me.id, followingId: friend.id } } });
  const unfollowed = await page.goto(`/feed/u/${friend.id}`);
  expect(await unfollowed?.text()).not.toContain("공개한 큰 목표");
});

test("기한은 선택이다: 남은 날은 D-n, 오늘은 D-DAY, 지난 날은 D+n으로 보이고, 10년이 넘는 먼 날짜도 둘 수 있다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `나기${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  await prisma.goal.createMany({
    data: [
      { userId: me.id, title: "삼 일 뒤", dueDate: parseKSTDate(day(3)) },
      { userId: me.id, title: "오늘까지", dueDate: parseKSTDate(day(0)) },
      { userId: me.id, title: "이틀 지남", dueDate: parseKSTDate(day(-2)) },
    ],
  });
  await page.reload();
  const card = (title: string) => page.getByRole("button", { name: `${title} 펼치기` });
  await expect(card("삼 일 뒤")).toContainText("D-3");
  await expect(card("오늘까지")).toContainText("D-DAY");
  await expect(card("이틀 지남")).toContainText("D+2");

  // 기한 없이도, 기한을 먼 미래로도 만들 수 있다(할 일 날짜 범위 10년과 별개).
  await prisma.goal.create({ data: { userId: me.id, title: "아주 먼 목표", dueDate: parseKSTDate("2099-12-31") } });
  await page.reload();
  // 기한이 가장 먼 목표는 맨 뒤라 처음 보이는 3개 밖이다. 더 보기로 펼친다.
  await section(page).getByRole("button", { name: "더 보기 (1)" }).click();
  await expect(card("아주 먼 목표")).toBeVisible();
  await expect(card("아주 먼 목표")).toContainText(/D-\d{5}/);
});

test("처음에는 3개까지만 보이고 나머지는 더 보기로 펼친다. 상한(목표 20개, 세부 목표 20개)을 넘으면 알려 준다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `나상${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  await prisma.goal.createMany({ data: Array.from({ length: 5 }, (_, index) => ({ userId: me.id, title: `목표 ${index + 1}` })) });
  await page.reload();
  await expect(section(page).getByRole("button", { name: /펼치기$/ })).toHaveCount(3);
  await section(page).getByRole("button", { name: "더 보기 (2)" }).click();
  await expect(section(page).getByRole("button", { name: /펼치기$/ })).toHaveCount(5);
  await section(page).getByRole("button", { name: "접기", exact: true }).click();
  await expect(section(page).getByRole("button", { name: /펼치기$/ })).toHaveCount(3);

  // 목표 20개를 채우면 더 못 만든다.
  await prisma.goal.createMany({ data: Array.from({ length: LIMITS.goals - 5 }, (_, index) => ({ userId: me.id, title: `채움 ${index + 1}` })) });
  await page.reload();
  expect(await prisma.goal.count({ where: { userId: me.id, parentId: null } })).toBe(LIMITS.goals);
  // 20개가 차면 제목 줄의 "+ 추가"가 없다. 제목을 눌러 열 수는 있지만 서버가 막는다.
  await expect(section(page).getByRole("button", { name: "목표 더 넣기" })).toHaveCount(0);
  await section(page).getByRole("button", { name: "목표", exact: true }).click();
  await page.getByLabel("새 목표 이름").fill("스물한 번째");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "목표는 20개까지 만들 수 있어요." })).toBeVisible();
  expect(await prisma.goal.count({ where: { userId: me.id, parentId: null } })).toBe(LIMITS.goals);
});

test("세부 목표가 20개 찬 목표는 더 넣을 칸 대신 안내가 보인다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `나세${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  await prisma.goal.create({
    data: {
      userId: me.id,
      title: "세부가 가득",
      children: { create: Array.from({ length: LIMITS.subGoalsPerGoal }, (_, index) => ({ userId: me.id, title: `세부 ${index + 1}` })) },
    },
  });
  await page.reload();
  await page.getByRole("button", { name: "세부가 가득 펼치기" }).click();
  await expect(page.getByText("세부 목표는 목표 하나에 20개까지 넣을 수 있어요.")).toBeVisible();
  await expect(page.getByLabel("세부가 가득의 세부 목표 이름")).toHaveCount(0);
});
