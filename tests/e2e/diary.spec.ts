import { expect, test as base, type Page } from "@playwright/test";

import { addDays, formatKST, parseKSTDate, todayIn } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";
import { homeReady } from "./todo-helpers";

// 일기(2026-11-17 운영자 결정, docs/decisions.md "일기"): 하루 한 편의 글과 이모지, 기본은 나만 보고 일기마다 친구 공개.
const TODAY = formatKST(todayIn("Asia/Seoul"));
const day = (offset: number) => formatKST(addDays(parseKSTDate(TODAY), offset));

type Emails = { me: string; other: string };

const test = base.extend<{ emails: Emails }>({
  emails: async ({}, provide, testInfo) => {
    const tag = `${testInfo.testId.slice(-6)}${RUN_TAG}`;
    const emails = { me: `e2e-diary-me-${tag}@modori.test`, other: `e2e-diary-other-${tag}@modori.test` };
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
const mood = (page: Page, emoji: string) => page.locator(`label:has(input[name="mood"][value="${emoji}"])`);

test("일기를 쓰고 고치고 지운다: 글·이모지·기분·친구 공개, 하루 한 편", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `일기${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await userByEmail(emails.me);

  // 홈의 "일기" 버튼은 일기 목록으로 간다(보고 있는 날의 일기는 홈의 카드에서 바로 본다).
  await page.getByRole("link", { name: "일기", exact: true }).click();
  await expect(page).toHaveURL(/\/diary$/);
  await page.getByRole("link", { name: "오늘 일기 쓰기" }).click();
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}$`));
  await expect(page.getByRole("button", { name: "일기 지우기" })).toHaveCount(0);

  // 비었으면 저장할 수 없다.
  const save = page.getByRole("button", { name: "저장", exact: true });
  await expect(save).toBeDisabled();

  const content = page.getByLabel("일기 내용");
  // 기분은 내 캐릭터(도리)의 표정 열 개 중에서 고른다. 이모지를 끼우는 단추는 없앴다(2026-11-17 요청). 글자판의 이모지는 그대로 적을 수 있다.
  await expect(page.getByText("이모지 넣기")).toHaveCount(0);
  await expect(page.locator('input[name="mood"]')).toHaveCount(11);
  await content.fill("오늘은 시험이 끝났다.🎉");
  await mood(page, "dori:happy").click();
  await expect(save).toBeEnabled();

  await save.click();
  await expect(page.getByText("저장했어요.")).toBeVisible();
  // 기본은 나만 본다.
  expect(await entryOf(me.id, TODAY)).toMatchObject({ content: "오늘은 시험이 끝났다.🎉", mood: "dori:happy", isPublic: false });

  // 새로 열어도 그대로이고, 고쳐도 한 편이다.
  await page.reload();
  await expect(content).toHaveValue("오늘은 시험이 끝났다.🎉");
  await expect(page.locator('input[name="mood"][value="dori:happy"]')).toBeChecked();
  await content.fill("오늘은 시험이 끝났다.\n둘째 줄도 적었다.");
  await mood(page, "dori:party").click();
  await page.getByRole("checkbox", { name: /친구에게 공개/ }).check();
  await save.click();
  await expect(page.getByText("저장했어요.")).toBeVisible();
  expect(await prisma.diaryEntry.count({ where: { userId: me.id } })).toBe(1);
  expect(await entryOf(me.id, TODAY)).toMatchObject({ content: "오늘은 시험이 끝났다.\n둘째 줄도 적었다.", mood: "dori:party", isPublic: true });

  // 기분을 "고르지 않음"으로 되돌릴 수 있다.
  await page.getByText("고르지 않음", { exact: true }).click();
  // 값을 바꾸면 지난 저장의 "저장했어요."는 사라진다. 새로 저장된 뒤에 다시 뜬다.
  await expect(page.getByText("저장했어요.")).toHaveCount(0);
  await save.click();
  await expect(page.getByText("저장했어요.")).toBeVisible();
  await expect.poll(async () => (await entryOf(me.id, TODAY))?.mood).toBeNull();

  // 지우기는 한 번 더 묻는다.
  await page.getByRole("button", { name: "일기 지우기" }).click();
  await page.getByRole("alert").getByRole("button", { name: "취소" }).click();
  expect(await entryOf(me.id, TODAY)).not.toBeNull();
  await page.getByRole("button", { name: "일기 지우기" }).click();
  await page.getByRole("alert").getByRole("button", { name: "지우기" }).click();
  await expect(page).toHaveURL(/\/diary$/);
  expect(await entryOf(me.id, TODAY)).toBeNull();
});

