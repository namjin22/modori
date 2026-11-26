import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, parseKSTDate, todayIn } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { homeReady } from "./todo-helpers";

// 일기를 읽는 화면과 쓰는 화면을 나눴다(2026-11-24 운영자 요청: 들어가면 늘 고치는 화면이라 별로다).
// /diary/날짜는 읽기, /diary/날짜/edit는 쓰기. 홈 카드는 내용을 보이지 않고 누르면 읽는 화면이 열린다.
const TODAY = formatKST(todayIn("Asia/Seoul"));
const day = (offset: number) => formatKST(addDays(parseKSTDate(TODAY), offset));

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-diaryview-${testInfo.testId.slice(-8)}-${RUN_TAG}@modori.test`;
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

test("빈 카드는 쓰기로, 저장하면 읽기로, 홈 카드는 글을 보이며 읽기로 간다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `읽기${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const card = page.locator("[data-diary-card]");

  // 일기가 없는 날의 카드는 바로 쓰기 화면을 연다.
  await expect(card).toContainText("오늘의 일기를 써 보세요");
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}/edit$`));
  await page.getByLabel("일기 내용").fill("모두의 창업 마감!\n결과가 기다려진다");
  await page.locator('label:has(input[name="mood"][value="sun"])').click();
  await page.getByRole("button", { name: "저장", exact: true }).click();

  // 저장하면 읽는 화면으로 간다. 글은 글로 보이고(입력칸이 아니다) 고치는 버튼이 있다. 주소의 저장 표시는 곧 지워진다.
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}$`));
  // 화면 아래 알림 자리도 role=status라 글로 골라낸다.
  await expect(page.getByRole("status").filter({ hasText: "저장했어요." })).toBeVisible();
  const article = page.getByRole("article", { name: "일기" });
  await expect(article).toContainText("모두의 창업 마감!");
  await expect(article).toContainText("결과가 기다려진다");
  await expect(article).toContainText("최고예요");
  await expect(page.getByLabel("일기 내용")).toHaveCount(0);
  await page.reload();
  await expect(article).toContainText("모두의 창업 마감!");
  await expect(page.getByText("저장했어요.")).toHaveCount(0);

  // 고치는 버튼은 쓰기 화면을 열고, 쓰기 화면의 뒤로는 읽는 화면이다.
  await page.getByRole("link", { name: "일기 고치기" }).click();
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}/edit$`));
  await expect(page.getByLabel("일기 내용")).toHaveValue("모두의 창업 마감!\n결과가 기다려진다");
  await page.getByRole("link", { name: "일기 보기로" }).click();
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}$`));

  // 홈 카드에는 기분과 글이 바로 보인다(2026-11-26 요청, 11-24에는 "눌러서 읽기"만 있었다). 누르면 읽는 화면이다.
  await page.goto("/");
  await expect(card).toContainText("모두의 창업 마감!");
  await expect(card).not.toContainText("눌러서 읽기");
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}$`));
  await expect(page.getByRole("article", { name: "일기" })).toContainText("모두의 창업 마감!");
});

test("쓴 일기가 없는 날의 읽는 화면은 안내와 쓰기 버튼을 보인다", async ({ page, email }, testInfo) => {
  await signUp(page, email, `빈날${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.goto(`/diary/${day(-2)}`);
  await expect(page.getByText("이 날은 쓴 일기가 없어요.")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("link", { name: "일기 쓰기" }).click();
  await expect(page).toHaveURL(new RegExp(`/diary/${day(-2)}/edit$`));

  // 아직 오지 않은 날의 쓰기 주소는 오늘의 쓰기 화면으로 간다.
  await page.goto(`/diary/${day(2)}/edit`);
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}/edit$`));
});
