"use client";

import { TimeSheet } from "@/components/time-sheet";

/**
 * 일정의 시작·끝 시간. 값은 "HH:MM"(24시간) 또는 ""(없음)으로 주고받아 서버(lib/event-time.ts)는 그대로다.
 * 예전에는 시·분 선택칸 둘이었는데 휴대폰에서 기기의 선택창이 떠 앱 화면과 달라 보였다(2026-10-15 요청).
 * 이제 내가 정한 알림과 같은 시각 고르기 창(components/time-sheet.tsx)을 쓴다.
 */
const pad = (value: number) => String(value).padStart(2, "0");

export function TimePicker({
  label,
  value,
  onChange,
  optional = false,
}: {
  // 화면 읽기용 이름. "새 일정 시작" → 버튼 "새 일정 시작 시간 …", 창 제목 "새 일정 시작 시간".
  label: string;
  value: string;
  onChange: (value: string) => void;
  // 끝나는 시간처럼 안 정해도 되는 칸이면 "없음"을 둔다.
  optional?: boolean;
}) {
  const minute = value ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : null;
  return (
    <div className="min-w-0 flex-1">
      <TimeSheet
        label={`${label} 시간`}
        value={minute}
        optional={optional}
        onChange={(next) => onChange(next === null ? "" : `${pad(Math.floor(next / 60))}:${pad(next % 60)}`)}
      />
    </div>
  );
}
