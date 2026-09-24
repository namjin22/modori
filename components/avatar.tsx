/**
 * 사람 자리에 들어가는 동그란 그림. 올린 사진이 없으면 도리 얼굴을 쓴다.
 * 사진은 저장할 때 128×128로 줄여 둔 data URL이라 따로 받아올 게 없다.
 */
export function Avatar({
  src,
  size = 40,
  className = "",
}: {
  src: string | null;
  size?: number;
  className?: string;
}) {
  const round = "shrink-0 rounded-full object-cover";

  if (src) {
    return (
      // 사용자가 올린 data URL이라 next/image의 최적화가 할 일이 없다.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`${round} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return <DoriFace size={size} className={`${round} ${className}`} />;
}

/** 기본 프로필 그림. 도리 얼굴을 파란 바탕 가운데에 담는다. */
export function DoriFace({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="20 3 80 80"
      aria-hidden
      className={className}
    >
      <rect x={20} y={3} width={80} height={80} fill="#2563eb" />

      <g fill="#6e82ad" stroke="#6e82ad" strokeWidth={8} strokeLinejoin="round">
        <path d="M40 25 L35 9 Q48 11 55 21 Z" />
        <path d="M80 25 L85 9 Q72 11 65 21 Z" />
        <circle cx={60} cy={46} r={32} />
      </g>
      <g fill="#fdfbf7">
        <path d="M40 25 L35 9 Q48 11 55 21 Z" />
        <path d="M80 25 L85 9 Q72 11 65 21 Z" />
        <circle cx={60} cy={46} r={32} />
      </g>

      <ellipse cx={44} cy={18} rx={4.5} ry={5.5} fill="#ffd0dc" transform="rotate(-20 44 18)" />
      <ellipse cx={76} cy={18} rx={4.5} ry={5.5} fill="#ffd0dc" transform="rotate(20 76 18)" />
      <ellipse cx={42} cy={59} rx={9.5} ry={7.5} fill="#ffdbe4" />
      <ellipse cx={78} cy={59} rx={9.5} ry={7.5} fill="#ffdbe4" />
      <ellipse cx={46} cy={46} rx={6} ry={7.5} fill="#5d6f96" />
      <ellipse cx={74} cy={46} rx={6} ry={7.5} fill="#5d6f96" />
      <g stroke="#5d6f96" strokeWidth={3.2} strokeLinecap="round">
        <path d="M57 55 L63 59" />
        <path d="M63 55 L57 59" />
      </g>
    </svg>
  );
}
