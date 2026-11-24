import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { addTodo, homeReady, openTodo } from "./todo-helpers";

// 할 일·일정 창의 세부 할 일·메모를 따로 넘어가는 화면으로(2026-11-24 운영자 요청: 한 화면에 다 떠서 조잡하다).
// 첫 화면에는 "세부 할 일 ›", "메모 ›" 줄만 있고, 누르면 같은 창 안에서 그 칸만 보인다. 창의 이름은 그대로다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-detail-${testInfo.testId.slice(-8)}-${RUN_TAG}@modori.test`;
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

const todoOf = (email: string, content: string) => prisma.todo.findFirst({ where: { user: { email }, content } });
// 폼으로 보낸 여러 줄 글은 줄바꿈이 \r\n으로 바뀌어 오고, 메모는 그대로 저장된다(이 변경 전부터의 동작). 줄바꿈만 맞춰 견준다.
const memoOf = async (email: string, content: string) => (await todoOf(email, content))?.memo?.replace(/\r\n/g, "\n");

test("할 일 창: 첫 화면에는 메모·세부 할 일 칸이 없고, 줄을 눌러 넘어가 적는다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `세부${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await addTodo(page, "수학 수행 준비");
  await openTodo(page, "수학 수행 준비");
  const dialog = page.getByRole("dialog", { name: "할 일" });

  // 첫 화면: 이름·날짜 옮기기와 두 줄. 메모 칸과 세부 할 일 칸은 보이지 않는다.
  await expect(dialog.getByLabel("할 일 내용 수정")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "내일 하기" })).toBeVisible();
  await expect(dialog.getByLabel("할 일 메모")).toBeHidden();
  await expect(dialog.getByLabel(/세부 할 일 이름/)).toBeHidden();
  await expect(dialog.getByRole("checkbox", { name: /메모 비공개/ })).toBeHidden();

  // 메모 화면: 메모 칸과 공개 설정만 보이고 삭제는 없다. 적은 첫 줄이 돌아온 첫 화면의 줄에 요약된다.
  await dialog.getByRole("button", { name: "메모 없음" }).click();
  const memo = dialog.getByLabel("할 일 메모");
  await expect(memo).toBeVisible();
  await expect(memo).toBeFocused();
  await expect(dialog.getByRole("checkbox", { name: /메모 비공개/ })).toBeVisible();
  await expect(dialog.getByLabel("할 일 내용 수정")).toBeHidden();
  await expect(dialog.getByRole("button", { name: "삭제" })).toHaveCount(0);
  await memo.fill("3단원 문제 풀기\n계산기 챙기기");
  await dialog.getByRole("button", { name: "할 일로 돌아가기" }).click();
  await expect(dialog.getByRole("button", { name: "메모 3단원 문제 풀기" })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "삭제" })).toBeVisible();

  // 첫 화면에서 저장해도 숨겨진 메모가 함께 저장된다.
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => memoOf(email, "수학 수행 준비")).toBe("3단원 문제 풀기\n계산기 챙기기");

  // 세부 할 일 화면: 없으면 안내가 보이고, 적으면 바로 달려 목록과 첫 화면 줄의 개수가 바뀐다.
  // 메모가 생기면 줄 버튼의 이름에 메모 글이 붙어서 앞부분으로 찾는다(memo.spec.ts와 같다).
  await page.getByRole("button", { name: /^수학 수행 준비/ }).first().click();
  await expect(dialog.getByLabel("할 일 내용 수정")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "메모 3단원 문제 풀기" })).toBeVisible();
  await dialog.getByRole("button", { name: "세부 할 일 없음" }).click();
  await expect(dialog.getByText("아직 세부 할 일이 없어요.", { exact: false })).toBeVisible();
  const adder = dialog.getByLabel("수학 수행 준비의 세부 할 일 이름");
  await expect(adder).toBeFocused();
  await adder.fill("1단원 복습");
  await adder.press("Enter");
  await expect(dialog.getByRole("listitem").filter({ hasText: "1단원 복습" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "삭제" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "할 일로 돌아가기" }).click();
  await expect(dialog.getByRole("button", { name: "세부 할 일 1개" })).toBeFocused();
  await expect.poll(async () => prisma.todo.count({ where: { user: { email }, content: "1단원 복습", parentId: { not: null } } })).toBe(1);

  // 메모 화면에서 바로 저장해도 된다.
  await dialog.getByRole("button", { name: "메모 3단원 문제 풀기" }).click();
  await dialog.getByLabel("할 일 메모").fill("계산기만");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => memoOf(email, "수학 수행 준비")).toBe("계산기만");
});

test("일정 창: 메모만 따로 넘어가고, 나머지는 첫 화면에 그대로 있다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `일정세${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.getByRole("button", { name: "일정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "새 일정" });

  await expect(dialog.getByLabel("새 일정 이름")).toBeVisible();
  await expect(dialog.getByText("D-day 보이기")).toBeVisible();
  await expect(dialog.getByLabel("새 일정 메모")).toBeHidden();

  await dialog.getByLabel("새 일정 이름").fill("동아리 발표");
  await dialog.getByRole("button", { name: "메모 없음" }).click();
  await expect(dialog.getByLabel("새 일정 메모")).toBeFocused();
  await expect(dialog.getByLabel("새 일정 이름")).toBeHidden();
  await dialog.getByLabel("새 일정 메모").fill("노트북 충전기");
  await dialog.getByRole("button", { name: "일정으로 돌아가기" }).click();
  await expect(dialog.getByRole("button", { name: "메모 노트북 충전기" })).toBeFocused();
  await dialog.getByRole("button", { name: "저장", exact: true }).click();

  await expect(page.getByRole("listitem").filter({ hasText: "동아리 발표" })).toContainText("노트북 충전기");
  await expect.poll(async () => (await prisma.event.findFirst({ where: { user: { email }, title: "동아리 발표" } }))?.memo).toBe("노트북 충전기");
});
