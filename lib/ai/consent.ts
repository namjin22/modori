/**
 * AI 도우미 동의(User.aiChatConsentAt)가 지금의 안내 문구에 한 것인지 본다(2026-11-19, 운영자 결정, docs/decisions.md).
 * 도우미가 내용을 보내는 곳을 Google Gemini에서 Cloudflare Workers AI로 바꿨다. 그 전에 한 동의는 Google 문구에 한 것이라 새 받는 곳에는 다시 받는다.
 *
 * 사용자 데이터는 고치지 않고 읽을 때 이 시각과 견준다: 이 시각 전의 동의는 "다시 필요"(stale), 동의한 적이 없으면 "처음"(none).
 * 이 시각은 지금보다 늦으면 안 된다(시험 계정이 방금 동의한 것으로 만들어진다, tests/unit/ai-consent.test.ts). 새 문구가 운영에 나가기 직전에 잡았다.
 * 그 사이(10:20 KST부터 새 문구가 배포될 때까지)에 옛 문구로 동의한 사람이 있었다면 놓친다. 도우미가 한 번도 답하지 못했고 열어 본 사람이 거의 없어 가능성은 작다고 보지만 확인하지는 못했다.
 */
export const AI_CONSENT_VALID_FROM = new Date("2026-11-19T10:20:00+09:00");

export type AiConsentState = "none" | "stale" | "valid";

export function aiConsentState(consentAt: Date | null | undefined): AiConsentState {
  if (!consentAt) return "none";
  return consentAt.getTime() >= AI_CONSENT_VALID_FROM.getTime() ? "valid" : "stale";
}
