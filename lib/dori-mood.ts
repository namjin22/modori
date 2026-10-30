import type { DoriMood } from "@/components/dori";
import { translator, type Locale } from "@/lib/i18n";
import { stats } from "@/lib/i18n/messages/stats";

/**
 * 상황에 맞는 도리 표정을 고른다. 화면마다 흩어 두면 같은 상황에 다른 얼굴이 나오기 쉬워서
 * 규칙을 여기 모은다. 서버와 브라우저 양쪽에서 부른다.
 */

/**
 * 그날 할 일 진행률 옆 도리. 시작 전에는 인사, 조금 하면 웃고, 절반을 넘기면 불타고,
 * 다 끝내면 박수. 할 일이 없으면 빈 화면에 따로 도리가 있어서 그리지 않는다.
 */
export function progressMood(done: number, total: number): DoriMood | null {
  if (total === 0) return null;
  if (done >= total) return "clap";
  if (done === 0) return "hello";
  return done * 2 >= total ? "fire" : "happy";
}

/** 기록 화면 맨 위 한 줄. 이어온 날은 이번 달을 볼 때만 뜻이 있다. */
export function statsMood(
  {
    rate,
    streak,
    isThisMonth,
  }: {
    rate: number;
    streak: number;
    isThisMonth: boolean;
  },
  locale: Locale = "ko",
): { mood: DoriMood; message: string } {
  const t = translator(stats, locale);
  if (rate === 100) return { mood: "cool", message: t("moodAll") };
  if (isThisMonth && streak >= 7) return { mood: "fire", message: t("moodStreak", { streak }) };
  if (rate >= 80) return { mood: "clap", message: t("moodAlmost") };
  if (rate >= 50) return { mood: "happy", message: t("moodHalf") };
  return { mood: "calm", message: t("moodGradual") };
}
