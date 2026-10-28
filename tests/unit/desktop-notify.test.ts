import { describe, expect, it } from "vitest";

import { showsIconBadge } from "@/lib/desktop-notify";

describe("showsIconBadge", () => {
  it("이 기기에서 알림을 껐거나 브라우저가 막았으면 아이콘 숫자를 지운다", () => {
    expect(showsIconBadge("off")).toBe(false);
    expect(showsIconBadge("denied")).toBe(false);
  });

  it("알림을 켰으면(웹 푸시든 창이 열려 있을 때든) 아이콘 숫자를 띄운다", () => {
    expect(showsIconBadge("push")).toBe(true);
    expect(showsIconBadge("on")).toBe(true);
  });

  it("끄는 스위치가 없는 기기(unsupported)와 옛 앱(outdated)은 예전대로 둔다", () => {
    expect(showsIconBadge("unsupported")).toBe(true);
    expect(showsIconBadge("outdated")).toBe(true);
  });
});
