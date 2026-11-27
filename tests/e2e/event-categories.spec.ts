import { expect, test as base, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { createMyColor, homeReady, openEvent } from "./todo-helpers";

// "내 색"(이름 붙은 색, EventCategory): 2026-11-25에 일정 카테고리로 만들었고, 2026-11-26에 색 고르기의 +로 만들며
// 일정·반복 일정·일반 카테고리가 같이 쓰게 넓혔다. 처음부터 있는 색은 없다(11-27에 흰색 기본도 뺐다).

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-evcat-${testInfo.testId}-${RUN_TAG}@modori.test`;
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

test("색 고르기에는 +만 있고(색 없음이 처음 상태), +로 만든 색이 일정에 그 색과 이름으로 붙는다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `내색${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.getByRole("button", { name: "일정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "새 일정" });
  await page.getByLabel("새 일정 이름").fill("기말 평가");
  // 처음부터 있는 색은 없다(예전 여덟 색도 흰색도 없다). 아무것도 고르지 않은 것이 "색 없음"이다.
  await expect(dialog.getByRole("radio")).toHaveCount(0);

  await createMyColor(page, "학교 시험", "#f97316", dialog);
  // 만든 색이 놓이고 골라진다. 이름은 색 아래에 보인다.
  await expect(dialog.getByRole("radio")).toHaveCount(1);
  await expect(page.getByText("학교 시험", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "저장", exact: true }).click();

  // 일정 카드에는 내 색의 이름을 적지 않는다(2026-11-26 운영자 요청). 색 띠만 보인다.
  const card = page.getByRole("listitem").filter({ hasText: "기말 평가" });
  await expect(card).toBeVisible();
  await expect(card).not.toContainText("학교 시험");

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.eventCategory.findFirstOrThrow({ where: { userId: user.id } });
  const event = await prisma.event.findFirstOrThrow({ where: { userId: user.id, title: "기말 평가" } });
  expect(category).toMatchObject({ name: "학교 시험", color: "#f97316" });
  expect(event.categoryId).toBe(category.id);
  expect(event.color).toBe("#f97316");
});

test("색을 고르지 않고 일정과 카테고리를 만들면 색 없음(회색)으로 저장된다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `무색${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  await page.getByRole("button", { name: "일정", exact: true }).click();
  await page.getByLabel("새 일정 이름").fill("색 없는 일정");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "색 없는 일정" })).toBeVisible();
  expect((await prisma.event.findFirstOrThrow({ where: { userId: user.id, title: "색 없는 일정" } })).color).toBe("#8b95a1");

  await page.goto("/categories");
  await page.getByLabel("새 카테고리 이름").fill("색 없는 카테고리");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("색 없는 카테고리", { exact: true })).toBeVisible();
  expect((await prisma.category.findFirstOrThrow({ where: { userId: user.id, name: "색 없는 카테고리" } })).color).toBe("#8b95a1");
});

test("만든 색은 일반 카테고리의 색 고르기에도 나타나고, 고르면 색만 복사된다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `내색카${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.eventCategory.create({ data: { userId: user.id, name: "약속", color: "#7c3aed", order: 0 } });

  await page.goto("/categories");
  await page.getByLabel("새 카테고리 이름").fill("모임");
  await page.getByRole("radio", { name: "약속" }).check();
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("모임", { exact: true })).toBeVisible();

  const category = await prisma.category.findFirstOrThrow({ where: { userId: user.id, name: "모임" } });
  expect(category.color).toBe("#7c3aed");
});

test("카테고리 색 고르기에서 +로 만든 색이 같은 목록에 쌓이고 일정에서도 쓸 수 있다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `내색공${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.goto("/categories");
  await createMyColor(page, "공유색", "#22c55e");
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await expect.poll(async () => prisma.eventCategory.count({ where: { userId: user.id, name: "공유색" } })).toBe(1);

  await page.goto("/");
  await page.getByRole("button", { name: "일정", exact: true }).click();
  await expect(page.getByRole("radio", { name: "공유색" })).toBeVisible();
});

test("카테고리 색을 바꾸면 그 색인 일정과 반복 일정만 같이 바뀐다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `일색${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const day = todayKST();
  const category = await prisma.eventCategory.create({ data: { userId: user.id, name: "약속", color: "#f97316", order: 0 } });
  const same = await prisma.event.create({
    data: { userId: user.id, title: "색 같은 일정", startDate: day, endDate: day, color: "#f97316", categoryId: category.id },
  });
  // AI 연결 등으로 색만 따로 바꿔 둔 일정은 카테고리 색을 바꿔도 그대로여야 한다.
  const changed = await prisma.event.create({
    data: { userId: user.id, title: "색 바꾼 일정", startDate: day, endDate: day, color: "#111827", categoryId: category.id },
  });
  const repeat = await prisma.eventRoutine.create({
    data: { userId: user.id, title: "매일 약속", color: "#f97316", categoryId: category.id, freq: "DAILY", startDate: day },
  });

  await page.goto("/event-categories");
  await page.getByRole("button", { name: "약속 고치기" }).click();
  // 내 색 자신의 색을 바꾸는 창은 "색 고르기"(대표 색·색상 코드)만 쓴다. 고르면 그 자리에서 저장된다.
  await page.getByRole("dialog").getByRole("button", { name: "색 고르기" }).click();
  const sheet = page.getByRole("dialog", { name: "색 고르기" }).last();
  await sheet.getByLabel("색상 코드").fill("#22c55e");
  await sheet.getByRole("button", { name: "이 색 쓰기" }).click();
  await expect(page.getByText("저장했어요")).toBeVisible();

  expect((await prisma.eventCategory.findUniqueOrThrow({ where: { id: category.id } })).color).toBe("#22c55e");
  expect((await prisma.event.findUniqueOrThrow({ where: { id: same.id } })).color).toBe("#22c55e");
  expect((await prisma.event.findUniqueOrThrow({ where: { id: changed.id } })).color).toBe("#111827");
  expect((await prisma.eventRoutine.findUniqueOrThrow({ where: { id: repeat.id } })).color).toBe("#22c55e");
});

