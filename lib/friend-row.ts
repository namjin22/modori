/**
 * 소셜 위쪽 친구 줄(얼굴을 옆으로 넘기는 줄)의 정렬과 순서 저장 규칙.
 * 한 줄에 이만큼만 읽는다. 프로필 사진(한 장 약 9KB)을 같이 읽으므로 친구가 수백 명이어도 이만큼만 읽고,
 * 나머지는 "전체 보기"(팔로우 목록)에서 본다.
 */
export const FRIEND_ROW_SIZE = 20;

/** 줄에 놓이는 순서: 정한 순서(sortOrder)가 작을수록 앞, 같으면 최근에 팔로우한 사람이 앞. */
export const FRIEND_ROW_ORDER = [{ sortOrder: "asc" }, { createdAt: "desc" }] as const;

/**
 * 순서를 바꿨을 때 보이는 친구들에게 줄 값. base는 이 사람이 팔로우한 모든 사이의 가장 작은 sortOrder다.
 * 보이는 친구는 늘 줄의 맨 앞이므로, 그 아래(base보다 작은 값)로 차례로 주면 안 보이는 친구와의 앞뒤는 그대로 두고
 * 보이는 친구끼리만 바뀐다. 모든 사이를 다시 쓰지 않아도 된다.
 */
export function friendOrderValues(count: number, base: number): number[] {
  return Array.from({ length: count }, (_, index) => base - count + index);
}
