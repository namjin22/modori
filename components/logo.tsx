/**
 * 모도리의 로고. 고양이 귀가 달린 체크박스.
 * 할 일을 체크하는 서비스라는 것과 캐릭터 도리를 한 도형에 담는다.
 *
 * 탭 아이콘으로 16px까지 줄어들기 때문에 귀 두 개와 체크 하나만 남겼다.
 * app/icon.svg, app/favicon.ico, public/icons/*.png가 모두 이 그림이다.
 */
export function Logo({
  size = 96,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="모도리"
      className={className}
    >
      <g
        fill="#2563eb"
        stroke="#2563eb"
        strokeWidth={4}
        strokeLinejoin="round"
      >
        <path d="M11 22 L15 5 L28 15 Z" />
        <path d="M53 22 L49 5 L36 15 Z" />
        <rect x={6} y={14} width={52} height={46} rx={15} />
      </g>
      <path
        d="M20 37 L28.5 45.5 L44 29"
        fill="none"
        stroke="#ffffff"
        strokeWidth={6.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
