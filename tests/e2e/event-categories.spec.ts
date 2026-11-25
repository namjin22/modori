import { expect, test as base, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { homeReady, openEvent } from "./todo-helpers";

// 일정에 쓰는 "이름 붙은 색"(일정 카테고리, 2026-11-25). 할 일 카테고리와는 따로다.

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

/** 일정 카테고리 화면에서 이름을 적고(색은 기본 주황) "추가"를 누른다. */
async function addEventCategory(page: Page, name: string) {
  await page.getByLabel("새 일정 카테고리 이름").fill(name);
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByRole("button", { name: `${name} 고치기` })).toBeVisible();
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("이름 붙은 색을 만들어 일정에서 고르면 그 색과 이름이 일정에 붙는다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `일카${testInfo.testId.slice(-6)}${RUN_TAG}`);

  // 할 일 카테고리 화면에서 들어간다.
  await page.goto("/categories");
  await page.getByRole("link", { name: "일정 카테고리" }).click();
  await expect(page.getByRole("heading", { name: "일정 카테고리" })).toBeVisible();
  await addEventCategory(page, "학교 시험");

  await page.goto("/");
  await expect(homeReady(page)).toBeVisible();
  await page.getByRole("button", { name: "일정", exact: true }).click();
  await page.getByLabel("새 일정 이름").fill("기말 평가");
  await page.getByRole("button", { name: "학교 시험", exact: true }).click();
  await expect(page.getByRole("button", { name: "학교 시험", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "저장", exact: true }).click();

  // 일정 카드에 이름이 같이 보인다.
  const card = page.getByRole("listitem").filter({ hasText: "기말 평가" });
  await expect(card).toContainText("학교 시험");

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.eventCategory.findFirstOrThrow({ where: { userId: user.id } });
  const event = await prisma.event.findFirstOrThrow({ where: { userId: user.id, title: "기말 평가" } });
  expect(category.color).toBe("#f97316");
  expect(event.categoryId).toBe(category.id);
  expect(event.color).toBe("#f97316");
});

test("카테고리가 없으면 일정 만들기 창은 예전처럼 색 견본만 보인다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `일견${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.getByRole("button", { name: "일정", exact: true }).click();
  await expect(page.getByLabel("새 일정 이름")).toBeVisible();
  await expect(page.getByLabel("초록")).toBeVisible();
  await expect(page.getByRole("button", { name: "직접 고르기" })).toHaveCount(0);
});

test("카테고리 색을 바꾸면 그 색인 일정만 같이 바뀐다", async ({ page, email }, testInfo) => {
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

  await page.goto("/event-categories");
  await page.getByRole("button", { name: "약속 고치기" }).click();
  await page.getByRole("dialog").getByLabel("초록").check();
  await expect(page.getByText("저장했어요")).toBeVisible();

  expect((await prisma.eventCategory.findUniqueOrThrow({ where: { id: category.id } })).color).toBe("#22c55e");
  expect((await prisma.event.findUniqueOrThrow({ where: { id: same.id } })).color).toBe("#22c55e");
  expect((await prisma.event.findUniqueOrThrow({ where: { id: changed.id } })).color).toBe("#111827");
});

test("같은 이름은 만들 수 없고 이유를 알려준다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `일중${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.goto("/event-categories");
  await addEventCategory(page, "여행");
  await page.getByLabel("새 일정 카테고리 이름").fill("여행");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("같은 이름이 이미 있어요")).toBeVisible();
  // 적던 이름은 지워지지 않는다.
  await expect(page.getByLabel("새 일정 카테고리 이름")).toHaveValue("여행");
  await expect(page.getByRole("button", { name: "여행 고치기" })).toHaveCount(1);
});

test("카테고리를 지워도 일정과 색은 남고, 되돌리면 다시 이어진다", async ({ page, email }, testInfo) => {
  await signInAndOnboard(page, email, `일삭${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const day = todayKST();
  const category = await prisma.eventCategory.create({ data: { userId: user.id, name: "생일", color: "#7c3aed", order: 0 } });
  const event = await prisma.event.create({
    data: { userId: user.id, title: "친구 파티", startDate: day, endDate: day, color: "#7c3aed", categoryId: category.id },
  });

  await page.goto("/event-categories");
  await page.getByRole("button", { name: "생일 고치기" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("일정 카테고리를 지웠어요. 일정과 색은 남아요")).toBeVisible();

  const after = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
  expect(after.categoryId).toBeNull();
  expect(after.color).toBe("#7c3aed");

  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("button", { name: "생일 고치기" })).toBeVisible();
  const restored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
  expect(restored.categoryId).toBe(category.id);
});

test("고치는 창에서 직접 고르기로 바꾸면 카테고리가 떨어지고 고른 색이 남는다", async ({ page, email }, testInfo) => {
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
  // 붙어 있던 카테고리가 골라진 채로 열린다.
  await expect(page.getByRole("button", { name: "학교", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "직접 고르기" }).click();
  await page.getByLabel("빨강").check();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  const after = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
  expect(after.categoryId).toBeNull();
  expect(after.color).toBe("#dc2626");
});
