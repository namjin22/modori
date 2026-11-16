/**
 * 처음 쓰는 사람을 위한 사용법 카드(/welcome, 2026-11-16 요청). 카드 순서와 도리 표정. 글은 lib/i18n/messages/tutorial.ts.
 * 브라우저 화면도 가져다 쓰므로 서버 전용 코드는 넣지 않는다.
 */
export const TUTORIAL_STEPS = [
  { id: "welcome", mood: "hello" },
  { id: "todos", mood: "like" },
  { id: "plan", mood: "calm" },
  { id: "friends", mood: "love" },
  { id: "more", mood: "cool" },
] as const;

export type TutorialStepId = (typeof TUTORIAL_STEPS)[number]["id"];

/** 시험이 자동 표시를 켜는 요청 머리글(아래 shouldAutoShowTutorial). */
export const TUTORIAL_TEST_HEADER = "x-modori-tutorial";

/**
 * 가입 뒤 처음 홈을 열 때 사용법 카드로 보낼지. 이미 끝내거나 건너뛴 사람(그리고 이 기능이 생길 때 있던 사용자)은 보내지 않는다.
 *
 * 시험 서버(AUTH_MODE=mock)는 가입 직후 곧바로 홈이 보이길 기대하는 시험이 수십 개라, 기본으로는 보내지 않고 사용법 카드를 시험하는
 * 시험만 머리글(x-modori-tutorial: on)로 켠다. 운영(mock이 아님)에서는 이 머리글을 보지 않는다.
 */
export function shouldAutoShowTutorial(input: { tutorialSeenAt: Date | null; mockAuth: boolean; testHeader: string | null }): boolean {
  if (input.tutorialSeenAt !== null) return false;
  if (input.mockAuth) return input.testHeader === "on";
  return true;
}
