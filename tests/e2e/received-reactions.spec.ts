import { expect, test as base } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 받은 반응은 할 일 줄 오른쪽 끝에 겹친 그림과 개수로 보인다(2026-10-30 운영자 요청). 반응이 많아도 줄이 길어지지 않는다.
const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-recv-${testInfo.testId.slice(-6)}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email: { startsWith: `e2e-recv-${testInfo.testId.slice(-6)}-${RUN_TAG}` } } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email: { startsWith: `e2e-recv-${testInfo.testId.slice(-6)}-${RUN_TAG}` } } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("반응이 많아도 할 일 줄 높이는 그대로이고, 누르면 종류별 개수와 보낸 사람이 보인다", async ({ page, email }) => {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`받음${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  const me = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow({ where: { userId: me.id } });
  const senders = await Promise.all(
    ["a", "b", "c", "d"].map((tag) =>
      prisma.user.create({
        data: { email: email.replace("@", `-${tag}@`), nickname: `보냄${tag}${RUN_TAG}`, privacyAgreedAt: new Date() },
      }),
    ),
  );
  const make = (content: string, order: number) =>
    prisma.todo.create({
      data: { userId: me.id, categoryId: category.id, content, date: todayKST(), done: true, doneAt: new Date(), order },
    });
  const quiet = await make("반응 없는 일", 1);
  const loud = await make("반응 많은 일", 2);
  expect(quiet.id).not.toBe(loud.id);
  const emojis = ["🔥", "👏", "🎉", "🔥"];
  for (const [index, sender] of senders.entries()) {
    await prisma.reaction.create({ data: { userId: sender.id, todoId: loud.id, todoUserId: me.id, emoji: emojis[index] } });
  }

  await page.goto("/");
  const row = (name: string) => page.getByText(name, { exact: true }).locator("xpath=ancestor::div[contains(@class,'py-2.5')][1]");
  await expect(row("반응 많은 일")).toBeVisible();
  const quietBox = await row("반응 없는 일").boundingBox();
  const loudBox = await row("반응 많은 일").boundingBox();
  expect(Math.abs((loudBox?.height ?? 0) - (quietBox?.height ?? 0))).toBeLessThan(1);

  // 종류가 셋이어도 단추 하나에 합쳐지고, 이름에 종류별 개수가 모두 들어 있다.
  const button = row("반응 많은 일").getByRole("button", { name: /누가 보냈는지 보기/ });
  await expect(button).toHaveCount(1);
  await expect(button).toHaveAccessibleName("불타요 2개, 대단해 1개, 축하해 1개, 누가 보냈는지 보기");
  await expect(button).toContainText("4");

  await button.click();
  const dialog = page.getByRole("dialog", { name: "받은 반응" });
  await expect(dialog).toContainText("2개");
  for (const sender of senders) await expect(dialog).toContainText(sender.nickname ?? "");
});
