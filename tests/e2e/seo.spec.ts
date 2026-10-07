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
  for (const path of ["/login", "/privacy", "/terms"]) expect(sitemap).toContain(`https://modori.site${path}`);
  expect(sitemap).not.toContain("/feed");

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap: https://modori.site/sitemap.xml");
  expect(robots).toContain("Disallow: /onboarding");
  expect(robots).toContain("Disallow: /desktop/");
});
