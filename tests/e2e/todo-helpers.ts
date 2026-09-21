import { expect, type Page } from "@playwright/test";

/** 가입하면 처음 하나만 만들어지는 카테고리. */
export const FIRST_CATEGORY = "Today's";

/**
 * 카테고리 칩의 +를 눌러 할 일을 적는다. 화면에 있는 유일한 추가 방법이라
 * 테스트도 사용자가 하는 그대로 따라간다.
 */
export async function addTodo(
  page: Page,
  content: string,
  category = FIRST_CATEGORY,
) {
  await page.getByRole("button", { name: `${category}에 할 일 쓰기` }).click();
  const input = page.getByLabel(`${category} 할 일`);
  await input.fill(content);
  await input.press("Enter");
  await expect(
    page.getByRole("listitem").filter({ hasText: content }),
  ).toBeVisible();
  // 열린 입력칸은 다음 조작을 가리므로 닫는다.
  await page.keyboard.press("Escape");
}

/** 할 일을 적을 수 있는 상태가 됐는지. 홈이 다 그려졌다는 신호로도 쓴다. */
export function homeReady(page: Page) {
  return page.getByRole("button", { name: `${FIRST_CATEGORY}에 할 일 쓰기` });
}

/** 카테고리 관리 화면에서 카테고리를 하나 만든다. */
export async function addCategory(page: Page, name: string) {
  await page.goto("/categories");
  await page.getByLabel("새 카테고리 이름").fill(name);
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}
