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

/** 할 일 글자를 눌러 고치는 창을 연다. */
export async function openTodo(page: Page, content: string) {
  await page.getByRole("button", { name: content, exact: true }).click();
  await expect(page.getByLabel("할 일 내용 수정")).toBeVisible();
}

/** 일정 이름을 눌러 고치는 창을 연다. */
export async function openEvent(page: Page, title: string) {
  // 줄 안에 남은 날(D-7 같은 것)이 함께 들어가므로 이름을 통째로 맞추지 않는다.
  await page.getByRole("button", { name: title }).click();
  await expect(page.getByLabel("일정 이름", { exact: true })).toBeVisible();
}

/** "일정"을 눌러 만들기 창을 열고 하나 만든다. */
export async function addEvent(page: Page, title: string, endDate?: string) {
  await page.getByRole("button", { name: "일정", exact: true }).click();
  await page.getByLabel("새 일정 이름").fill(title);
  if (endDate) await page.getByLabel("새 일정 종료일").fill(endDate);
  await page.getByLabel("새 일정 이름").press("Enter");
  await expect(page.getByRole("listitem").filter({ hasText: title })).toBeVisible();
}
