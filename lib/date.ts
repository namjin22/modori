// 모든 날짜는 Asia/Seoul 기준이다.
//
// 표현 방식: "KST 날짜"는 그 날짜의 UTC 자정(00:00:00Z)을 가리키는 Date로 둔다.
// DB의 @db.Date 컬럼이 시각 없는 날짜이고, Prisma가 이를 UTC 자정 Date로 주고받기
// 때문이다. 이 규칙 덕분에 모든 계산을 getUTC* 계열로만 하게 되어, 서버 프로세스의
// TZ 환경변수가 무엇이든 결과가 같다. 로컬 시각 계열(getDate, getDay 등)은 쓰지 않는다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 임의 시각을 KST 기준 날짜로 절삭한다. */
export function toKSTDateOnly(d: Date): Date {
  const kstWallClock = d.getTime() + KST_OFFSET_MS;
  return new Date(Math.floor(kstWallClock / DAY_MS) * DAY_MS);
}

/** 시간대를 정하지 않은 사람과 운영자 지표의 기준. */
export const DEFAULT_TIMEZONE = "Asia/Seoul";

/** IANA 시간대 이름(예: "America/Toronto")으로 쓸 수 있는 값인가. */
export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * 그 시각에 그 시간대의 달력이 가리키는 날짜. 날짜 표현은 이 파일의 다른 값과 같다(그 날짜의 UTC 자정).
 * 시간대마다 서머타임과 30분·45분 시차가 있어 오프셋을 직접 더하지 않고 Intl이 계산하게 한다.
 */
export function dateIn(instant: Date, timezone: string): Date {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(read("year"), read("month") - 1, read("day")));
}

/** 그 시간대에서 지금의 "오늘". 사용자 화면은 이것을, 운영자 지표는 todayKST를 쓴다. */
export function todayIn(timezone: string): Date {
  return dateIn(new Date(), timezone);
}

/** 오늘의 KST 날짜. */
export function todayKST(): Date {
  return todayIn(DEFAULT_TIMEZONE);
}

/** "YYYY-MM-DD" */
export function formatKST(d: Date): string {
  const date = toKSTDateOnly(d);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 화면에 보여줄 짧은 날짜. "2026-09-17"보다 "9월 17일"이 눈에 빨리 들어온다. */
export function formatMonthDayKST(d: Date): string {
  const date = toKSTDateOnly(d);
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;
}

/** "YYYY-MM-DD"를 KST 날짜로. 형식이나 값이 틀리면 throw. */
export function parseKSTDate(s: string): Date {
  const match = DATE_PATTERN.exec(s);
  if (!match) {
    throw new RangeError(`날짜 형식이 올바르지 않다 (YYYY-MM-DD): ${s}`);
  }

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  // Date.UTC는 2026-02-30을 3월 2일로 넘겨버린다. 되돌려 비교해서 걸러낸다.
  if (formatKST(parsed) !== s) {
    throw new RangeError(`존재하지 않는 날짜다: ${s}`);
  }

  return parsed;
}

/**
 * KST 날짜가 시작되는 실제 시각(한국 자정 = 전날 15:00Z). createdAt 같은 시각 열을 "그날"로 묶을 때 쓴다.
 * KST 날짜 표현(UTC 자정)을 그대로 비교하면 9시간이 어긋난다.
 */
export function startOfKSTDayInstant(d: Date): Date {
  return new Date(toKSTDateOnly(d).getTime() - KST_OFFSET_MS);
}

/** n일 뒤(음수면 앞)의 날짜. 인자로 받은 Date는 바꾸지 않는다. */
export function addDays(d: Date, n: number): Date {
  const shifted = new Date(d.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + n);
  return shifted;
}

/** 0=일 … 6=토 */
export function weekdayKST(d: Date): number {
  return toKSTDateOnly(d).getUTCDay();
}

export function isSameKSTDate(a: Date, b: Date): boolean {
  return toKSTDateOnly(a).getTime() === toKSTDateOnly(b).getTime();
}

/** b - a. 일 단위 정수. */
export function daysBetween(a: Date, b: Date): number {
  const diff = toKSTDateOnly(b).getTime() - toKSTDateOnly(a).getTime();
  return Math.round(diff / DAY_MS);
}

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/** "YYYY-MM" */
export function formatMonthKST(d: Date): string {
  return formatKST(d).slice(0, 7);
}

/** "YYYY-MM"을 그 달 1일로. 형식이나 값이 틀리면 throw. */
export function parseKSTMonth(s: string): Date {
  const match = MONTH_PATTERN.exec(s);
  if (!match) {
    throw new RangeError(`월 형식이 올바르지 않다 (YYYY-MM): ${s}`);
  }

  return parseKSTDate(`${s}-01`);
}

export function startOfMonthKST(d: Date): Date {
  return parseKSTDate(`${formatMonthKST(d)}-01`);
}

/** 그 달의 마지막 날. 다음 달 1일에서 하루를 뺀다. */
export function endOfMonthKST(d: Date): Date {
  return addDays(addMonths(startOfMonthKST(d), 1), -1);
}

/** n달 뒤(음수면 앞)의 같은 달 1일. 날짜는 1일로 맞춘다. */
export function addMonths(d: Date, n: number): Date {
  const start = startOfMonthKST(d);
  const shifted = new Date(start.getTime());
  shifted.setUTCMonth(shifted.getUTCMonth() + n);
  return shifted;
}

/** 그 달의 일수. */
export function daysInMonthKST(d: Date): number {
  return endOfMonthKST(d).getUTCDate();
}