test("같은 이름은 만들 수 없고 이유를 알려준다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `일중${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.eventCategory.create({ data: { userId: user.id, name: "여행", color: "#06b6d4", order: 0 } });

  await page.getByRole("button", { name: "일정", exact: true }).click();
  await page.getByRole("button", { name: "새 색 만들기" }).click();
  const sheet = page.getByRole("dialog", { name: "새 색 만들기" });
  await sheet.getByLabel("색 이름").fill("여행");
  await sheet.getByRole("button", { name: "추가", exact: true }).click();
  await expect(sheet.getByRole("alert")).toHaveText("같은 이름이 이미 있어요");
  // 창은 열린 채라 이름을 고쳐 다시 만들 수 있다.
  await sheet.getByLabel("색 이름").fill("여행2");
  await sheet.getByRole("button", { name: "추가", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("radio", { name: "여행2" })).toBeChecked();
});

test("내 색을 지워도 일정과 반복 일정의 색은 남고, 되돌리면 다시 이어진다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `일삭${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const day = todayKST();
  const category = await prisma.eventCategory.create({ data: { userId: user.id, name: "생일", color: "#7c3aed", order: 0 } });
  const event = await prisma.event.create({
    data: { userId: user.id, title: "친구 파티", startDate: day, endDate: day, color: "#7c3aed", categoryId: category.id },
  });
  const repeat = await prisma.eventRoutine.create({
    data: { userId: user.id, title: "매주 모임", color: "#7c3aed", categoryId: category.id, freq: "DAILY", startDate: day },
  });

  await page.goto("/event-categories");
  await page.getByRole("button", { name: "생일 고치기" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("내 색을 지웠어요. 일정과 카테고리의 색은 남아요")).toBeVisible();

  const after = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
  expect(after.categoryId).toBeNull();
  expect(after.color).toBe("#7c3aed");
  expect((await prisma.eventRoutine.findUniqueOrThrow({ where: { id: repeat.id } })).categoryId).toBeNull();

  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("button", { name: "생일 고치기" })).toBeVisible();
  expect((await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).categoryId).toBe(category.id);
  expect((await prisma.eventRoutine.findUniqueOrThrow({ where: { id: repeat.id } })).categoryId).toBe(category.id);
});

test("고치는 창에는 붙어 있던 내 색이 골라져 있고, 한 번 더 눌러 고르지 않으면 이름이 떨어지고 회색(색 없음)이 된다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `일직${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const day = todayKST();
  const category = await prisma.eventCategory.create({ data: { userId: user.id, name: "학교", color: "#7c3aed", order: 0 } });
  const event = await prisma.event.create({
    data: { userId: user.id, title: "동아리 발표", startDate: day, endDate: day, color: "#7c3aed", categoryId: category.id },
  });

  await page.goto("/");
  await expect(homeReady(page)).toBeVisible();
  await openEvent(page, "동아리 발표");
  await expect(page.getByRole("radio", { name: "학교", exact: true })).toBeChecked();
  // 고른 색을 한 번 더 누르면 고르지 않은 상태(색 없음)가 된다.
  await page.getByRole("radio", { name: "학교", exact: true }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  const after = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
  expect(after.categoryId).toBeNull();
  expect(after.color).toBe("#8b95a1");
});

test("반복 일정도 내 색을 골라 만들고 고친다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `반색${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.eventCategory.create({ data: { userId: user.id, name: "학원", color: "#2563eb", order: 0 } });

  await page.goto("/routines");
  await page.getByText("루틴 만들기").click();
  await page.getByRole("radio", { name: "일정" }).click();
  await page.getByLabel("반복 일정 이름").fill("수학 학원");
  await page.getByRole("radio", { name: "학원", exact: true }).check();
  await page.getByRole("button", { name: "루틴 추가" }).click();
  await expect(page.getByRole("status").filter({ hasText: "반복 일정을 만들었어요." })).toBeVisible();

  const made = await prisma.eventRoutine.findFirstOrThrow({ where: { userId: user.id, title: "수학 학원" } });
  expect(made).toMatchObject({ categoryId: category.id, color: "#2563eb" });

  // 홈의 반복 일정 줄에는 내 색의 이름을 적지 않는다.
  await page.goto("/");
  const list = page.getByRole("region", { name: "일정" }).getByRole("list", { name: "반복 일정" });
  await expect(list).toContainText("↻ 매일");
  await expect(list).not.toContainText("· 학원");

  // 고치는 창: 붙어 있는 색이 골라져 있다.
  await page.goto("/routines");
  await page.getByRole("button", { name: "고치기" }).click();
  await expect(page.getByRole("dialog", { name: "반복 일정 고치기" }).getByRole("radio", { name: "학원", exact: true })).toBeChecked();
});
