import { expect, test, type Page } from "@playwright/test";

import { PRIVACY_MANAGER } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";
import { recommendPeople } from "@/lib/recommend";

import { RUN_TAG } from "./run-tag";

const ADMIN = PRIVACY_MANAGER.email;
const emails = [0, 1].map((n) => `e2e-adminusers-${n}-${RUN_TAG}@modori.test`);

async function signUp(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL("/");
}

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [...emails, ADMIN] } } });
  await prisma.$disconnect();
});

test("마이페이지에서 추천 친구에 나오기를 끄면 저장되고, 추천에서 빠진다", async ({ page, browser }) => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  const other = await browser.newContext();
  await signUp(await other.newPage(), emails[1], `추천끔${RUN_TAG}`);
  await other.close();
  await signUp(page, emails[0], `보는이${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] } });
  const them = await prisma.user.findUniqueOrThrow({ where: { email: emails[1] } });

  // 기본은 추천에 나온다. 전체를 달라고(limit 큰 값) 해서 있는지 확인한다.
  const ids = async () => (await recommendPeople(me.id, "seed", 1000)).map((person) => person.id);
  expect(await ids()).toContain(them.id);

  // 그 사람이 마이페이지에서 끈다.
  const otherAgain = await browser.newContext();
  const theirPage = await otherAgain.newPage();
  await theirPage.goto("/login");
  await theirPage.getByLabel("테스트 이메일").fill(emails[1]);
  await theirPage.getByRole("button", { name: "테스트 로그인" }).click();
  await expect(theirPage).toHaveURL("/");
  await theirPage.goto("/settings");
  const toggle = theirPage.getByLabel("친구 추천에 나오기");
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect.poll(async () => (await prisma.user.findUniqueOrThrow({ where: { id: them.id } })).hideFromRecommend).toBe(true);
  await theirPage.reload();
  await expect(theirPage.getByLabel("친구 추천에 나오기")).not.toBeChecked();
  await otherAgain.close();

  // 추천에서는 빠지고, 닉네임으로 검색하면 그대로 나온다.
  expect(await ids()).not.toContain(them.id);
  await page.goto("/feed/search");
  await page.getByLabel("닉네임 검색").fill(`추천끔${RUN_TAG}`);
  await page.getByRole("button", { name: "검색" }).click();
  await expect(page.getByText(`추천끔${RUN_TAG}`, { exact: true })).toBeVisible();
});

test("운영자 사용자 화면: 운영자만 보고, 사용자별 개수가 나오고, CSV에는 누구인지 알 수 있는 칸이 없다", async ({ page, request }) => {
  // 로그인하지 않은 요청은 없는 주소처럼 404.
  expect((await request.get("/admin/users/export")).status()).toBe(404);

  const existing = await prisma.user.findUnique({ where: { email: ADMIN } });
  test.skip(existing !== null, "테스트 DB에 운영자 계정이 이미 있다");
  await prisma.user.deleteMany({ where: { email: emails[1] } });
  await prisma.user.create({
    data: { email: emails[1], nickname: `현황${RUN_TAG}`, signupSource: "discord", privacyAgreedAt: new Date() },
  });

  await signUp(page, ADMIN, `운영${RUN_TAG}`);
  await page.goto("/settings");
  await page.getByRole("link", { name: "사용자", exact: true }).click();
  await expect(page.getByRole("heading", { name: "사용자", exact: true })).toBeVisible();

  await page.getByLabel("사용자 검색").fill(`현황${RUN_TAG}`);
  await page.getByRole("button", { name: "검색" }).click();
  const row = page.getByRole("row").filter({ hasText: `현황${RUN_TAG}` });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(emails[1]);
  await expect(row).toContainText("discord");

  const csv = await page.request.get("/admin/users/export");
  expect(csv.status()).toBe(200);
  const body = await csv.text();
  expect(body).toContain("joined,source,providers");
  expect(body).not.toContain(`현황${RUN_TAG}`);
  expect(body).not.toContain(emails[1]);
});

test("운영자가 아니면 사용자 화면은 없는 주소다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: emails[0] } });
  await signUp(page, emails[0], `일반${RUN_TAG}`);
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "없는 주소예요" })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: "사용자", exact: true })).toHaveCount(0);
});
