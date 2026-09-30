import { expect, test } from "@playwright/test";

test("계정 삭제 안내는 로그인하지 않아도 볼 수 있다", async ({ page }) => {
  await page.goto("/account-deletion");
  await expect(page.getByRole("heading", { name: "계정과 데이터 삭제", level: 1 })).toBeVisible();
  await expect(page.getByText("계정 지우기", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /@/ })).toBeVisible();
});
