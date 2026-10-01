import { expect, test } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const VIEWER = `e2e-fp-viewer-${RUN_TAG}@modori.test`;
const OWNER = `e2e-fp-owner-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [VIEWER, OWNER] } } });
  await prisma.$disconnect();
});

test("공개 할 일을 다 끝내면, 안 끝낸 비공개 할 일이 있어도 친구에게는 다 한 것으로 보인다", async ({ page }) => {
  await prisma.user.deleteMany({ where: { email: { in: [VIEWER, OWNER] } } });
  const owner = await prisma.user.create({ data: { email: OWNER, nickname: `주인${RUN_TAG}`, privacyAgreedAt: new Date() } });
  const open = await prisma.category.create({ data: { userId: owner.id, name: "공개", color: "#22c55e", order: 0, isPublic: true } });
  const secret = await prisma.category.create({ data: { userId: owner.id, name: "비공개", color: "#ef4444", order: 1, isPublic: false } });
  const today = todayKST();
  const base = { userId: owner.id, date: today };
  await prisma.todo.createMany({
    data: [
      { ...base, categoryId: open.id, content: "공개 하나", done: true, doneAt: new Date(), order: 0 },
      { ...base, categoryId: open.id, content: "공개 둘", done: true, doneAt: new Date(), order: 1 },
      // 친구에게는 없는 일이다. 끝내지 않았어도 친구 화면의 "다 했다"를 깨면 안 된다.
      { ...base, categoryId: secret.id, content: "비밀 할 일", done: false, order: 0 },
    ],
  });

  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(VIEWER);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`친구${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
  const viewer = await prisma.user.findUniqueOrThrow({ where: { email: VIEWER } });
  await prisma.follow.create({ data: { followerId: viewer.id, followingId: owner.id } });

  await page.goto(`/feed/u/${owner.id}`);
  // 공개 묶음은 2/2, 비공개 묶음과 그 할 일은 흔적이 없다.
  await expect(page.getByText("공개 하나")).toBeVisible();
  await expect(page.getByText("2/2")).toBeVisible();
  await expect(page.getByText("비밀 할 일")).toHaveCount(0);
  await expect(page.getByText("비공개", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/0\/1|1\/3|2\/3/)).toHaveCount(0);

  // 날짜 밑 표시도 공개 할 일만 센다: 칸 둘이 모두 칠해져 있다(안 끝낸 칸 없음).
  const cell = page.getByRole("link", { name: new RegExp(`^${today.getUTCDate()}일, 완료 있음$`) }).first();
  await expect(cell).toBeVisible();
  await expect(cell.locator(`svg rect[fill="${open.color}"]`)).toHaveCount(2);
});
