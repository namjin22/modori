import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// PC에서는 끌어서 순서를 바꾸는 손잡이가 마우스를 올려야만 보여, 끌 수 있다는 것을 알 길이 없었다(커서만 바뀜).
const EMAIL = `e2e-draghandle-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test("넓은 화면에서도 순서 손잡이가 마우스를 올리지 않아도 보이고, 무엇인지 말풍선으로 알려 준다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`손잡이${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");
  await addTodo(page, "끌어서 옮길 일");

  const handle = page.getByRole("button", { name: "순서 바꾸기 손잡이" }).first();
  // 마우스는 다른 곳에 둔다(올리지 않은 상태).
  await page.mouse.move(2, 2);
  await expect(handle).toBeVisible();
  expect(await handle.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
  await expect(handle).toHaveAttribute("title", "끌어서 순서 바꾸기");
});
