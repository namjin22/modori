import { expect, test } from "@playwright/test";

import { DESKTOP_DOWNLOAD_URL } from "@/lib/desktop-download";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

const EMAIL = `e2e-desktop-download-${RUN_TAG}@modori.test`;

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test("Windows 앱 받기를 누르면 다운로드와 함께 설치 안내가 뜬다", async ({ page }) => {
  // 실제 설치 파일(110MB)을 받지 않는다. 같은 주소에 작은 파일을 돌려준다.
  await page.route(DESKTOP_DOWNLOAD_URL, (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=Modori-Setup.exe" },
      body: "stub",
    }),
  );

  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(EMAIL);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(`설치${RUN_TAG}`);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();

  await page.goto("/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Windows 앱 받기/ }).click();
  expect((await download).suggestedFilename()).toBe("Modori-Setup.exe");

  const guide = page.getByRole("dialog", { name: "설치하는 방법" });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("Windows의 PC 보호");
  await expect(guide).toContainText("추가 정보");
  await expect(guide).toContainText("이미 설치했다면");
  await guide.getByRole("button", { name: "알겠어요" }).click();
  await expect(guide).toBeHidden();
  await expect(page).toHaveURL(/\/settings$/);
});
