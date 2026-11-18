import { MOOD_COLORS, MoodIcon } from "@/components/mood-icon";
import { isDiaryMood } from "@/lib/diary";

/**
 * 일기에 붙은 기분 그림(2026-11-18). 기분은 일기 전용 "마음 날씨" 그림이고(components/mood-icon.tsx), 대표색을 옅게 깐 둥근 칸에 담아 보인다.
 * 기분을 고르지 않은 일기(또는 알 수 없는 값)는 공책 그림을 보인다. label은 화면 읽기용 이름이다. 서버·브라우저 화면이 같이 쓰므로 훅을 두지 않는다.
 */
export function DiaryMood({ value, size = 44, label }: { value: string | null; size?: number; label?: string }) {
  if (value && isDiaryMood(value)) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-xl"
        style={{ width: size, height: size, backgroundColor: `color-mix(in srgb, ${MOOD_COLORS[value]} 18%, transparent)` }}
      >
        <MoodIcon mood={value} size={Math.round(size * 0.82)} />
        {label && <span className="sr-only">{label}</span>}
      </span>
    );
  }
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center text-muted" style={{ width: size, height: size }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <rect x={5} y={3.5} width={14} height={17} rx={2.4} />
        <path d="M9 8.5 H15 M9 12 H15 M9 15.5 H12.5" />
      </svg>
    </span>
  );
}
