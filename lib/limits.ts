/**
 * 한 사람이 만들 수 있는 개수의 상한.
 *
 * 화면으로 쓰는 사람은 닿지 않을 만큼 넉넉하게 잡았다. 서버 액션은 스크립트로도 부를 수
 * 있어서, 상한이 없으면 한 사람이 할 일 수백만 개로 VM 디스크(20GB)를 채울 수 있다.
 */
export const LIMITS = {
  todosPerDay: 100,
  categories: 30,
  routines: 50,
  events: 1000,
} as const;
