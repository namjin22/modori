import { defineMessages } from "@/lib/i18n";

/** 오류 화면과 없는 주소 화면. */
export const errors = defineMessages({
  ko: {
    errorTitle: "잠깐 문제가 생겼어요",
    errorBody: "잠깐 뒤에 다시 해보세요. 계속 이러면 알려주세요.",
    retry: "다시 시도",
    globalTitle: "화면을 불러오지 못했어요",
    globalBody: "인터넷 연결을 확인하고 다시 불러와 주세요.",
    reloadAgain: "다시 불러오기",
    toStart: "처음 화면으로",
    notFoundTitle: "없는 주소예요",
    notFoundBody: "주소가 바뀌었거나 지워진 화면이에요.",
    toToday: "오늘 화면으로",
  },
  en: {
    errorTitle: "Something went wrong",
    errorBody: "Please try again in a moment. If it keeps happening, let us know.",
    retry: "Try again",
    globalTitle: "Couldn't load the screen",
    globalBody: "Check your internet connection and reload.",
    reloadAgain: "Reload",
    toStart: "Go to the start",
    notFoundTitle: "Page not found",
    notFoundBody: "This page has moved or been removed.",
    toToday: "Go to today",
  },
  ja: {
    errorTitle: "問題が発生しました",
    errorBody: "しばらくしてからもう一度お試しください。続く場合はお知らせください。",
    retry: "もう一度試す",
    globalTitle: "画面を読み込めませんでした",
    globalBody: "インターネット接続を確認して、もう一度読み込んでください。",
    reloadAgain: "再読み込み",
    toStart: "最初の画面へ",
    notFoundTitle: "ページが見つかりません",
    notFoundBody: "アドレスが変わったか、削除された画面です。",
    toToday: "今日の画面へ",
  },
});
