import { describe, expect, it } from "vitest";

import { DEFAULT_TIMEZONE, dateIn, formatKST, isValidTimezone } from "@/lib/date";
import { isAllowedTimezone, TIMEZONES, timezoneOrDefault } from "@/lib/timezones";

const at = (iso: string, timezone: string) => formatKST(dateIn(new Date(iso), timezone));

describe("시간대별 오늘", () => {
  it("같은 순간이라도 시간대마다 날짜가 다르다", () => {
    // 2026-10-07 23:00Z = 서울 10-08 08:00, 토론토(EDT -4) 10-07 19:00, 밴쿠버(PDT -7) 10-07 16:00
    expect(at("2026-10-07T23:00:00Z", "Asia/Seoul")).toBe("2026-10-08");
    expect(at("2026-10-07T23:00:00Z", "America/Toronto")).toBe("2026-10-07");
    expect(at("2026-10-07T23:00:00Z", "America/Vancouver")).toBe("2026-10-07");
    // 30분 시차(인도 +5:30): 23:00Z = 04:30
    expect(at("2026-10-07T23:00:00Z", "Asia/Kolkata")).toBe("2026-10-08");
    expect(at("2026-10-07T18:29:00Z", "Asia/Kolkata")).toBe("2026-10-07");
    expect(at("2026-10-07T18:30:00Z", "Asia/Kolkata")).toBe("2026-10-08");
  });

  it("한국 자정에 서울 날짜가 바뀐다(서울은 기존과 같다)", () => {
    expect(at("2026-10-07T14:59:59Z", "Asia/Seoul")).toBe("2026-10-07");
    expect(at("2026-10-07T15:00:00Z", "Asia/Seoul")).toBe("2026-10-08");
  });

  it("현지 자정을 정확히 넘길 때 바뀐다(서머타임 전후, 서머타임 끝)", () => {
    // 토론토: 2026-11-01 02:00 EDT → 01:00 EST. 날짜 경계(자정)는 EDT(-4) 기준 04:00Z.
    expect(at("2026-11-01T03:59:00Z", "America/Toronto")).toBe("2026-10-31");
    expect(at("2026-11-01T04:00:00Z", "America/Toronto")).toBe("2026-11-01");
    // 서머타임 시작 직후(2026-03-08 07:00Z에 EST→EDT)에도 날짜는 3월 8일.
    expect(at("2026-03-08T06:59:00Z", "America/Toronto")).toBe("2026-03-08");
    expect(at("2026-03-08T07:00:00Z", "America/Toronto")).toBe("2026-03-08");
    // 서머타임이 끝난 뒤 11월 중순은 EST(-5): 05:00Z에 날짜가 바뀐다.
    expect(at("2026-11-15T04:59:00Z", "America/Toronto")).toBe("2026-11-14");
    expect(at("2026-11-15T05:00:00Z", "America/Toronto")).toBe("2026-11-15");
  });

  it("날짜 변경선 양쪽(+13과 -10)은 하루 가까이 차이 난다", () => {
    expect(at("2026-10-07T12:00:00Z", "Pacific/Auckland")).toBe("2026-10-08"); // NZDT +13 → 01:00
    expect(at("2026-10-07T12:00:00Z", "Pacific/Honolulu")).toBe("2026-10-07"); // -10 → 02:00
  });

  it("목록의 모든 시간대가 실제로 쓸 수 있는 값이고 값이 겹치지 않는다", () => {
    const values = TIMEZONES.map((zone) => zone.value);
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(isValidTimezone(value), value).toBe(true);
      expect(isAllowedTimezone(value), value).toBe(true);
    }
    expect(values).toContain(DEFAULT_TIMEZONE);
    expect(values).toContain("America/Toronto");
    expect(values).toContain("America/Vancouver");
  });

  it("목록에 없거나 이상한 값은 받지 않고 기본으로 돌린다", () => {
    for (const bad of ["", "Mars/Olympus", "Asia/Seoul; DROP TABLE", "UTC+9", "asia/seoul ", null, undefined, 9]) {
      expect(isAllowedTimezone(bad), String(bad)).toBe(false);
    }
    expect(isValidTimezone("Europe/Paris")).toBe(true);
    // 유효한 IANA 이름이지만 목록에 없으면 기본(서울)으로 본다.
    expect(isValidTimezone("Africa/Cairo")).toBe(true);
    expect(isAllowedTimezone("Africa/Cairo")).toBe(false);
    expect(timezoneOrDefault("Africa/Cairo")).toBe(DEFAULT_TIMEZONE);
    expect(timezoneOrDefault(undefined)).toBe(DEFAULT_TIMEZONE);
    expect(timezoneOrDefault("America/Toronto")).toBe("America/Toronto");
  });
});