test("목록은 달마다 최근 날부터 보이고, 공개 표시가 붙고, 오늘 일기로 바로 간다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `목록${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await userByEmail(emails.me);
  await prisma.diaryEntry.createMany({
    data: [
      { userId: me.id, date: parseKSTDate(day(0)), content: "오늘 쓴 일기", mood: "dori:like", isPublic: true },
      { userId: me.id, date: parseKSTDate(day(-1)), content: "어제 쓴 일기\n둘째 줄", mood: null, isPublic: false },
      { userId: me.id, date: parseKSTDate(day(-40)), content: "한 달도 더 전에 쓴 일기", mood: "dori:sad", isPublic: false },
    ],
  });

  await page.goto("/diary");
  await expect(page.getByRole("heading", { level: 1, name: "일기" })).toBeVisible();
  await expect(page.getByRole("link", { name: "오늘 일기 이어 쓰기" })).toBeVisible();

  const items = page.getByRole("listitem");
  // 오늘 일기가 어제보다 위에 있고(달이 바뀌는 날은 이번 달에 하나뿐일 수 있다), 공개 표시는 공개한 것에만 붙는다.
  const todayItem = items.filter({ hasText: "오늘 쓴 일기" });
  await expect(todayItem).toContainText("친구 공개");
  const yesterday = items.filter({ hasText: "어제 쓴 일기 둘째 줄" });
  if (formatKST(parseKSTDate(day(-1))).slice(0, 7) === TODAY.slice(0, 7)) {
    await expect(yesterday).toBeVisible();
    await expect(yesterday).not.toContainText("친구 공개");
  }

  // 일기 한 편을 눌러 그 날의 쓰기 화면으로 간다.
  await todayItem.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}$`));
  await expect(page.getByLabel("일기 내용")).toHaveValue("오늘 쓴 일기");

  // 이전 달로 가면 그 달의 일기만 보이고, 이번 달보다 뒤로는 가지 않는다.
  await page.goto("/diary");
  await expect(page.getByRole("link", { name: "다음 달" })).toHaveCount(0);
  await page.getByRole("link", { name: "이전 달" }).click();
  await expect(page).toHaveURL(/\/diary\?month=\d{4}-\d{2}$/);
  await expect(page.getByText("오늘 쓴 일기")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "다음 달" })).toBeVisible();
});

test("홈의 하루 화면에서 그날의 일기를 바로 보고, 없으면 쓰러 가는 줄이 보인다(내일 이후에는 없다)", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `피드${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await userByEmail(emails.me);
  const card = page.locator("[data-diary-card]");

  // 쓴 일기가 없으면 오늘의 일기를 쓰러 가는 줄이 있고, 누르면 그 날의 쓰기 화면이 열린다.
  await page.goto("/");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("오늘의 일기를 써 보세요");
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}$`));

  // 저장하면 홈에서 바로 보인다: 기분 그림과 글의 앞부분, 친구 공개 표시.
  await page.getByLabel("일기 내용").fill("홈에서 바로 보이는 일기\n둘째 줄은 이어서 붙는다");
  await mood(page, "dori:cool").click();
  await page.getByRole("checkbox", { name: /친구에게 공개/ }).check();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("저장했어요.")).toBeVisible();
  await page.goto("/");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("홈에서 바로 보이는 일기 둘째 줄은 이어서 붙는다");
  await expect(card).toContainText("친구 공개");
  await expect(card).not.toContainText("써 보세요");
  await expect(card.locator("svg").first()).toBeVisible();

  // 다른 날을 보면 그 날의 일기(또는 쓰러 가는 줄)가 보이고, 아직 오지 않은 날에는 카드가 없다.
  await prisma.diaryEntry.create({ data: { userId: me.id, date: parseKSTDate(day(-1)), content: "어제 쓴 일기 맛보기" } });
  await page.goto(`/?date=${day(-1)}`);
  await expect(card).toContainText("어제 쓴 일기 맛보기");
  await expect(card).not.toContainText("친구 공개");
  await page.goto(`/?date=${day(-2)}`);
  await expect(card).toContainText("이 날의 일기를 써 보세요");
  await page.goto(`/?date=${day(1)}`);
  await expect(card).toHaveCount(0);

  // 카드를 누르면 그 날의 일기 화면이 열린다.
  await page.goto(`/?date=${day(-1)}`);
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/diary/${day(-1)}$`));
  await expect(page.getByLabel("일기 내용")).toHaveValue("어제 쓴 일기 맛보기");
});

