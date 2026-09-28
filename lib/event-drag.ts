/**
 * 달력에서 일정 이름을 끌어 놓은 날로 새 기간을 정한다. 날짜는 "YYYY-MM-DD"라 글자 순서가 곧 날짜 순서다.
 *
 * 시작일보다 앞에 놓으면 시작일을 당기고, 그 밖에는 종료일을 놓은 날로 옮긴다.
 * 28일 하루짜리 일정을 30일로 끌면 28~30일이 되고, 기간 안에 놓으면 그날까지로 줄어든다.
 */
export function dragRange(
  start: string,
  end: string,
  day: string,
): { start: string; end: string } {
  if (day < start) return { start: day, end };
  return { start, end: day };
}
