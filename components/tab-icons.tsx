// 아이콘 하나 쓰자고 의존성을 늘리지 않는다. 네 개뿐이라 직접 그린다.
// 선 두께와 크기를 맞춰야 나란히 놓았을 때 흔들려 보이지 않는다.
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

/** 오늘: 체크 표시가 든 네모. 할 일을 뜻한다. */
export function TodayIcon({ active }: IconProps) {
  return (
    <svg {...BASE}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <path d="M8.5 12.2l2.4 2.4 4.6-4.9" strokeWidth={active ? 2.4 : 1.8} />
    </svg>
  );
}

/** 캘린더: 고리 두 개 달린 달력. */
export function CalendarIcon({ active }: IconProps) {
  return (
    <svg {...BASE}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="4" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3.5v3M16 3.5v3" />
      {active && <circle cx="12" cy="14.8" r="1.6" fill="currentColor" stroke="none" />}
    </svg>
  );
}

/** 피드: 사람 둘. 친구들의 기록이라는 뜻이다. */
export function FeedIcon({ active }: IconProps) {
  return (
    <svg {...BASE}>
      <circle cx="9.2" cy="8.6" r="3.3" fill={active ? "currentColor" : "none"} />
      <path d="M3.4 19.4c0-3 2.6-5 5.8-5s5.8 2 5.8 5" />
      <path d="M16.2 6.2a3.1 3.1 0 010 5.6" />
      <path d="M17.6 14.9c1.9.5 3.2 1.9 3.2 4.1" />
    </svg>
  );
}

/**
 * 설정: 톱니. 톱니 윤곽을 한 붓으로 그리면 24px에서 뭉개진다.
 * 원 두 개에 방사형 눈금 여덟 개를 얹는 쪽이 또렷하다.
 */
export function SettingsIcon({ active }: IconProps) {
  const ticks = Array.from({ length: 8 }, (_, index) => {
    const radian = (index * Math.PI) / 4;
    const cos = Math.cos(radian);
    const sin = Math.sin(radian);
    return `M${(12 + cos * 7.2).toFixed(2)} ${(12 + sin * 7.2).toFixed(2)}L${(
      12 +
      cos * 9.4
    ).toFixed(2)} ${(12 + sin * 9.4).toFixed(2)}`;
  }).join("");

  return (
    <svg {...BASE}>
      <circle cx="12" cy="12" r="7.2" />
      <circle cx="12" cy="12" r="3" fill={active ? "currentColor" : "none"} />
      <path d={ticks} strokeWidth={2.2} />
    </svg>
  );
}
