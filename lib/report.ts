/** 신고 이유. 화면에 보이는 글과 저장하는 값(키)이 같다. */
export const REPORT_REASONS = {
  spam: "스팸·광고",
  abuse: "욕설·괴롭힘",
  inappropriate: "부적절한 닉네임·소개·사진·할 일",
  impersonation: "다른 사람을 사칭",
  other: "기타",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && Object.hasOwn(REPORT_REASONS, value);
}

export const MAX_REPORT_DETAIL = 200;

// 한 사람이 하루에 낼 수 있는 신고 수. 운영자가 같은 사람의 신고에 묻히지 않게 한다.
export const REPORTS_PER_DAY = 10;
