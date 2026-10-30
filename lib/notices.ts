import { translator, type Locale } from "@/lib/i18n";
import { notices } from "@/lib/i18n/messages/notices";

/**
 * 반응·새 팔로워·친구가 끝낸 일 알림의 제목과 본문. 앱 푸시(lib/push.ts)와 소셜 알림 미리보기(lib/notification-preview.ts)가 같이 쓴다.
 * 받는 사람의 언어로 만든다.
 */
export function reactionNotice(locale: Locale, nickname: string | null): { title: string; body: string } {
  const t = translator(notices, locale);
  return { title: t("reactionTitle"), body: t("reactionBody", { nickname: nickname ?? t("friendFallback") }) };
}

export function followNotice(locale: Locale, nickname: string | null): { title: string; body: string } {
  const t = translator(notices, locale);
  return { title: t("followTitle"), body: t("followBody", { nickname: nickname ?? t("someoneFallback") }) };
}

/** 친구가 끝낸 일: 본문은 그 할 일의 글(공개 카테고리의 것)이다. */
export function doneNotice(locale: Locale, nickname: string | null, content: string): { title: string; body: string } {
  const t = translator(notices, locale);
  return { title: t("doneTitle", { nickname: nickname ?? t("friendFallback") }), body: content };
}
