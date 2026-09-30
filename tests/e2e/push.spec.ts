import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const EMAIL = `e2e-push-${RUN_TAG}@modori.test`;
const OTHER = `e2e-push-other-${RUN_TAG}@modori.test`;
const TOKEN = `fcm-token-${RUN_TAG}-`.padEnd(60, "x");

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL, OTHER] } } });
  await prisma.$disconnect();
});

test("로그인하지 않으면 알림 번호를 등록할 수 없다", async ({ request }) => {
  const response = await request.post("/api/push/register", { data: { token: TOKEN } });
  expect(response.status()).toBe(401);
});

test("앱이 알린 알림 번호를 내 계정에 묶고, 로그아웃 때 지운다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL, OTHER] } } });
  const other = await prisma.user.create({ data: { email: OTHER, nickname: `다른${RUN_TAG}`, privacyAgreedAt: new Date() } });
  // 같은 기기(같은 번호)가 전에 다른 계정에 묶여 있던 경우.
  await prisma.pushToken.create({ data: { userId: other.id, token: TOKEN, platform: "android" } });

  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`푸시${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  const me = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

  // 너무 짧은 번호나 본문 없는 요청은 받지 않는다.
  expect((await page.request.post("/api/push/register", { data: { token: "짧다" } })).status()).toBe(400);
  expect((await page.request.post("/api/push/register", { data: "not json", headers: { "Content-Type": "text/plain" } })).status()).toBe(400);

  expect((await page.request.post("/api/push/register", { data: { token: TOKEN, platform: "android" } })).status()).toBe(204);
  // 번호는 하나뿐이고, 이 계정으로 옮겨 왔다.
  const rows = await prisma.pushToken.findMany({ where: { token: TOKEN } });
  expect(rows).toHaveLength(1);
  expect(rows[0].userId).toBe(me.id);

  // 남의 번호는 지울 수 없다.
  await prisma.pushToken.update({ where: { token: TOKEN }, data: { userId: other.id } });
  expect((await page.request.delete("/api/push/register", { data: { token: TOKEN } })).status()).toBe(204);
  expect(await prisma.pushToken.count({ where: { token: TOKEN } })).toBe(1);

  await prisma.pushToken.update({ where: { token: TOKEN }, data: { userId: me.id } });
  expect((await page.request.delete("/api/push/register", { data: { token: TOKEN } })).status()).toBe(204);
  expect(await prisma.pushToken.count({ where: { token: TOKEN } })).toBe(0);
});

test("계정을 지우면 그 계정의 알림 번호도 사라진다", async () => {
  await prisma.user.deleteMany({ where: { email: OTHER } });
  const user = await prisma.user.create({ data: { email: OTHER, nickname: `삭제${RUN_TAG}`, privacyAgreedAt: new Date() } });
  await prisma.pushToken.create({ data: { userId: user.id, token: `${TOKEN}-del`, platform: "android" } });
  await prisma.user.delete({ where: { id: user.id } });
  expect(await prisma.pushToken.count({ where: { token: `${TOKEN}-del` } })).toBe(0);
});
