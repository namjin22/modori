import { describe, expect, it } from "vitest";

import { friendOrderValues } from "@/lib/friend-row";

describe("friendOrderValues", () => {
  it("가장 작은 순서 아래로 차례로 준다: 보이는 친구가 안 보이는 친구보다 늘 앞에 남는다", () => {
    expect(friendOrderValues(3, 0)).toEqual([-3, -2, -1]);
    // 이미 순서를 바꿔 둔 사람(가장 작은 값이 -5): 그 아래로 이어서
    expect(friendOrderValues(3, -5)).toEqual([-8, -7, -6]);
  });

  it("값은 모두 서로 다르고 base보다 작다(같은 값이면 만든 때 순으로 되돌아가 순서가 섞인다)", () => {
    const values = friendOrderValues(20, -40);
    expect(new Set(values).size).toBe(20);
    expect(Math.max(...values)).toBeLessThan(-40);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  it("한 명도 없으면 빈 목록", () => {
    expect(friendOrderValues(0, 0)).toEqual([]);
  });
});
