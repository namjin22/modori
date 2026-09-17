import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-undo-${testInfo.testId}@modori.test`;
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
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByLabel("할 일 내용", { exact: true })).toBeVisible();
}

// 브라우저 기본 확인창이 뜨면 바로 실패시킨다. 이제 확인 없이 지운다.
function failOnDialog(page: Page) {
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
    throw new Error(`확인창이 뜨면 안 된다: ${dialog.message()}`);
  });
}

async function createDailyRoutine(page: Page, content: string) {
  await page.goto("/settings/routines");
  await page.getByText("루틴 만들기").click();
  await page.getByLabel("루틴 내용").fill(content);
  await page.getByRole("radio", { name: "매일" }).click();
  await page.getByRole("button", { name: "루틴 추가" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: content })).toBeVisible();
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("할 일은 확인 없이 지워지고 되돌리기로 살아난다", async ({ page, email }, testInfo) => {
  failOnDialog(page);
  await signInAndOnboard(page, email, `되돌${testInfo.testId.slice(-6)}`);

  await page.getByLabel("할 일 내용", { exact: true }).fill("잠깐 지울 일");
  await page.getByLabel("카테고리", { exact: true }).selectOption({ label: "공부" });
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.getByRole("button", { name: "완료 취소" })).toBeVisible();

  const row = page.getByRole("listitem").filter({ hasText: "잠깐 지울 일" });
  await row.getByText("수정").click();
  // 할 일 줄에서 순서 화살표는 없어졌다. 손잡이로만 옮긴다.
  await expect(row.getByRole("button", { name: "위로" })).toHaveCount(0);
  await row.getByRole("button", { name: "삭제" }).click();

  await expect(page.getByText("아직 할 일이 없다")).toBeVisible();
  await expect(page.getByRole("status", { name: "알림" })).toContainText("할 일을 지웠어요");

  await page.getByRole("button", { name: "되돌리기" }).click();

  // 카테고리와 완료 상태까지 그대로 돌아온다.
  const restored = page.getByRole("listitem").filter({ hasText: "잠깐 지울 일" });
  await expect(restored).toBeVisible();
  await expect(restored.getByRole("button", { name: "완료 취소" })).toBeVisible();
  await expect(page.locator('section span:text-is("공부")')).toBeVisible();

  // 새로고침해도 남아 있어야 진짜 되살린 것이다.
  await page.reload();
  // 완료한 일은 달력 칸에도 이름이 뜨므로 목록 안에서 찾는다.
  await expect(page.getByRole("listitem").filter({ hasText: "잠깐 지울 일" })).toBeVisible();
});

test("루틴이 만든 오늘 할 일은 지우면 다시 생기지 않는다", async ({ page, email }, testInfo) => {
  failOnDialog(page);
  await signInAndOnboard(page, email, `건너${testInfo.testId.slice(-6)}`);
  await createDailyRoutine(page, "물 두 잔");

  await page.goto("/");
  const row = page.getByRole("listitem").filter({ hasText: "물 두 잔" });
  await expect(row).toBeVisible();

  await row.getByText("수정").click();
  await row.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("아직 할 일이 없다")).toBeVisible();

  // 화면을 다시 그려도 "없으니 만든다"가 돌지 않아야 한다.
  await page.reload();
  await expect(page.getByText("물 두 잔")).toBeHidden();

  // 루틴은 그대로 살아 있다.
  await page.goto("/settings/routines");
  await expect(page.getByRole("listitem").filter({ hasText: "물 두 잔" })).toBeVisible();
});

test("지운 루틴을 되돌리면 만들어 둔 할 일과 다시 이어진다", async ({ page, email }, testInfo) => {
  failOnDialog(page);
  await signInAndOnboard(page, email, `루되${testInfo.testId.slice(-6)}`);
  await createDailyRoutine(page, "일기 쓰기");

  // 오늘 화면을 열어 루틴 할 일을 만든다.
  await page.goto("/");
  await expect(page.getByText("일기 쓰기")).toBeVisible();

  await page.goto("/settings/routines");
  await page
    .getByRole("listitem")
    .filter({ hasText: "일기 쓰기" })
    .getByRole("button", { name: "삭제" })
    .click();
  await expect(page.getByText("아직 루틴이 없다")).toBeVisible();

  await page.getByRole("button", { name: "되돌리기" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "일기 쓰기" })).toBeVisible();

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const routine = await prisma.routine.findFirstOrThrow({ where: { userId: user.id } });
  const todos = await prisma.todo.findMany({ where: { userId: user.id } });
  expect(todos).toHaveLength(1);
  expect(todos[0].routineId).toBe(routine.id);

  // 이어졌으므로 오늘 화면을 다시 열어도 같은 할 일이 하나 더 생기지 않는다.
  await page.goto("/");
  await expect(page.getByText("일기 쓰기")).toHaveCount(1);
});
