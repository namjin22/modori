import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const EMAILS = [`e2e-rate-a-${RUN_TAG}@modori.test`, `e2e-rate-b-${RUN_TAG}@modori.test`];

test.beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
  await prisma.$disconnect();
});

async function signUp(page: import("@playwright/test").Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

test("한 사람이 요청을 몰아 보내면 429로 막고, 다른 사람은 막지 않는다", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pageA = await a.newPage();
  const pageB = await b.newPage();
  await signUp(pageA, EMAILS[0], `속도a${RUN_TAG}`);
  await signUp(pageB, EMAILS[1], `속도b${RUN_TAG}`);

  // 로그인한 채로 /login을 열면 홈으로 넘기기만 해서 가볍다. 한 번에 60번까지 되고 그다음은 막힌다.
  const responses = await Promise.all(
    Array.from({ length: 70 }, () => pageA.request.get("/login", { maxRedirects: 0 })),
  );
  const blocked = responses.filter((response) => response.status() === 429);
  expect(blocked.length).toBeGreaterThan(0);
  // 언제 다시 하면 되는지 알려준다.
  expect(blocked[0].headers()["retry-after"]).toBeTruthy();

  // 다른 사람(다른 세션)은 영향을 받지 않는다.
  expect((await pageB.request.get("/login", { maxRedirects: 0 })).status()).not.toBe(429);

  await a.close();
  await b.close();
});
