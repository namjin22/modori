import { addDays, daysBetween, formatKST, parseKSTDate } from "@/lib/date";

/**
 * 달력에서 일정 이름표를 잡고(origin) 다른 날(day)에 놓았을 때의 새 기간. 날짜는 "YYYY-MM-DD".
 *
 * 어느 칸을 잡았는지로 무엇을 움직일지 정한다. 예전에는 잡은 칸과 상관없이 시작일을 고정하고
 * 종료일만 움직여서, 첫날을 잡고 줄이려 해도 끝이 줄었다.
 * - 하루짜리: 뒤로 끌면 종료일, 앞으로 끌면 시작일이 늘어난다.
 * - 첫날을 잡으면 시작일, 마지막 날을 잡으면 종료일을 옮긴다. 반대편을 넘어가면 두 끝이 바뀐다.
 * - 가운데를 잡으면 길이를 그대로 두고 기간째 옮긴다.
 */
export function dragRange(
  start: string,
  end: string,
  origin: string,
  day: string,
): { start: string; end: string } {
  const sorted = (a: string, b: string) => (a <= b ? { start: a, end: b } : { start: b, end: a });

  if (start === end) return sorted(start, day);
  if (origin === start) return sorted(day, end);
  if (origin === end) return sorted(start, day);

  const shift = daysBetween(parseKSTDate(origin), parseKSTDate(day));
  return {
    start: formatKST(addDays(parseKSTDate(start), shift)),
    end: formatKST(addDays(parseKSTDate(end), shift)),
  };
}
