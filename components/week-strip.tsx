import Link from "next/link";

import { formatKST, weekdayKST } from "@/lib/date";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export type WeekDay = {
  date: Date;
  done: number;
  total: number;
};

/**
 * 한 주를 한 줄로 보여준다. 화살표로 하루씩 넘기는 것만 있으면
 * 어제 뭘 했는지 보려고 몇 번을 눌러야 하고, 이번 주를 얼마나 했는지도 알 수 없다.
 */
export function WeekStrip({
  days,
  selected,
  today,
  basePath = "/",
}: {
  days: WeekDay[];
  selected: Date;
  today: Date;
  // 친구 화면에서도 같은 줄을 쓴다. 링크만 그 사람 주소로 바꾼다.
  basePath?: string;
}) {
  const selectedKey = formatKST(selected);
  const todayKey = formatKST(today);

  return (
    <nav aria-label="주간 날짜" className="flex gap-1">
      {days.map((day) => {
        const key = formatKST(day.date);
        const weekday = weekdayKST(day.date);
        const isSelected = key === selectedKey;
        const isToday = key === todayKey;
        const ratio = day.total === 0 ? 0 : day.done / day.total;

        return (
          <Link
            key={key}
            href={`${basePath}?date=${key}`}
            // 날짜 링크는 미리 받지 않는다. 한 줄에 일곱 개라, 켜두면 이 화면을
            // 그릴 때마다 서버에서 같은 화면을 일곱 번 더 그린다.
            prefetch={false}
            aria-label={`${Number(key.slice(5, 7))}월 ${Number(key.slice(8))}일`}
            aria-current={isSelected ? "date" : undefined}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 transition-colors hover:bg-surface-hover"
          >
            <span
              className={`text-[11px] ${
                weekday === 0
                  ? "text-red-400"
                  : weekday === 6
                    ? "text-blue-400"
                    : "text-muted"
              }`}
            >
              {WEEKDAY_NAMES[weekday]}
            </span>

            <span
              className={`flex size-8 items-center justify-center rounded-full text-sm transition-colors ${
                isSelected
                  ? "bg-foreground font-bold text-background"
                  : isToday
                    ? "font-bold text-brand"
                    : "text-foreground"
              }`}
            >
              {Number(key.slice(8))}
            </span>

            {/* 그 날 얼마나 했는지. 할 일이 없는 날은 아무것도 그리지 않는다. */}
            {/* 할 일이 없는 날은 빈 줄도 그리지 않는다. 자국처럼 보인다. */}
            <span className="h-1 w-6 overflow-hidden rounded-full">
              {day.total > 0 && (
                <span className="flex h-full w-full rounded-full bg-surface-hover">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
