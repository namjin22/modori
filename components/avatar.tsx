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

/** 탭 아이콘(app/icon.svg)과 같은 그림. 작게 써야 해서 몸 없이 얼굴만 담는다. */
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
      viewBox="0 0 64 64"
      aria-hidden
      className={className}
    >
      <rect width={64} height={64} fill="#2563eb" />
      <g fill="#6e82ad" stroke="#6e82ad" strokeWidth={5} strokeLinejoin="round">
        <path d="M23 25 L20 12 Q29 13 34 21 Z" />
        <path d="M45 25 L48 12 Q39 13 34 21 Z" />
        <circle cx={32} cy={38} r={19} />
      </g>
      <g fill="#fdfbf7">
        <path d="M23 25 L20 12 Q29 13 34 21 Z" />
        <path d="M45 25 L48 12 Q39 13 34 21 Z" />
        <circle cx={32} cy={38} r={19} />
      </g>
      <ellipse cx={25} cy={19} rx={2.4} ry={3} fill="#ffd0dc" transform="rotate(-20 25 19)" />
      <ellipse cx={43} cy={19} rx={2.4} ry={3} fill="#ffd0dc" transform="rotate(20 43 19)" />
      <ellipse cx={23} cy={44} rx={5.2} ry={4.2} fill="#ffdbe4" />
      <ellipse cx={41} cy={44} rx={5.2} ry={4.2} fill="#ffdbe4" />
      <ellipse cx={24.5} cy={36} rx={3.4} ry={4.3} fill="#5d6f96" />
      <ellipse cx={39.5} cy={36} rx={3.4} ry={4.3} fill="#5d6f96" />
      <g stroke="#5d6f96" strokeWidth={2.2} strokeLinecap="round">
        <path d="M29.8 41.6 L34.2 44.4" />
        <path d="M34.2 41.6 L29.8 44.4" />
      </g>
    </svg>
  );
}
