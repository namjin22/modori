/**
 * 모도리의 로고. 브랜드 파랑 위에 M 한 글자만 둔다.
 *
 * 글꼴로 쓰지 않고 선으로 그린다. 탭 아이콘은 글꼴이 없는 환경에서도 그려져야 하고,
 * 16px까지 줄어들기 때문에 획이 굵고 단순해야 한다.
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
      <rect width={64} height={64} rx={16} fill="#2563eb" />
      <path
        d="M19 44 V20 L32 35 L45 20 V44"
        fill="none"
        stroke="#ffffff"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
