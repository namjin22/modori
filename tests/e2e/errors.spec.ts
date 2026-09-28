import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const EMAIL = `e2e-errors-${RUN_TAG}@modori.test`;
const MARK = `e2e-client-error-${RUN_TAG}-${Date.now().toString(36)}`;

test.afterAll(async () => {
  await prisma.errorEvent.deleteMany({ where: { message: { contains: MARK } } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test("브라우저 오류 보고를 기록하고, 쿼리는 버린다", async ({ request }) => {
  const response = await request.post("/api/errors", {
    data: JSON.stringify({ message: `TypeError: ${MARK}`, path: "/feed?secret=1" }),
  });
  expect(response.status()).toBe(204);

  const saved = await prisma.errorEvent.findFirstOrThrow({ where: { message: { contains: MARK } } });
  expect(saved.source).toBe("client");
  expect(saved.path).toBe("/feed");
});

test("이상한 보고는 받지 않는다", async ({ request }) => {
  expect((await request.post("/api/errors", { data: "not json" })).status()).toBe(400);
  expect((await request.post("/api/errors", { data: JSON.stringify({ message: "x".repeat(3000) }) })).status()).toBe(413);
});

test("오류 보고는 한 사람이 10개를 넘기면 1분에 하나씩만 받는다", async ({ request }) => {
  // 로그인 전 요청은 접속 IP로 센다. 다른 테스트와 버킷이 겹치지 않게 이 테스트만의 IP를 쓴다.
  const headers = { "cf-connecting-ip": `198.51.100.${Math.floor(Math.random() * 250) + 1}` };
  const statuses: number[] = [];
  for (let i = 0; i < 11; i += 1) {
    const response = await request.post("/api/errors", {
      headers,
      data: JSON.stringify({ message: `Error: ${MARK} 반복 ${i}` }),
    });
    statuses.push(response.status());
  }
  expect(statuses.slice(0, 10).every((status) => status === 204)).toBe(true);
  expect(statuses[10]).toBe(429);
});

test("오류 수는 비밀 값 없이 볼 수 없고, 오류 기록 화면은 운영자가 아니면 없는 주소다", async ({ page, request }) => {
  expect((await request.get("/api/errors/summary")).status()).toBe(404);

  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`오류${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  await page.goto("/admin/errors");
  await expect(page.getByRole("heading", { name: "없는 주소예요" })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: "오류 기록" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /의견 보내기/ })).toHaveAttribute("href", /^mailto:penamjin@gmail\.com\?subject=/);
});
