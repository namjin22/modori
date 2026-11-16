import { expect, test as base } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 설정 페이지(2026-10-31 운영자 요청): 마이페이지에 한꺼번에 있던 화면·알림·친구·시간대 설정을 한 페이지로 모았다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-prefs-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("마이페이지에는 프로필·화면·언어와 설정으로 가는 줄만 있고, 설정에 알림·친구·시간대가 모여 있다", async ({ page, email }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`옵션${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "마이페이지" })).toBeVisible();
  await expect(page.getByRole("link", { name: /프로필 수정/ })).toBeVisible();
  // 화면 테마(라이트·다크)와 언어는 설정 안이 아니라 마이페이지에 있다(2026-11-16 요청). 그 밖의 설정 항목은 마이페이지에 없다.
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["화면"]);

  await page.getByRole("link", { name: /^설정/ }).click();
  await expect(page).toHaveURL(/\/settings\/preferences$/);
  await expect(page.getByRole("heading", { level: 1, name: "설정" })).toBeVisible();
  for (const name of ["알림", "친구", "시간대"]) {
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  // 화면(테마·언어)은 마이페이지로 옮겼다.
  await expect(page.getByRole("heading", { level: 2, name: "화면", exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /친구가 할 일을 끝내면 알림/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /친구 추천에 나오기/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /차단한 사용자/ })).toBeVisible();

  // 아래 탭은 마이페이지가 고른 상태로 남고, 되돌아가는 길이 있다.
  await expect(page.getByRole("link", { name: "마이페이지", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "마이페이지로" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

// 설정에서만 들어가는 화면(내가 정한 알림·차단한 사용자·AI 연결)의 뒤로가기는 마이페이지가 아니라 설정으로 돌아온다(2026-11-16 신고:
// 알림 화면에서 나가기를 누르면 설정이 아니라 마이페이지로 나갔다). 마이페이지에서 바로 들어가는 화면은 마이페이지로 돌아온다.
test("설정 안의 화면에서 뒤로가면 설정으로, 마이페이지에서 들어간 화면에서는 마이페이지로 돌아온다", async ({ page, email }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`뒤로${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  for (const [link, heading] of [
    [/내가 정한 알림/, "내가 정한 알림"],
    [/차단한 사용자/, "차단한 사용자"],
    [/AI 연결/, "AI 연결"],
  ] as const) {
    await page.goto("/settings/preferences");
    await page.getByRole("link", { name: link }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await page.getByRole("link", { name: "설정으로" }).click();
    await expect(page, `${heading}에서 나가기`).toHaveURL(/\/settings\/preferences$/);
    await expect(page.getByRole("heading", { level: 1, name: "설정" })).toBeVisible();
  }

  // 마이페이지에서 바로 가는 화면은 마이페이지로.
  await page.goto("/settings");
  await page.getByRole("link", { name: /프로필 수정/ }).click();
  await page.getByRole("link", { name: "마이페이지로" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("link", { name: "계정 지우기" }).click();
  await page.getByRole("link", { name: "마이페이지로" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

// 설정으로 가는 길은 마이페이지 제목 줄 오른쪽의 톱니 버튼 하나다(2026-11-16 요청: 넓은 "설정 ›" 줄이 어색하다).
test("마이페이지의 설정은 제목 줄 오른쪽 톱니 버튼이고, 눌러도 색이 바뀌지 않는다", async ({ page, email }, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`톱니${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  await page.goto("/settings");
  const gear = page.getByRole("link", { name: "설정", exact: true });
  await expect(gear).toBeVisible();
  // 예전의 넓은 줄("설정 ›")은 없다.
  await expect(page.getByText("설정 ›")).toHaveCount(0);

  const title = await page.getByRole("heading", { level: 1, name: "마이페이지" }).boundingBox();
  const box = await gear.boundingBox();
  if (!title || !box) throw new Error("제목이나 설정 버튼의 자리를 잴 수 없다.");
  // 제목과 같은 줄에서 제목 오른쪽 끝에 있고, 손가락이 누르기 충분히 크다.
  expect(Math.abs(box.y + box.height / 2 - (title.y + title.height / 2))).toBeLessThan(12);
  expect(box.x).toBeGreaterThan(title.x + title.width);
  expect(box.width).toBeGreaterThanOrEqual(40);
  expect(box.height).toBeGreaterThanOrEqual(40);

  // 마우스를 올려도 바탕색이 달라지지 않는다(2026-11-02 요청: 눌렀을 때 색이 달라져 이상하다).
  const background = () => gear.evaluate((element) => getComputedStyle(element).backgroundColor);
  const before = await background();
  await gear.hover();
  expect(await background()).toBe(before);

  await gear.click();
  await expect(page).toHaveURL(/\/settings\/preferences$/);
  await expect(page.getByRole("heading", { level: 1, name: "설정" })).toBeVisible();
});

