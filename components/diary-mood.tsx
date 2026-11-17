import { ReactionGlyph } from "@/components/reaction-glyph";

/**
 * 일기에 붙은 기분 그림(2026-11-17). 기분은 캐릭터의 표정("dori:happy" 같은 값)이라 반응과 같은 그림으로 그린다.
 * 기분을 고르지 않은 일기는 공책 그림을 보인다. 서버·브라우저 화면이 같이 쓰므로 훅을 두지 않는다.
 */
export function DiaryMood({ value, size = 40 }: { value: string | null; size?: number }) {
  if (value) return <ReactionGlyph value={value} size={size} />;
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center text-muted" style={{ width: size, height: size }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <rect x={5} y={3.5} width={14} height={17} rx={2.4} />
        <path d="M9 8.5 H15 M9 12 H15 M9 15.5 H12.5" />
      </svg>
    </span>
  );
}
