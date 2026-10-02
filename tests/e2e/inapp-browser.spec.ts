import { expect, test } from "@playwright/test";

test.describe("앱 안 브라우저", () => {
  test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 KAKAOTALK 10.4.0" });

  test("카카오톡 안에서 로그인 화면을 열면 다른 브라우저로 열라는 안내가 뜬다", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("note")).toContainText("다른 브라우저로 열기");
  });
});

test("일반 브라우저에는 그 안내가 없다", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("note")).toHaveCount(0);
});
