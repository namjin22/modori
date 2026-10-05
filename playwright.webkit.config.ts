import { defineConfig, devices } from "@playwright/test";

import base from "./playwright.config";

/**
 * iPhone(Safari/WebKit) 확인용. `npm run test:webkit`. 속도 때문에 `npm run verify`에는 넣지 않고, 공개 전·화면 동작을 크게 바꾼 뒤에 돌린다.
 * Chromium만 돌리면 Safari에서만 생기는 문제를 놓친다(예: Safari는 버튼을 눌러도 포커스를 주지 않아, 빈 일정 칸이 날짜 창을 여는 순간 닫혔다 — INC-8).
 *
 * 폰 화면에 해당하는 시험만 모았다. 뺀 것: 넓은 화면의 달력·키보드 Tab·Windows 앱 안내처럼 데스크톱을 전제로 쓴 시험
 * (calendar, events의 달력 칸, a11y, desktop-*, layout, friend-private, move-category)과, Chromium 전용 터치 API(CDP)를 쓰는 touch.
 * 같은 시험이 Chromium으로 iPhone 크기만 맞춰도 똑같이 실패하는 것을 확인하고 뺐다(2026-10-05).
 */
export default defineConfig({
  ...base,
  workers: 2,
  projects: [{ name: "webkit-iphone", use: { ...devices["iPhone 14"] } }],
  testMatch: /(auth|todo|todo-edit|feed|date-picker|routine|undo-delete|category-add|mascot|offline|metrics|tab-cache|check-order|upcoming-events)\.spec\.ts/,
  // 뺀다: 달력 칸을 쓰는 일정 시험(좁은 화면에서는 달력이 접혀 있다), 마우스로 끌어 순서를 바꾸는 시험(폰은 손가락이고 WebKit의 마우스 끌기 흉내는 불안정하다).
  grepInvert: /일정은 달력에 이름으로|여러 날 일정은 그 기간|일정 이름을 다른 날로 끌면|첫날을 잡고 끌면|손잡이를 끌어 순서를 바꾸고/,
});
