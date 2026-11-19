import { expect, test as base, type Page } from "@playwright/test";

import { addDays, todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { homeReady } from "./todo-helpers";

// 일정 만들기 팝업과 "다가오는 일정" 토글(2026-11-19 운영자 요청): 일정은 팝업에서 만들고, 다가오는 일정은 일정 제목 옆 작은 토글을 눌러 한꺼번에 펼친다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-evpopup-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
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

const section = (page: Page) => page.getByRole("region", { name: "일정" });

test("다가오는 일정은 접혀 있다가 제목 옆 토글을 누르면 한꺼번에 펼쳐지고, 셋을 넘어도 모두 보이며, 항목을 누르면 고치는 창이 뜬다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `토글${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const today = todayKST();
  await prisma.event.createMany({
    data: Array.from({ length: 5 }, (_, index) => ({ userId: me.id, title: `먼 일정 ${index + 1}`, startDate: addDays(today, index + 2), endDate: addDays(today, index + 2), color: "#2563eb" })),
  });
  await page.reload();
  await expect(homeReady(page)).toBeVisible();

  // 처음에는 접혀 있다. 토글에 개수가 보이고, 목록은 없다.
  const toggle = section(page).getByRole("button", { name: "다가오는 일정 5개 펼치기" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toContainText("5");
  await expect(section(page).getByRole("button", { name: /먼 일정/ })).toHaveCount(0);

  // 누르면 5개가 한꺼번에(셋 제한 없이) 펼쳐지고 D-day가 보인다. 토글은 "접기"로 바뀐다.
  await toggle.click();
  const collapse = section(page).getByRole("button", { name: "다가오는 일정 5개 접기" });
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  for (let index = 1; index <= 5; index += 1) await expect(section(page).getByRole("button", { name: new RegExp(`먼 일정 ${index}`) })).toBeVisible();
  await expect(section(page).getByRole("button", { name: /먼 일정 1/ })).toContainText("D-2");

  // 항목을 누르면 일정을 고치는 창이 뜬다.
  await section(page).getByRole("button", { name: /먼 일정 3/ }).click();
  await expect(page.getByLabel("일정 이름", { exact: true })).toHaveValue("먼 일정 3");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // 다시 누르면 접힌다.
  await collapse.click();
  await expect(section(page).getByRole("button", { name: /먼 일정/ })).toHaveCount(0);
  await expect(section(page).getByRole("button", { name: "다가오는 일정 5개 펼치기" })).toHaveAttribute("aria-expanded", "false");
});

test("다가오는 일정이 없으면 토글도 없다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `토글없음${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await expect(section(page).getByRole("button", { name: /다가오는 일정/ })).toHaveCount(0);
});

test("일정 만들기 팝업에서 저장하면 팝업이 닫히고 일정이 목록에 생긴다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `팝업${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const dialog = page.getByRole("dialog", { name: "새 일정" });

  await section(page).getByRole("button", { name: "시험이나 행사 적어두기" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("새 일정 이름").fill("팝업으로 만든 일정");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("listitem").filter({ hasText: "팝업으로 만든 일정" })).toBeVisible();
  expect(await prisma.event.count({ where: { userId: me.id, title: "팝업으로 만든 일정" } })).toBe(1);

  // 일정이 생긴 뒤에는 제목 줄의 "+ 추가"로도 같은 팝업이 열린다.
  await section(page).getByRole("button", { name: "+ 일정 더 적기" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(dialog).toBeHidden();
});
