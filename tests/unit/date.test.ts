import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  formatKST,
  isSameKSTDate,
  parseKSTDate,
  todayKST,
  toKSTDateOnly,
  weekdayKST,
} from "@/lib/date";

// 요구사항 13(프로세스 TZ가 UTC / Asia/Seoul / America/New_York 어느 것이어도 결과가
// 같다)은 scripts/test-tz.mjs가 이 파일 전체를 세 TZ에서 반복 실행해 검증한다.

describe("toKSTDateOnly", () => {
  it("KST 밤 11시는 그 날이다 (다음 날로 넘어가지 않는다)", () => {
    const at2300KST = new Date("2026-09-15T14:00:00Z");
    expect(formatKST(toKSTDateOnly(at2300KST))).toBe("2026-09-15");
  });

  it("KST 새벽 0시 30분은 그 날이다 (전날로 밀리지 않는다)", () => {
    const at0030KST = new Date("2026-09-15T00:30:00+09:00");
    expect(formatKST(toKSTDateOnly(at0030KST))).toBe("2026-09-15");
  });

  it("시각을 UTC 자정으로 정규화한다", () => {
    const normalized = toKSTDateOnly(new Date("2026-09-15T14:00:00Z"));
    expect(normalized.toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });
});

describe("todayKST", () => {
  it("UTC 자정으로 정규화된 오늘 날짜를 준다", () => {
    const today = todayKST();
    expect(today.getTime()).toBe(toKSTDateOnly(new Date()).getTime());
    expect(today.toISOString().endsWith("T00:00:00.000Z")).toBe(true);
  });
});

describe("formatKST", () => {
  it("YYYY-MM-DD 형식으로 만든다", () => {
    expect(formatKST(parseKSTDate("2026-09-05"))).toBe("2026-09-05");
  });
});

describe("parseKSTDate", () => {
  it("정상 형식을 파싱한다", () => {
    expect(parseKSTDate("2026-09-15").toISOString()).toBe(
      "2026-09-15T00:00:00.000Z",
    );
  });

  it("두 자리로 맞추지 않은 월/일은 throw", () => {
    expect(() => parseKSTDate("2026-9-15")).toThrow();
  });

  it("존재하지 않는 달은 throw", () => {
    expect(() => parseKSTDate("2026-13-01")).toThrow();
  });

  it("존재하지 않는 날짜는 throw", () => {
    expect(() => parseKSTDate("2026-02-30")).toThrow();
  });

  it("윤년 2월 29일은 통과한다", () => {
    expect(formatKST(parseKSTDate("2028-02-29"))).toBe("2028-02-29");
  });
});

describe("addDays", () => {
  it("연말을 넘긴다", () => {
    expect(formatKST(addDays(parseKSTDate("2026-12-31"), 1))).toBe(
      "2027-01-01",
    );
  });

  it("음수로 연초를 되돌린다", () => {
    expect(formatKST(addDays(parseKSTDate("2027-01-01"), -1))).toBe(
      "2026-12-31",
    );
  });

  it("윤년 2월 29일을 만든다", () => {
    expect(formatKST(addDays(parseKSTDate("2028-02-28"), 1))).toBe(
      "2028-02-29",
    );
  });

  it("인자로 받은 Date를 바꾸지 않는다", () => {
    const original = parseKSTDate("2026-09-15");
    const before = original.getTime();
    addDays(original, 10);
    expect(original.getTime()).toBe(before);
  });
});

describe("weekdayKST", () => {
  it("2026-09-15는 화요일(2)", () => {
    expect(weekdayKST(parseKSTDate("2026-09-15"))).toBe(2);
  });

  it("2026-09-13은 일요일(0)", () => {
    expect(weekdayKST(parseKSTDate("2026-09-13"))).toBe(0);
  });

  it("KST 밤 11시의 요일은 그 날의 요일이다", () => {
    expect(weekdayKST(new Date("2026-09-15T14:00:00Z"))).toBe(2);
  });
});

describe("isSameKSTDate", () => {
  it("같은 KST 날짜의 다른 시각은 같다", () => {
    expect(
      isSameKSTDate(
        new Date("2026-09-15T00:30:00+09:00"),
        new Date("2026-09-15T23:00:00+09:00"),
      ),
    ).toBe(true);
  });

  it("날이 바뀌면 다르다", () => {
    expect(
      isSameKSTDate(
        new Date("2026-09-15T23:59:00+09:00"),
        new Date("2026-09-16T00:01:00+09:00"),
      ),
    ).toBe(false);
  });
});

describe("daysBetween", () => {
  it("뒤 날짜가 크면 양수", () => {
    expect(daysBetween(parseKSTDate("2026-09-15"), parseKSTDate("2026-09-20"))).toBe(5);
  });

  it("앞 날짜가 크면 음수", () => {
    expect(daysBetween(parseKSTDate("2026-09-20"), parseKSTDate("2026-09-15"))).toBe(-5);
  });

  it("같은 날은 0", () => {
    expect(daysBetween(parseKSTDate("2026-09-15"), parseKSTDate("2026-09-15"))).toBe(0);
  });

  it("해를 넘겨도 정확하다", () => {
    expect(daysBetween(parseKSTDate("2026-12-31"), parseKSTDate("2027-01-01"))).toBe(1);
  });
});
