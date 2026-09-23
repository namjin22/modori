import { describe, expect, it } from "vitest";

import { parseKSTDate } from "@/lib/date";
import { ddayLabel } from "@/lib/dday";

const today = parseKSTDate("2026-09-23");

function label(start: string, end: string) {
  return ddayLabel(parseKSTDate(start), parseKSTDate(end), today);
}

describe("ddayLabel", () => {
  it("시작 전이면 남은 날을 센다", () => {
    expect(label("2026-09-30", "2026-09-30")).toBe("D-7");
    expect(label("2026-09-24", "2026-09-24")).toBe("D-1");
  });

  it("시작하는 날이면 D-DAY다", () => {
    expect(label("2026-09-23", "2026-09-23")).toBe("D-DAY");
    expect(label("2026-09-23", "2026-09-25")).toBe("D-DAY");
  });

  it("여러 날짜리의 가운데면 진행 중이다", () => {
    expect(label("2026-09-22", "2026-09-25")).toBe("진행 중");
    expect(label("2026-09-22", "2026-09-23")).toBe("진행 중");
  });

  it("끝난 일정에는 아무것도 붙이지 않는다", () => {
    expect(label("2026-09-20", "2026-09-22")).toBeNull();
    expect(label("2026-09-22", "2026-09-22")).toBeNull();
  });

  it("해를 넘겨도 날 수로만 센다", () => {
    expect(label("2027-01-01", "2027-01-01")).toBe("D-100");
  });
});
