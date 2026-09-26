/**
 * 브라우저가 보낸 id 목록을 믿을 수 있는 모양으로 거른다.
 *
 * 서버 액션의 인자는 TypeScript 타입과 상관없이 무엇이든 올 수 있다. 되돌리기 스냅숏과
 * 순서 목록은 브라우저가 들고 있다가 돌려주는 값이라, 배열이 아니거나 수만 개짜리
 * 목록이 오면 쿼리 하나가 서버를 오래 붙잡는다. 모양이 틀리면 통째로 거절한다.
 */
export function readIdList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  if (!value.every((id) => typeof id === "string" && id.length > 0 && id.length <= 64)) {
    return null;
  }
  return value;
}
