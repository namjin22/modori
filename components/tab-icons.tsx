// 아이콘 하나 쓰자고 의존성을 늘리지 않는다. 세 개뿐이라 직접 그린다.
// 선 두께와 크기를 맞춰야 나란히 놓았을 때 흔들려 보이지 않는다.
// 고르지 않은 탭은 선으로, 고른 탭은 속을 채워서 지금 어디인지 색 말고 모양으로도 알린다.
type IconProps = { active: boolean };

const BASE = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

// 채운 모양 위에 얹는 선(체크, 얼굴 무늬)은 탭 막대의 바탕색으로 그려 구멍이 난 것처럼 보이게 한다.
const CUT = { stroke: "var(--surface)" } as const;

/**
 * 피드(홈): 모도리 로고처럼 고양이 귀가 달린 체크 상자. 할 일을 체크하는 곳이라는 뜻이고 앱 아이콘과 같은 그림이다
 * (components/logo.tsx를 24px에 맞춰 줄였다, 2026-10-26 요청).
 */
export function TodayIcon({ active }: IconProps) {
  return (
    <svg {...BASE} fill={active ? "currentColor" : "none"}>
      <path d="M4.6 8.3 5.5 3.4 9.7 6.5" />
      <path d="M19.4 8.3 18.5 3.4 14.3 6.5" />
      <rect x="3" y="6.5" width="18" height="14.5" rx="5" />
      <path d="M8.2 14.2l2.7 2.7 5-5.3" strokeWidth={2} style={active ? CUT : undefined} />
    </svg>
  );
}

/** 소셜: 사람 하나. 친구를 뜻한다(예전에는 둘이 겹쳐 있어 복잡했다, 2026-10-26 요청). */
export function SocialIcon({ active }: IconProps) {
  return (
    <svg {...BASE}>
      <circle cx="12" cy="8.4" r="3.7" fill={active ? "currentColor" : "none"} />
      <path d="M4.8 20c0-3.9 3.2-6.3 7.2-6.3s7.2 2.4 7.2 6.3" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

/**
 * 마이페이지: 웃는 얼굴. 예전의 톱니는 설정처럼 보여서 바꿨다(2026-10-26 요청).
 * 소셜이 사람 하나라 같은 사람 모양을 쓰면 둘이 헷갈려서 얼굴로 했다.
 */
export function MyPageIcon({ active }: IconProps) {
  return (
    <svg {...BASE}>
      <circle cx="12" cy="12" r="8.6" fill={active ? "currentColor" : "none"} />
      <path d="M8.6 14c.9 1.5 2 2.2 3.4 2.2s2.5-.7 3.4-2.2" style={active ? CUT : undefined} />
      <path d="M9.2 9.9h.01M14.8 9.9h.01" strokeWidth={2.6} style={active ? CUT : undefined} />
    </svg>
  );
}
