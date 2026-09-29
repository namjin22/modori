"use client";

/**
 * 시·분 드롭다운. 브라우저 기본 시간 칸(<input type="time">)은 맥 영어 환경에서 "02:30 PM"처럼 칸이 나뉘고
 * AM/PM은 글자를 쳐야 바뀌어 헷갈렸다(사용자 제보). 시는 "오전 9시"처럼 한 목록에서 고르고, 분은 5분 단위다.
 * 값은 "HH:MM"(24시간) 또는 ""(없음)으로 주고받아 서버(lib/event-time.ts)는 그대로다.
 */
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);

function hourLabel(hour: number): string {
  if (hour === 0) return "오전 12시(자정)";
  if (hour === 12) return "오후 12시(정오)";
  return hour < 12 ? `오전 ${hour}시` : `오후 ${hour - 12}시`;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function TimePicker({
  label,
  value,
  onChange,
  optional = false,
}: {
  // 화면 읽기용 이름. "새 일정 시작" → "새 일정 시작 시", "새 일정 시작 분".
  label: string;
  value: string;
  onChange: (value: string) => void;
  // 끝나는 시간처럼 안 정해도 되는 칸이면 "없음"을 둔다.
  optional?: boolean;
}) {
  const [hourText, minuteText] = value ? value.split(":") : ["", ""];
  const minute = minuteText ? Number(minuteText) : 0;
  // 예전에 5분 단위가 아닌 시간(예: 14:07)을 넣었으면 그 값도 목록에 둔다.
  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort((a, b) => a - b);
  const select =
    "h-11 min-w-0 rounded-xl bg-surface-hover px-3 text-sm text-foreground disabled:opacity-40";

  return (
    <span role="group" aria-label={`${label} 시간`} className="flex min-w-0 items-center gap-1.5">
      <select
        aria-label={`${label} 시`}
        value={hourText}
        onChange={(event) =>
          onChange(event.target.value === "" ? "" : `${event.target.value}:${pad(minute)}`)
        }
        className={`${select} flex-1`}
      >
        {optional && <option value="">없음</option>}
        {HOURS.map((hour) => (
          <option key={hour} value={pad(hour)}>
            {hourLabel(hour)}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} 분`}
        value={pad(minute)}
        disabled={!value}
        onChange={(event) => onChange(`${hourText}:${event.target.value}`)}
        className={`${select} w-20 shrink-0`}
      >
        {minutes.map((option) => (
          <option key={option} value={pad(option)}>
            {pad(option)}분
          </option>
        ))}
      </select>
    </span>
  );
}
