import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";

// 프로필 사진 고르기의 원이 칸 밖으로 삐져나오지 않는다(출시 당일 제보: 가입 화면 폭이 좁은데 5열로 고정돼 있었다).
const EMAIL = `e2e-avatarsize-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

for (const width of [320, 390, 430, 600]) {
  test(`가입 화면(${width}px)에서 캐릭터 원이 칸 안에 들어가고 칸끼리 겹치지 않는다`, async ({ page }) => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await page.getByLabel("테스트 이메일").fill(EMAIL);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    await expect(page.getByRole("radiogroup", { name: "프로필 사진" })).toBeVisible();

    const tiles = page.getByRole("radiogroup", { name: "프로필 사진" }).getByRole("radio");
    expect(await tiles.count()).toBe(5);
    const boxes = await tiles.evaluateAll((nodes) =>
      nodes.map((node) => {
        const tile = node.getBoundingClientRect();
        const circle = (node.querySelector("[data-avatar], img, span[aria-hidden]") as HTMLElement).getBoundingClientRect();
        return { tile: [tile.left, tile.right, tile.top, tile.bottom], circle: [circle.left, circle.right] };
      }),
    );
    for (const { tile, circle } of boxes) {
      expect(circle[0]).toBeGreaterThanOrEqual(tile[0]);
      expect(circle[1]).toBeLessThanOrEqual(tile[1] + 0.5);
    }
    // 같은 줄의 칸은 서로 겹치지 않는다.
    const row = boxes.filter((b) => b.tile[2] === boxes[0].tile[2]).sort((a, b) => a.tile[0] - b.tile[0]);
    for (let i = 1; i < row.length; i++) expect(row[i].tile[0]).toBeGreaterThanOrEqual(row[i - 1].tile[1]);
  });
}
