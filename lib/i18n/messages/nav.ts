import { defineMessages } from "@/lib/i18n";

/** 아래 탭 막대. */
export const nav = defineMessages({
  ko: { feed: "피드", social: "소셜", myPage: "마이페이지", unread: "안 읽은 알림 {count}개" },
  en: { feed: "Feed", social: "Social", myPage: "My page", unread: "{count} unread notifications" },
  ja: { feed: "フィード", social: "ソーシャル", myPage: "マイページ", unread: "未読の通知{count}件" },
});
