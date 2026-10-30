import { defineMessages } from "@/lib/i18n";

/**
 * 서버가 보내는 알림 문구: 앱 푸시, 컴퓨터 알림, 소셜 알림 미리보기. 받는 사람의 언어(User.locale)로 만든다.
 * "내가 정한 알림"은 사용자가 직접 쓴 문구라 번역하지 않는다.
 */
export const notices = defineMessages({
  ko: {
    brand: "모도리",
    reactionTitle: "반응이 왔어요",
    reactionBody: "{nickname}님이 내 할 일에 반응을 보냈어요",
    followTitle: "새 팔로워",
    followBody: "{nickname}님이 나를 팔로우했어요",
    doneTitle: "{nickname}님이 할 일을 끝냈어요",
    friendFallback: "친구",
    someoneFallback: "누군가",
    digestOne: "오늘 일정 1개 · {first}",
    digestMany: "오늘 일정 {count}개 · {first} 외",
  },
  en: {
    brand: "Modori",
    reactionTitle: "New reaction",
    reactionBody: "{nickname} reacted to your todo",
    followTitle: "New follower",
    followBody: "{nickname} followed you",
    doneTitle: "{nickname} finished a todo",
    friendFallback: "A friend",
    someoneFallback: "Someone",
    digestOne: "1 event today · {first}",
    digestMany: "{count} events today · {first} and more",
  },
  ja: {
    brand: "Modori",
    reactionTitle: "リアクションが届きました",
    reactionBody: "{nickname}さんがあなたのやることにリアクションを送りました",
    followTitle: "新しいフォロワー",
    followBody: "{nickname}さんがあなたをフォローしました",
    doneTitle: "{nickname}さんがやることを終えました",
    friendFallback: "友だち",
    someoneFallback: "誰か",
    digestOne: "今日の予定 1件 · {first}",
    digestMany: "今日の予定 {count}件 · {first} ほか",
  },
});
