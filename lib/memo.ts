/** 할 일·일정 메모의 최대 길이. 한 줄 요약이 아니라 준비물·범위 같은 몇 줄을 적는 칸이다. */
export const MAX_MEMO_LENGTH = 500;

/**
 * 폼이나 되돌리기에서 온 메모. 앞뒤 공백을 자르고 길이를 넘으면 자른다. 비면 null(메모 없음).
 * 문자열이 아니면 undefined를 돌려 "메모 칸이 없던 요청"으로 본다. 그런 요청은 메모를 건드리지 않는다.
 */
export function readMemo(value: unknown): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const memo = value.trim().slice(0, MAX_MEMO_LENGTH);
  return memo === "" ? null : memo;
}
