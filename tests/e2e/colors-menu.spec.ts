import { expect, test as base, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 더 많은 색(100색·직접 찍기·색상 코드)과 관리 메뉴(카테고리·일정·루틴), 2026-10-19 요청.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-colormenu-${testInfo.testId}-${RUN_TAG}@modori.test`;
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

test("관리 메뉴를 누르면 카테고리·일정·루틴이 나오고, 일정은 이 화면의 만들기 칸을 연다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `메뉴${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const menuButton = page.getByRole("button", { name: "관리 메뉴" });
  await expect(page.getByRole("menu")).toHaveCount(0);
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  const menu = page.getByRole("menu", { name: "관리 메뉴" });
  await expect(menu.getByRole("menuitem")).toHaveCount(3);
  for (const name of ["카테고리", "일정", "루틴"]) await expect(menu.getByRole("menuitem", { name })).toBeVisible();

  // Esc로 닫힌다.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await menuButton.click();
  await page.getByRole("menuitem", { name: "일정" }).click();
  await expect(page.getByLabel("새 일정 이름")).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);

  await menuButton.click();
  await page.getByRole("menuitem", { name: "카테고리" }).click();
  await expect(page).toHaveURL(/\/categories$/);
});

test("더 많은 색에서 100색 중 하나나 색상 코드로 고른 색이 저장되고, 다시 열면 그 색이 골라져 있다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `색${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  // 카테고리: 100색 목록에서 고른다.
  await page.goto("/categories");
  await page.getByPlaceholder("새 카테고리").fill("독서");
  await page.getByRole("button", { name: "더 많은 색" }).click();
  const sheet = page.getByRole("dialog", { name: "색 고르기" });
  await expect(sheet.getByRole("region", { name: "색 목록" }).getByRole("button")).toHaveCount(100);
  const firstListed = (await sheet.getByRole("region", { name: "색 목록" }).getByRole("button").nth(5).getAttribute("aria-label")) ?? "";
  await sheet.getByRole("button", { name: firstListed }).click();
  await expect(sheet.getByLabel("색상 코드")).toHaveValue(firstListed);
  await sheet.getByRole("button", { name: "이 색 쓰기" }).click();
  await expect(page.getByRole("radio", { name: `고른 색 ${firstListed}` })).toBeChecked();
  await page.getByRole("button", { name: "추가" }).click();
  await expect.poll(async () => (await prisma.category.findFirst({ where: { userId: user.id, name: "독서" } }))?.color).toBe(firstListed);

  // 일정: 색상 코드를 직접 친다(대문자·# 없이 쳐도 된다).
  await page.goto("/");
  await page.getByRole("button", { name: "시험이나 행사 적어두기" }).click();
  await page.getByLabel("새 일정 이름").fill("코드 색 일정");
  await page.getByRole("button", { name: "더 많은 색" }).click();
  const codeSheet = page.getByRole("dialog", { name: "색 고르기" });
  await codeSheet.getByLabel("색상 코드").fill("A1B2C3");
  await codeSheet.getByRole("button", { name: "이 색 쓰기" }).click();
  await expect(page.getByRole("radio", { name: "고른 색 #a1b2c3" })).toBeChecked();
  await page.getByLabel("새 일정 이름").press("Enter");
  await expect.poll(async () => (await prisma.event.findFirst({ where: { userId: user.id, title: "코드 색 일정" } }))?.color).toBe("#a1b2c3");

  // 고치러 다시 열면 그 색이 골라진 채다.
  await page.getByRole("region", { name: "일정" }).getByText("코드 색 일정").click();
  await expect(page.getByRole("dialog", { name: "일정" }).getByRole("radio", { name: "고른 색 #a1b2c3" })).toBeChecked();
});

test("색 판을 직접 찍으면 그 자리의 색이 고른 색이 된다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `판${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.goto("/categories");
  await page.getByRole("button", { name: "더 많은 색" }).click();
  const sheet = page.getByRole("dialog", { name: "색 고르기" });
  const before = await sheet.getByLabel("색상 코드").inputValue();
  const plane = sheet.getByRole("slider", { name: "채도와 밝기" });
  const box = await plane.boundingBox();
  if (!box) throw new Error("색 판을 찾지 못했다");
  // 왼쪽 위는 흰색에 가깝다(모서리가 둥글어 끝에서 조금 안쪽을 누른다).
  await page.mouse.click(box.x + 15, box.y + 15);
  await expect(sheet.getByLabel("색상 코드")).not.toHaveValue(before);
  await expect(sheet.getByLabel("색상 코드")).toHaveValue(/^#[d-f][0-9a-f][d-f][0-9a-f][d-f][0-9a-f]$/);
});
