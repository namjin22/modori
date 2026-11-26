import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, parseKSTDate, todayIn } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { homeReady } from "./todo-helpers";

// 일기 공개 기본값과 친구 화면의 일기 카드(2026-11-26 운영자 요청): 새 일기는 기본 공개이고 "비공개"를 켜면 나만 본다.
// 홈 카드는 글을 여섯 줄까지 보이고, 친구 화면에도 같은 카드가 달력 밑에 뜬다(비공개한 날·쓰지 않은 날은 그렇게 적힌다).
const TODAY = formatKST(todayIn("Asia/Seoul"));
const day = (offset: number) => formatKST(addDays(parseKSTDate(TODAY), offset));

type Emails = { me: string; friend: string };

const test = base.extend<{ emails: Emails }>({
  emails: async ({}, provide, testInfo) => {
    const tag = `${testInfo.testId.slice(-6)}${RUN_TAG}`;
    const emails = { me: `e2e-diarypub-me-${tag}@modori.test`, friend: `e2e-diarypub-friend-${tag}@modori.test` };
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await provide(emails);
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
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

const userByEmail = (email: string) => prisma.user.findUniqueOrThrow({ where: { email } });
const entryOf = (userId: string, date: string) => prisma.diaryEntry.findUnique({ where: { userId_date: { userId, date: parseKSTDate(date) } } });

test("새 일기는 기본으로 공개이고, 비공개를 켜면 나만 보며, 예전에 비공개로 쓴 일기는 스위치가 켜진 채 열린다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `기본${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await userByEmail(emails.me);
  // 2026-11-26 전에 기본(비공개)으로 쓴 일기. 기본값이 바뀌어도 이 일기는 그대로 비공개다.
  await prisma.diaryEntry.create({ data: { userId: me.id, date: parseKSTDate(day(-1)), content: "예전에 비공개로 쓴 일기", isPublic: false } });

  await page.goto(`/diary/${TODAY}/edit`);
  const toggle = page.getByRole("checkbox", { name: /비공개/ });
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText("친구에게 공개")).toHaveCount(0);
  await page.getByLabel("일기 내용").fill("스위치를 건드리지 않고 쓴 일기");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}([?]saved=1)?$`));
  await expect.poll(async () => (await entryOf(me.id, TODAY))?.isPublic).toBe(true);

  // 비공개를 켜고 쓰면 나만 본다.
  await page.goto(`/diary/${day(-2)}/edit`);
  await page.getByLabel("일기 내용").fill("비공개로 쓴 일기");
  await page.getByRole("checkbox", { name: /비공개/ }).check();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(async () => (await entryOf(me.id, day(-2)))?.isPublic).toBe(false);

  // 예전에 비공개로 쓴 일기를 열면 스위치가 켜져 있다(고치면서 공개로 바뀌지 않는다).
  await page.goto(`/diary/${day(-1)}/edit`);
  await expect(page.getByRole("checkbox", { name: /비공개/ })).toBeChecked();
});

test("홈 카드는 글을 여섯 줄까지 보이고 넘치면 줄인다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `줄임${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await userByEmail(emails.me);
  const lines = Array.from({ length: 30 }, (_, index) => `${index + 1}번째 줄`).join("\n");
  await prisma.diaryEntry.create({ data: { userId: me.id, date: parseKSTDate(TODAY), content: lines, mood: "sun" } });

  await page.goto("/");
  const card = page.locator("[data-diary-card]");
  await expect(card).toContainText("1번째 줄");
  const text = card.locator("span.line-clamp-6");
  await expect(text).toHaveCSS("-webkit-line-clamp", "6");
  // 글 전체가 아니라 잘려서 보인다: 줄 수를 제한한 칸의 높이가 글 전체 높이보다 작다.
  // 글꼴이 불러와져 줄 높이가 자리 잡을 때까지 기다린다.
  await expect.poll(() => text.evaluate((node) => node.clientHeight < node.scrollHeight)).toBe(true);
});

test("친구 화면에도 일기 카드가 뜬다: 공개한 날은 글이, 비공개한 날은 안내가, 쓰지 않은 날은 그 말이 보인다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `보는이${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await userByEmail(emails.me);
  const friend = await prisma.user.create({ data: { email: emails.friend, nickname: `쓰는이${testInfo.testId.slice(-6)}${RUN_TAG}`, privacyAgreedAt: new Date() } });
  await prisma.follow.create({ data: { followerId: me.id, followingId: friend.id } });
  await prisma.diaryEntry.createMany({
    data: [
      { userId: friend.id, date: parseKSTDate(TODAY), content: "친구가 공개한 오늘 일기\n둘째 줄", mood: "sun", isPublic: true },
      { userId: friend.id, date: parseKSTDate(day(-1)), content: "친구만 아는 비밀 이야기", mood: "storm", isPublic: false },
    ],
  });
  const card = page.locator("[data-diary-card]");

  // 공개한 날: 내 화면과 같은 카드. 누르면 친구의 일기 목록으로 가고 그 날의 일기가 있다.
  await page.goto(`/feed/u/${friend.id}`);
  await expect(card).toContainText("친구가 공개한 오늘 일기");
  await expect(card).toContainText("둘째 줄");
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/feed/u/${friend.id}/diary[?]month=${TODAY.slice(0, 7)}#d-${TODAY}$`));
  await expect(page.locator(`#d-${TODAY}`)).toContainText("친구가 공개한 오늘 일기");

  // 비공개한 날: 안내만 보이고, 글과 기분은 화면에도 페이지 데이터에도 없다.
  await page.goto(`/feed/u/${friend.id}?date=${day(-1)}`);
  await expect(card).toHaveText("친구가 비공개한 일기예요");
  const html = await page.content();
  expect(html).not.toContain("친구만 아는 비밀 이야기");
  expect(html).not.toContain("화났어요");

  // 쓰지 않은 날.
  await page.goto(`/feed/u/${friend.id}?date=${day(-2)}`);
  await expect(card).toHaveText("일기를 쓰지 않았어요");

  // 아직 오지 않은 날에는 카드가 없다.
  await page.goto(`/feed/u/${friend.id}?date=${day(1)}`);
  await expect(card).toHaveCount(0);
});
