import { expect, test } from "@playwright/test";

// Search Console이 "표준이 없는 중복 페이지"로 알린 것(로그인 화면에 쿼리가 붙은 주소들)을 막는다.
test("로그인 화면은 쿼리가 붙어도 대표 주소를 /login으로 알린다", async ({ page }) => {
  for (const url of ["/login", "/login?next=%2F", "/login?next=%2F%3Ffrom%3Ddiscord", "/login?error=Configuration"]) {
    await page.goto(url);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://modori.site/login");
  }
});

test("방침·약관도 대표 주소를 갖고, 사이트맵과 robots가 공개 화면만 알린다", async ({ page, request }) => {
  await page.goto("/privacy");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://modori.site/privacy");
  await page.goto("/terms");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://modori.site/terms");

  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/login", "/privacy", "/terms", "/support"]) expect(sitemap).toContain(`https://modori.site${path}`);
  expect(sitemap).not.toContain("/feed");

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap: https://modori.site/sitemap.xml");
  expect(robots).toContain("Disallow: /onboarding");
  expect(robots).toContain("Disallow: /desktop/");
});

// App Store Connect의 지원 URL. 로그인하지 않아도 문의 방법이 보여야 한다.
test("문의와 도움말 화면은 로그인 없이 열리고 문의 메일과 신고·삭제 안내가 있다", async ({ page }) => {
  await page.goto("/support");
  await expect(page.getByRole("heading", { name: "문의와 도움말", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /@/ }).first()).toHaveAttribute("href", /^mailto:/);
  await expect(page.getByText("신고하거나 차단할 수 있어요")).toBeVisible();
  await expect(page.getByRole("link", { name: "계정과 데이터 삭제" })).toBeVisible();
});
