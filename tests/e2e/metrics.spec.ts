import { expect, test, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { PRIVACY_MANAGER } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const EMAIL = `e2e-metrics-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
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

test("가입을 마치고 화면을 열면 오늘 쓴 날로 한 번 적히고, 계정을 지우면 같이 지워진다", async ({ page }) => {
  await signUp(page, EMAIL, `지표${RUN_TAG}`);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "마이페이지" })).toBeVisible();
  expect(await prisma.activeDay.findMany({ where: { userId: user.id } })).toEqual([
    { userId: user.id, date: todayKST() },
  ]);

  // 운영자가 아니면 지표 화면은 없는 주소이고 링크도 없다.
  await expect(page.getByRole("link", { name: "지표", exact: true })).toHaveCount(0);
  await page.goto("/admin/metrics");
  await expect(page.getByRole("heading", { name: "없는 주소예요" })).toBeVisible();

  await prisma.user.delete({ where: { id: user.id } });
  expect(await prisma.activeDay.count({ where: { userId: user.id } })).toBe(0);
});

test("운영자는 지표 화면에서 가입 단계를 본다", async ({ page }) => {
  // 테스트 DB를 로컬과 CI가 같이 쓴다. 누가 운영자 계정을 쓰고 있으면 건드리지 않는다.
  const existing = await prisma.user.findUnique({ where: { email: PRIVACY_MANAGER.email } });
  test.skip(existing !== null, "테스트 DB에 운영자 계정이 이미 있다");
  try {
    await signUp(page, PRIVACY_MANAGER.email, `운영${RUN_TAG}`);
    await page.goto("/settings");
    await page.getByRole("link", { name: "지표", exact: true }).click();
    await expect(page.getByRole("heading", { name: "지표", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "가입 단계" })).toBeVisible();
    await expect(page.getByText("가입 완료(닉네임)")).toBeVisible();
  } finally {
    await prisma.user.deleteMany({ where: { email: PRIVACY_MANAGER.email } });
  }
});

test("초대 링크의 ?from= 값은 가입할 때 한 번 저장되고, 모양이 틀린 값은 버린다", async ({ page, browser }) => {
  const taggedEmail = `e2e-source-a-${RUN_TAG}@modori.test`;
  const plainEmail = `e2e-source-b-${RUN_TAG}@modori.test`;
  try {
    // 공지 링크(/?from=)를 로그인 전에 열면 서버가 /login?next=...로 보낸다. 그래도 경로가 남아야 한다(localStorage).
    await page.goto("/?from=Discord");
    await expect(page).toHaveURL(/\/login\?next=/);
    await signUp(page, taggedEmail, `경로${RUN_TAG}`);
    const tagged = await prisma.user.findUniqueOrThrow({ where: { email: taggedEmail } });
    expect(tagged.signupSource).toBe("discord");

    // 글자·기호가 섞인 값은 저장하지 않고 가입은 그대로 된다.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto("/login?from=%3Cscript%3E");
    await signUp(otherPage, plainEmail, `직접${RUN_TAG}`);
    const plain = await prisma.user.findUniqueOrThrow({ where: { email: plainEmail } });
    expect(plain.signupSource).toBeNull();
    await other.close();
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [taggedEmail, plainEmail] } } });
  }
});

test("하루 합계는 캐릭터 반응 수와 가입 경로별 누적을 함께 남긴다", async () => {
  const email = `e2e-snapshot-${RUN_TAG}@modori.test`;
  // 오래전 날짜로 찍어 실제 합계 행과 겹치지 않게 하고, 끝나면 지운다.
  const day = new Date(Date.UTC(2001, 0, 2));
  try {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.user.create({ data: { email, nickname: `합계${RUN_TAG}`, signupSource: "discord", createdAt: new Date(Date.UTC(2000, 5, 1)) } });
    const { snapshotDay } = await import("@/lib/metrics");
    await snapshotDay(day);
    const row = await prisma.dailyStat.findUniqueOrThrow({ where: { date: day } });
    expect(typeof row.reactionsCharacter).toBe("number");
    const sources = row.sources as Record<string, number>;
    expect(sources.discord).toBeGreaterThanOrEqual(1);
  } finally {
    await prisma.dailyStat.deleteMany({ where: { date: day } });
    await prisma.user.deleteMany({ where: { email } });
  }
});

test("지표 CSV는 운영자만 받는다", async ({ page, request }) => {
  // 로그인하지 않은 요청은 없는 주소처럼 404.
  expect((await request.get("/admin/metrics/export")).status()).toBe(404);

  const existing = await prisma.user.findUnique({ where: { email: PRIVACY_MANAGER.email } });
  test.skip(existing !== null, "테스트 DB에 운영자 계정이 이미 있다");
  try {
    await signUp(page, PRIVACY_MANAGER.email, `운영${RUN_TAG}`);
    const response = await page.request.get("/admin/metrics/export");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(await response.text()).toContain("date,accounts,users,");
    await page.goto("/admin/metrics");
    await expect(page.getByRole("heading", { name: "가입 경로" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "반응과 프로필" })).toBeVisible();
    await expect(page.getByRole("link", { name: "CSV 받기" })).toBeVisible();
  } finally {
    await prisma.user.deleteMany({ where: { email: PRIVACY_MANAGER.email } });
  }
});

test("새 열이 생기기 전에 찍힌 하루 합계는 캐릭터 반응 수와 가입 경로별 누적으로 채워지고 한 번만 채운다", async () => {
  const day = new Date(Date.UTC(2001, 0, 3));
  try {
    await prisma.dailyStat.deleteMany({ where: { date: day } });
    // 옛 모양의 행: 새 열(reactionsCharacter 0, sources 비어 있음)을 모르고 찍힌 것.
    await prisma.dailyStat.create({
      data: {
        date: day,
        accounts: 0,
        users: 0,
        withTodo: 0,
        withFollow: 0,
        withReaction: 0,
        dau: 0,
        wau: 0,
        todosCreated: 0,
        follows: 0,
        reactionsCreated: 0,
        cohortSize: 0,
        cohortReturned: 0,
      },
    });
    const { backfillStatColumns } = await import("@/lib/metrics");
    expect(await backfillStatColumns()).toBe(true);
    const row = await prisma.dailyStat.findUniqueOrThrow({ where: { date: day } });
    expect(row.sources).not.toBeNull();
    expect(row.reactionsCharacter).toBe(0);

    // 채운 행은 다시 건드리지 않는다.
    await prisma.dailyStat.update({ where: { date: day }, data: { reactionsCharacter: 7 } });
    expect(await backfillStatColumns()).toBe(true);
    expect((await prisma.dailyStat.findUniqueOrThrow({ where: { date: day } })).reactionsCharacter).toBe(7);
  } finally {
    await prisma.dailyStat.deleteMany({ where: { date: day } });
  }
});
