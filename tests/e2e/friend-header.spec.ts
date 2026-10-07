import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";

// 친구 프로필 상단: 좁은 폰에서 "언팔로우"가 두 줄로 꺾이고 팔로우·팔로워 숫자가 끼어 들어가던 것을 막는다(공개 첫날 화면 점검).
const emails = [0, 1].map((n) => `e2e-friendheader-${n}-${RUN_TAG}@modori.test`);

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
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

for (const width of [320, 360, 390]) {
  test(`친구 프로필 상단(${width}px)은 버튼 글자가 꺾이지 않고 화면 밖으로 나가지 않는다`, async ({ page, browser }) => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    const other = await browser.newContext();
    await signUp(await other.newPage(), emails[1], `친구긴이름${RUN_TAG}`);
    await other.close();
    await signUp(page, emails[0], `나${RUN_TAG}`);
    const [me, friend] = await Promise.all(emails.map((email) => prisma.user.findUniqueOrThrow({ where: { email } })));
    // 소개글이 있으면 이름 칸이 좁아진다(처음 제보된 화면과 같은 조건).
    await prisma.user.update({ where: { id: friend.id }, data: { bio: "알고리즘 하루 두 문제" } });
    await prisma.follow.create({ data: { followerId: me.id, followingId: friend.id } });

    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/feed/u/${friend.id}`);
    const unfollow = page.getByRole("button", { name: "언팔로우" });
    await expect(unfollow).toBeVisible();
    // 버튼 높이가 고정(28px)이라 글자가 꺾이면 박스는 그대로이고 글자가 넘친다. 넘침(scrollHeight)으로 잰다.
    const wrapped = await unfollow.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(wrapped).toBe(false);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
