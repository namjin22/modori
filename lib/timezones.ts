import { DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/date";

/**
 * 마이페이지에서 고르는 시간대. 사용자는 "나라·도시"로 고르고, 저장하는 값은 IANA 이름이다(서머타임은 Intl이 따라간다).
 * 임의의 값을 받지 않고 이 목록 안의 것만 받는다. 목록에 없는 곳이 필요하면 여기에 더한다.
 */
export const TIMEZONES: { value: string; label: string }[] = [
  { value: "Asia/Seoul", label: "대한민국 · 서울" },
  { value: "Asia/Tokyo", label: "일본 · 도쿄" },
  { value: "Asia/Shanghai", label: "중국 · 상하이" },
  { value: "Asia/Taipei", label: "대만 · 타이베이" },
  { value: "Asia/Hong_Kong", label: "홍콩" },
  { value: "Asia/Singapore", label: "싱가포르" },
  { value: "Asia/Bangkok", label: "태국 · 방콕" },
  { value: "Asia/Ho_Chi_Minh", label: "베트남 · 호찌민" },
  { value: "Asia/Manila", label: "필리핀 · 마닐라" },
  { value: "Asia/Jakarta", label: "인도네시아 · 자카르타" },
  { value: "Asia/Kolkata", label: "인도 · 뉴델리" },
  { value: "Asia/Dubai", label: "아랍에미리트 · 두바이" },
  { value: "Europe/London", label: "영국 · 런던" },
  { value: "Europe/Paris", label: "프랑스 · 파리" },
  { value: "Europe/Berlin", label: "독일 · 베를린" },
  { value: "Europe/Madrid", label: "스페인 · 마드리드" },
  { value: "Europe/Moscow", label: "러시아 · 모스크바" },
  { value: "America/St_Johns", label: "캐나다 · 뉴펀들랜드" },
  { value: "America/Halifax", label: "캐나다 · 핼리팩스" },
  { value: "America/Toronto", label: "캐나다 · 토론토(동부)" },
  { value: "America/Winnipeg", label: "캐나다 · 위니펙(중부)" },
  { value: "America/Edmonton", label: "캐나다 · 에드먼턴(산악)" },
  { value: "America/Vancouver", label: "캐나다 · 밴쿠버(서부)" },
  { value: "America/New_York", label: "미국 · 뉴욕(동부)" },
  { value: "America/Chicago", label: "미국 · 시카고(중부)" },
  { value: "America/Denver", label: "미국 · 덴버(산악)" },
  { value: "America/Los_Angeles", label: "미국 · 로스앤젤레스(서부)" },
  { value: "America/Anchorage", label: "미국 · 앵커리지" },
  { value: "Pacific/Honolulu", label: "미국 · 하와이" },
  { value: "America/Mexico_City", label: "멕시코 · 멕시코시티" },
  { value: "America/Sao_Paulo", label: "브라질 · 상파울루" },
  { value: "Australia/Sydney", label: "호주 · 시드니" },
  { value: "Australia/Perth", label: "호주 · 퍼스" },
  { value: "Pacific/Auckland", label: "뉴질랜드 · 오클랜드" },
];

const ALLOWED = new Set(TIMEZONES.map((zone) => zone.value));

/** 목록에 있고 실제로 쓸 수 있는 시간대인가. */
export function isAllowedTimezone(value: unknown): value is string {
  return typeof value === "string" && ALLOWED.has(value) && isValidTimezone(value);
}

/** 저장된 값이 이상하면(목록에서 빠졌거나 깨졌으면) 기본 시간대로 돌린다. */
export function timezoneOrDefault(value: string | null | undefined): string {
  return isAllowedTimezone(value) ? value : DEFAULT_TIMEZONE;
}
