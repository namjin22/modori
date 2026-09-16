import { expect, test } from "@playwright/test";

test("홈 화면에 추가할 수 있는 정보가 실린다", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);

  const body = await manifest.json();
  expect(body.name).toBe("모도리");
  expect(body.display).toBe("standalone");
  expect(body.start_url).toBe("/");

  // 아이콘이 실제로 받아져야 설치 화면에 뜬다. 경로만 맞춰두면 빈 칸이 된다.
  for (const icon of body.icons) {
    const file = await request.get(icon.src);
    expect(file.ok(), `${icon.src}를 받지 못했다`).toBe(true);
    expect(file.headers()["content-type"]).toContain("image/png");
  }

  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});
