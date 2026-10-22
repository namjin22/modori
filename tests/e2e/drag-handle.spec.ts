import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { addTodo } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 예전에는 PC에 늘 보이는 손잡이(⠿)로 끌었다. 2026-10-14 요청으로 손잡이를 없애고 줄 아무 데나 잡고 끈다.
// 끌 수 있다는 것은 손 모양 커서와 고치기 창의 안내로 알린다. 키보드용 버튼은 Tab으로 왔을 때만 보인다.
const EMAIL = `e2e-draghandle-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test("넓은 화면에는 손잡이가 없고 줄 자체를 잡는다. 그냥 누르면 고치기 창이 열리고 끄는 법을 알려 준다", async ({ page }) => {
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

  // 키보드용 버튼은 화면에 자리를 차지하지 않는다(화면 읽기 전용 크기).
  const keyboardHandle = page.getByRole("button", { name: "순서 바꾸기 손잡이" }).first();
  await page.mouse.move(2, 2);
  const box = await keyboardHandle.boundingBox();
  expect(box && box.width <= 1 && box.height <= 1).toBe(true);

  // 줄에는 잡을 수 있다는 손 모양 커서가 뜬다.
  const row = page.getByRole("listitem").filter({ hasText: "끌어서 옮길 일" });
  await expect(row).toHaveCSS("cursor", "grab");

  // 끌지 않고 누르면 원래대로 고치기 창이 열리고, 끄는 법을 알려 준다.
  await row.getByText("끌어서 옮길 일", { exact: true }).click();
  await expect(page.getByRole("dialog", { name: "할 일" })).toBeVisible();
  await expect(page.getByText("할 일 줄을 잡고 끌면 순서를 바꾸거나 다른 카테고리로 옮길 수 있어요.")).toBeVisible();

  // 창은 줄 안쪽에 있어도 손 모양 커서를 물려받지 않는다(창 안, 창 뒤 어두운 곳 모두). 2026-10-22 제보.
  const dialog = page.getByRole("dialog", { name: "할 일" });
  await expect(dialog).toHaveCSS("cursor", "auto");
  expect(await dialog.evaluate((element) => getComputedStyle(element, "::backdrop").cursor)).toBe("auto");
  // 창 안에서 마우스를 끌어도 뒤의 줄이 집히지 않는다(자리표시가 생기지 않고 창이 그대로다).
  const form = await dialog.boundingBox();
  if (!form) throw new Error("창 위치를 알 수 없다.");
  await page.mouse.move(form.x + 60, form.y + 30);
  await page.mouse.down();
  await page.mouse.move(form.x + 260, form.y + 160, { steps: 8 });
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  await expect(page.locator("[data-row-id].opacity-30")).toHaveCount(0);

  // Tab으로 키보드용 버튼에 오면 그때 보인다.
  await page.keyboard.press("Escape");
  await keyboardHandle.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect.poll(async () => (await keyboardHandle.boundingBox())?.width ?? 0).toBeGreaterThan(10);
});
