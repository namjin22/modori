import { notFound, redirect } from "next/navigation";

import { formatKST, parseKSTDate, todayIn } from "@/lib/date";
import { diaryDateProblem } from "@/lib/diary";
import { requireUser } from "@/lib/session";

/**
 * 일기 보기·쓰기 화면이 함께 쓰는 날짜 읽기(2026-11-24에 두 화면으로 나눴다).
 * 주소의 날짜가 잘못됐거나 너무 오래된 날이면 없는 주소, 아직 오지 않은 날이면 같은 종류의 화면의 오늘로 보낸다.
 */
export async function loadDiaryDay(raw: string, pageOf: (day: string) => string) {
  const user = await requireUser();
  let date: Date;
  try {
    date = parseKSTDate(raw);
  } catch (error) {
    console.error("[diary] 날짜 형식이 잘못됐다.", error);
    notFound();
  }
  const today = todayIn(user.timezone);
  const problem = diaryDateProblem(date, today);
  if (problem === "future") redirect(pageOf(formatKST(today)));
  if (problem === "tooOld") notFound();
  return { user, date, today, key: formatKST(date) };
}
