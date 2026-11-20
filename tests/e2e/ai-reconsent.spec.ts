import { expect, test, type Page } from "@playwright/test";

import { AI_CONSENT_VALID_FROM, AI_RECONSENT_NOTICE_UNTIL } from "@/lib/ai/consent";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";

// AI 도우미 재동의(2026-11-19, docs/decisions.md): 받는 곳이 Google에서 Cloudflare로 바뀌기 전 문구에 동의한 사람만 다시 동의를 받는다.
// 이 파일의 시험은 AI 서비스를 부르지 않는다(동의가 없으면 서버가 AI 앞에서 막는다).
const emails: string[] = [];

test.afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  emails.length = 0;
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

/** 가입을 마친 계정을 만들고 로그인한다. consentAt이 null이면 동의한 적이 없는 사람이다. */
async function makeUser(page: Page, label: string, consentAt: Date | null) {
  const email = `e2e-reconsent-${label}-${RUN_TAG}@modori.test`;
  emails.push(email);
  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({
    data: { email, nickname: `rc${label}${RUN_TAG}`, privacyAgreedAt: new Date(), tutorialSeenAt: new Date(), aiChatConsentAt: consentAt },
  });
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await expect(page).toHaveURL(/\/$/);
  return user;
}

const input = (page: Page) => page.getByLabel("AI에게 보낼 말");
const banner = (page: Page) => page.getByRole("note").filter({ hasText: "내용을 보내는 곳이 바뀌었어요" });

test("옛 문구에 동의한 사람은 (7일 동안은 변경 안내와 함께) 다시 동의해야 열리고, 서버도 그 전에는 막는다", async ({ page }) => {
  const before = new Date(AI_CONSENT_VALID_FROM.getTime() - 24 * 60 * 60 * 1000);
  const user = await makeUser(page, "stale", before);

  await page.goto("/ai");
  // 변경 안내는 기준 시각부터 7일(2026-11-26 10:20 KST)까지만 보이고 그 뒤에는 사라진다(2026-11-20). 어느 쪽이든 동의는 계속 필요하다.
  // 안내가 보이는 날·안 보이는 날 양쪽 판단은 tests/unit/ai-reconsent-notice.test.ts가 날짜를 고정해 확인한다.
  if (Date.now() < AI_RECONSENT_NOTICE_UNTIL.getTime()) {
    await expect(banner(page)).toBeVisible();
    await expect(page.getByText("Google의 Gemini API로 전송된다고 적혀 있었어요")).toBeVisible();
  } else {
    await expect(banner(page)).toHaveCount(0);
  }
  await expect(page.getByText("Cloudflare의 Workers AI로 전송돼요")).toBeVisible();
  await expect(input(page)).toHaveCount(0);
  const start = page.getByRole("button", { name: "동의하고 시작하기" });
  await expect(start).toBeDisabled();

  // 동의를 다시 하기 전에는 서버를 직접 불러도 막힌다(AI에게 아무것도 가지 않는다).
  const blocked = await page.request.post("/api/ai/chat", { data: { messages: [{ role: "user", text: "안녕" }] } });
  expect(blocked.status()).toBe(403);
  expect(await blocked.json()).toMatchObject({ ok: false, error: "consent" });
  expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).aiChatConsentAt?.getTime()).toBe(before.getTime());

  await page.getByRole("checkbox", { name: "위 내용을 읽었고 동의해요" }).check();
  await start.click();
  await expect(input(page)).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  // 동의 시각이 새로 적혔다.
  const after = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).aiChatConsentAt;
  expect(after?.getTime()).toBeGreaterThanOrEqual(AI_CONSENT_VALID_FROM.getTime());
});

test("처음인 사람에게는 변경 안내가 없고, 지금 문구에 이미 동의한 사람은 그대로 열린다. 시각도 덮어쓰지 않는다", async ({ page }) => {
  await makeUser(page, "first", null);
  await page.goto("/ai");
  await expect(page.getByRole("heading", { name: "시작하기 전에 알려 드려요" })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  await expect(input(page)).toHaveCount(0);

  // 로그아웃하고(쿠키를 지우고) 지금 문구에 동의한 다른 사람으로 들어간다.
  await page.context().clearCookies();
  const recent = new Date(AI_CONSENT_VALID_FROM.getTime() + 60 * 1000);
  const valid = await makeUser(page, "valid", recent);
  await page.goto("/ai");
  await expect(input(page)).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: valid.id } })).aiChatConsentAt?.getTime()).toBe(recent.getTime());
});