test("날짜 규칙: 아직 오지 않은 날은 오늘로, 없는 날짜는 없는 주소로, 글이 너무 길면 저장하지 않는다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `규칙${testInfo.testId.slice(-6)}${RUN_TAG}`);

  await page.goto(`/diary/${day(3)}`);
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}$`));
  // 이 앱은 loading.tsx 때문에 스트리밍으로 응답해서 없는 주소도 HTTP 200이다. 안내 화면의 내용으로 확인한다.
  await page.goto("/diary/2026-02-30");
  await expect(page.getByText("없는 주소예요")).toBeVisible();
  await page.goto("/diary/abc");
  await expect(page.getByText("없는 주소예요")).toBeVisible();

  // 지난 날의 일기는 쓸 수 있고, 앞뒤 날로 넘어갈 수 있다. 오늘에서는 다음 날 단추가 없다.
  await page.goto(`/diary/${day(-1)}`);
  await expect(page.getByRole("link", { name: "다음날 일기" })).toBeVisible();
  await page.getByRole("link", { name: "다음날 일기" }).click();
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}$`));
  // 오늘에서도 다음날 단추는 있다(2026-11-17 요청). 누르면 아무 데도 가지 않고 단추만 움찔한다. 연달아 눌러도 그때마다 움직인다.
  await expect(page.getByRole("link", { name: "다음날 일기" })).toHaveCount(0);
  const next = page.getByRole("button", { name: "다음날 일기" });
  await expect(next).toBeVisible();
  await expect(page.locator(".animate-nudge")).toHaveCount(0);
  await page.getByLabel("일기 내용").fill("움찔해도 글은 그대로");
  await next.click();
  await expect(page.locator(".animate-nudge")).toHaveCount(1);
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}$`));
  await expect(page.getByLabel("일기 내용")).toHaveValue("움찔해도 글은 그대로");
  await next.click();
  await expect(page.locator(".animate-nudge")).toHaveCount(1);
  await expect(page).toHaveURL(new RegExp(`/diary/${TODAY}$`));
  await page.getByLabel("일기 내용").fill("");

  // 5000자가 넘으면 센 글자 수가 빨개지고 저장할 수 없다(이모지도 한 글자).
  const content = page.getByLabel("일기 내용");
  await content.fill("가".repeat(5001));
  await expect(page.getByText("5001 / 5000")).toBeVisible();
  await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  await content.fill("😊".repeat(5000));
  await expect(page.getByText("5000 / 5000")).toBeVisible();
  await expect(page.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
});

test("친구의 공개 일기: 팔로우한 사람만, 공개한 일기만 보이고, 차단하면 없는 주소다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `보는이${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await userByEmail(emails.me);
  const friendName = `쓰는이${testInfo.testId.slice(-6)}${RUN_TAG}`;
  const friend = await prisma.user.create({ data: { email: emails.other, nickname: friendName, privacyAgreedAt: new Date() } });
  await prisma.diaryEntry.createMany({
    data: [
      { userId: friend.id, date: parseKSTDate(TODAY), content: "친구가 공개한 일기", mood: "dori:love", isPublic: true },
      { userId: friend.id, date: parseKSTDate(day(-1)), content: "친구만 보는 비밀 일기", mood: null, isPublic: false },
    ],
  });

  // 팔로우하지 않았으면 일기 화면에 들어가도 친구 화면(팔로우 안내)으로 돌아온다. 일기 내용은 어디에도 없다.
  await page.goto(`/feed/u/${friend.id}/diary`);
  await expect(page).toHaveURL(new RegExp(`/feed/u/${friend.id}$`));
  await expect(page.getByText("친구가 공개한 일기")).toHaveCount(0);

  // 팔로우하면 프로필에 "일기 1"(공개한 일기 수)이 생기고, 공개한 일기만 보인다.
  await prisma.follow.create({ data: { followerId: me.id, followingId: friend.id } });
  await page.goto(`/feed/u/${friend.id}`);
  await expect(page.getByRole("link", { name: "일기 1" })).toBeVisible();
  await page.getByRole("link", { name: "일기 1" }).click();
  await expect(page).toHaveURL(new RegExp(`/feed/u/${friend.id}/diary$`));
  await expect(page.getByRole("heading", { level: 1, name: `${friendName}의 일기` })).toBeVisible();
  await expect(page.getByText("친구가 공개한 일기")).toBeVisible();
  await expect(page.getByText("친구만 보는 비밀 일기")).toHaveCount(0);
  // 다른 달에 쓴 비공개 일기도 이전 달 화면에서 보이지 않는다.
  await page.getByRole("link", { name: "이전 달" }).click();
  await expect(page.getByText("친구만 보는 비밀 일기")).toHaveCount(0);

  // 공개한 일기가 없는 친구는 프로필에 일기 링크가 없다.
  await prisma.diaryEntry.updateMany({ where: { userId: friend.id }, data: { isPublic: false } });
  await page.goto(`/feed/u/${friend.id}`);
  await expect(page.getByRole("link", { name: /^일기 \d+$/ })).toHaveCount(0);

  // 친구가 나를 차단하면 없는 주소다.
  await prisma.diaryEntry.updateMany({ where: { userId: friend.id }, data: { isPublic: true } });
  await prisma.block.create({ data: { blockerId: friend.id, blockedId: me.id } });
  await page.goto(`/feed/u/${friend.id}/diary`);
  await expect(page.getByText("없는 주소예요")).toBeVisible();
  await expect(page.getByText("친구가 공개한 일기")).toHaveCount(0);
});

test("일기는 계정을 지우면 함께 지워진다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `지움${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await userByEmail(emails.me);
  await prisma.diaryEntry.create({ data: { userId: me.id, date: parseKSTDate(TODAY), content: "지워질 일기" } });
  expect(await prisma.diaryEntry.count({ where: { userId: me.id } })).toBe(1);

  await prisma.user.delete({ where: { id: me.id } });
  expect(await prisma.diaryEntry.count({ where: { userId: me.id } })).toBe(0);
});
