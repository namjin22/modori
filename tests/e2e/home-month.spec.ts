import { expect, test, type Page, type Request } from "@playwright/test";

import { addDays, formatKST, todayIn, weekdayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 홈은 보이는 달 한 달치를 한 번에 받아 두고, 달 안에서 날짜를 바꿀 때 서버에 가지 않는다
// (공개 뒤 "달력에서 날짜를 누를 때마다 조금 뒤에 로딩돼서 불편하다"는 요청).
const EMAIL = `e2e-homemonth-${RUN_TAG}@modori.test`;
const FRIEND_EMAIL = `e2e-homemonth-friend-${RUN_TAG}@modori.test`;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const heading = (key: string) => {
  const [, month, day] = key.split("-");
  return `${Number(month)}월 ${Number(day)}일 ${WEEKDAYS[weekdayKST(new Date(`${key}T00:00:00Z`))]}요일`;
};

async function signUp(page: Page) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`한달${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  return prisma.user.findUniqueOrThrow({ where: { email: EMAIL }, include: { categories: true } });
}

/** 이 화면을 서버에 다시 그려 달라는 요청(RSC)만 센다. 다른 탭을 미리 받는 요청은 주소가 다르다. */
function countHomeFetches(page: Page) {
  const seen: string[] = [];
  const listener = (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname === "/" && request.headers()["rsc"] === "1") seen.push(url.search);
  };
  page.on("request", listener);
  return seen;
}

test.beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL, FRIEND_EMAIL] } } });
});

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL, FRIEND_EMAIL] } } });
  await prisma.$disconnect();
});

test("같은 달의 다른 날은 서버에 가지 않고 바로 보이고, 주소와 뒤로 가기도 맞는다", async ({ page }) => {
  const me = await signUp(page);
  const today = todayIn("Asia/Seoul");
  const todayKey = formatKST(today);
  // 같은 달의 다른 날: 1일(오늘이 1일이면 2일).
  const other = `${todayKey.slice(0, 8)}${todayKey.endsWith("-01") ? "02" : "01"}`;
  await prisma.todo.create({
    data: { userId: me.id, date: new Date(`${other}T00:00:00Z`), content: "다른 날 할 일", categoryId: me.categories[0].id },
  });
  await page.reload();
  await expect(homeReady(page)).toBeVisible();

  const fetches = countHomeFetches(page);
  await page.locator(`a[data-date="${other}"]`).click();
  await expect(page.getByRole("heading", { level: 1, name: heading(other) })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "다른 날 할 일" })).toBeVisible();
  await expect(page).toHaveURL(`/?date=${other}`);
  // 오늘로 돌아가기도 서버에 가지 않는다.
  await page.getByRole("link", { name: "오늘로 돌아가기" }).click();
  await expect(page.getByRole("heading", { level: 1, name: heading(todayKey) })).toBeVisible();
  await expect(page).toHaveURL("/");
  expect(fetches).toEqual([]);

  // 브라우저 뒤로 가기는 바로 전에 본 날로.
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: heading(other) })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "다른 날 할 일" })).toBeVisible();

  // 그 날에 적은 할 일은 그 날짜로 들어간다(주소만 바뀐 화면에서 서버 액션이 같은 날을 쓰는지).
  await page.getByRole("button", { name: `${me.categories[0].name}에 할 일 쓰기` }).click();
  const input = page.getByLabel(`${me.categories[0].name} 할 일`);
  await input.fill("고른 날에 적은 할 일");
  await input.press("Enter");
  await expect(page.getByRole("listitem").filter({ hasText: "고른 날에 적은 할 일" })).toBeVisible();
  // 화면에는 저장 전에 먼저 보이므로 DB는 기다려 본다.
  await expect
    .poll(async () => {
      const written = await prisma.todo.findFirst({ where: { userId: me.id, content: "고른 날에 적은 할 일" } });
      return written && formatKST(written.date);
    })
    .toBe(other);
  // 새로 받은 한 달치로 다시 그려도 고른 날에 머문다.
  await expect(page.getByRole("heading", { level: 1, name: heading(other) })).toBeVisible();
});

test("아직 열지 않은 지난 날을 고르면 그 날의 루틴 할 일이 그때 만들어진다", async ({ page }) => {
  const me = await signUp(page);
  const today = todayIn("Asia/Seoul");
  const yesterday = addDays(today, -1);
  test.skip(formatKST(yesterday).slice(0, 7) !== formatKST(today).slice(0, 7), "어제가 지난달이면 같은 달 안에서 시험할 수 없다");
  // 가입한 지 며칠 된 사람(가입일 앞으로는 루틴을 만들지 않는다).
  await prisma.user.update({ where: { id: me.id }, data: { createdAt: new Date(Date.now() - 5 * 86_400_000) } });
  await prisma.routine.create({
    data: {
      userId: me.id,
      categoryId: me.categories[0].id,
      content: "매일 물 마시기",
      freq: "DAILY",
      byWeekday: [],
      byMonthday: [],
      startDate: addDays(today, -3),
    },
  });
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "매일 물 마시기" })).toBeVisible();
  // 오늘 화면만 열었으니 어제의 루틴 할 일은 아직 없다.
  expect(await prisma.todo.count({ where: { userId: me.id, date: yesterday } })).toBe(0);

  await page.locator(`a[data-date="${formatKST(yesterday)}"]`).click();
  await expect(page.getByRole("heading", { level: 1, name: heading(formatKST(yesterday)) })).toBeVisible();
  await expect.poll(() => prisma.todo.count({ where: { userId: me.id, date: yesterday, content: "매일 물 마시기" } })).toBe(1);
  // "예정"이 아니라 체크할 수 있는 할 일로 바뀐다.
  await expect(page.getByRole("button", { name: "미리 완료" })).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: "매일 물 마시기" })).toBeVisible();
});

test("앞날의 루틴은 만들지 않고 예정으로 보인다", async ({ page }) => {
  const me = await signUp(page);
  const today = todayIn("Asia/Seoul");
  const tomorrow = addDays(today, 1);
  test.skip(formatKST(tomorrow).slice(0, 7) !== formatKST(today).slice(0, 7), "내일이 다음 달이면 같은 달 안에서 시험할 수 없다");
  await prisma.routine.create({
    data: {
      userId: me.id,
      categoryId: me.categories[0].id,
      content: "매일 산책",
      freq: "DAILY",
      byWeekday: [],
      byMonthday: [],
      startDate: today,
    },
  });
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "매일 산책" })).toBeVisible();

  await page.getByRole("link", { name: "다음 날" }).click();
  await expect(page.getByRole("heading", { level: 1, name: heading(formatKST(tomorrow)) })).toBeVisible();
  await expect(page.getByRole("button", { name: "미리 완료" })).toHaveCount(1);
  await page.waitForTimeout(500);
  expect(await prisma.todo.count({ where: { userId: me.id, date: tomorrow } })).toBe(0);
});

/** 서버 액션(할 일 저장)의 응답을 일부러 늦춘다. 화면이 응답을 기다리지 않고 먼저 바뀌는지 본다. */
async function slowServerActions(page: Page, delayMs: number) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

test("서버 응답이 늦어도 적기·체크·고치기·옮기기·지우기는 바로 화면에 보인다", async ({ page }) => {
  const me = await signUp(page);
  const category = me.categories[0].name;
  const todayKey = formatKST(todayIn("Asia/Seoul"));
  const day = Number(todayKey.slice(8));
  await slowServerActions(page, 2500);
  const fast = { timeout: 1500 };

  // 적기: 저장되는 동안은 흐리게(aria-busy) 보이다가 저장되면 보통 줄이 된다.
  for (const content of ["바로 보이는 할 일", "지울 할 일"]) {
    await page.getByRole("button", { name: `${category}에 할 일 쓰기` }).click();
    await page.getByLabel(`${category} 할 일`).fill(content);
    await page.getByLabel(`${category} 할 일`).press("Enter");
    await expect(page.getByRole("listitem").filter({ hasText: content })).toBeVisible(fast);
    await page.keyboard.press("Escape");
  }
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);

  // 체크: 진행 막대뿐 아니라 달력 칸도 바로 찬다.
  await page.getByRole("listitem").filter({ hasText: "바로 보이는 할 일" }).getByRole("button", { name: "완료", exact: true }).click();
  await expect(page.locator(`a[data-date="${todayKey}"]`)).toHaveAttribute("aria-label", `${day}일, 완료 있음`, fast);

  // 고치기: 저장을 누르면 창이 바로 닫히고 새 글자가 보인다.
  await page.getByRole("button", { name: "바로 보이는 할 일", exact: true }).click();
  await page.getByLabel("할 일 내용 수정").fill("고친 할 일");
  await page.getByLabel("할 일 내용 수정").press("Enter");
  await expect(page.getByRole("button", { name: "고친 할 일", exact: true })).toBeVisible(fast);
  await expect.poll(() => prisma.todo.count({ where: { userId: me.id, content: "고친 할 일" } })).toBe(1);

  // 지우기: 누르는 즉시 목록에서 빠진다.
  await page.getByRole("button", { name: "지울 할 일", exact: true }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "지울 할 일" })).toHaveCount(0, fast);
  await expect.poll(() => prisma.todo.count({ where: { userId: me.id, content: "지울 할 일" } })).toBe(0);

  // 옮기기(안 끝낸 일): "내일 하기"를 누르는 즉시 오늘 목록에서 빠진다.
  // (끝낸 일은 옮기지 않고 "내일 또 하기"로 베낀다. 2026-10-14 요청이라 끝낸 일 대신 새로 적은 안 끝낸 일로 본다.)
  await page.getByRole("button", { name: `${me.categories[0].name}에 할 일 쓰기` }).click();
  const moveInput = page.getByLabel(`${me.categories[0].name} 할 일`);
  await moveInput.fill("옮길 할 일");
  await moveInput.press("Enter");
  await expect(page.getByRole("listitem").filter({ hasText: "옮길 할 일" })).toBeVisible(fast);
  await page.keyboard.press("Escape");
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  await page.getByRole("button", { name: "옮길 할 일", exact: true }).click();
  await page.getByRole("button", { name: "내일 하기", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "옮길 할 일" })).toHaveCount(0, fast);
  await expect
    .poll(async () => formatKST((await prisma.todo.findFirstOrThrow({ where: { userId: me.id, content: "옮길 할 일" } })).date))
    .toBe(formatKST(addDays(todayIn("Asia/Seoul"), 1)));
});

test("친구 화면도 같은 달의 다른 날은 서버에 가지 않고 바로 보인다", async ({ page }) => {
  const me = await signUp(page);
  const today = todayIn("Asia/Seoul");
  const todayKey = formatKST(today);
  const other = `${todayKey.slice(0, 8)}${todayKey.endsWith("-01") ? "02" : "01"}`;
  const friend = await prisma.user.create({
    data: { email: FRIEND_EMAIL, nickname: `한달친구${RUN_TAG}`, privacyAgreedAt: new Date() },
  });
  const category = await prisma.category.create({ data: { userId: friend.id, name: "공부", color: "#2563eb", order: 0, isPublic: true } });
  await prisma.todo.createMany({
    data: [
      { userId: friend.id, categoryId: category.id, date: today, content: "친구의 오늘 할 일", order: 0 },
      { userId: friend.id, categoryId: category.id, date: new Date(`${other}T00:00:00Z`), content: "친구의 다른 날 할 일", order: 0, done: true, doneAt: new Date() },
    ],
  });
  await prisma.follow.create({ data: { followerId: me.id, followingId: friend.id } });

  await page.goto(`/feed/u/${friend.id}`);
  await expect(page.getByText("친구의 오늘 할 일")).toBeVisible();
  const fetches: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === `/feed/u/${friend.id}` && request.headers()["rsc"] === "1") fetches.push(url.search);
  });

  await page.locator(`a[data-date="${other}"]`).click();
  await expect(page.getByRole("heading", { level: 2, name: heading(other) })).toBeVisible();
  await expect(page.getByText("친구의 다른 날 할 일")).toBeVisible();
  await expect(page).toHaveURL(`/feed/u/${friend.id}?date=${other}`);
  await page.getByRole("link", { name: "오늘로 돌아가기" }).click();
  await expect(page.getByText("친구의 오늘 할 일")).toBeVisible();
  expect(fetches).toEqual([]);
});

