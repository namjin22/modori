/**
 * 날짜 아래 고양이 머리 표시. 그날 할 일 가운데 끝낸 만큼 아래부터 그 색으로 찬다.
 * 투두메이트의 날짜 표시처럼 달력만 봐도 어느 날 무엇을 얼마나 했는지 보인다.
 * 모양은 앱 아이콘(app/icon.svg)의 귀 달린 네모와 같다.
 *
 * 채움은 clipPath로 모양 안에만 그린다. 한 화면에 날짜가 여럿이라 id가 겹치지 않게
 * 부르는 쪽이 id를 넘긴다. 서버 컴포넌트에서도 쓰므로 훅을 쓰지 않는다.
 */
const SHAPES = (
  <>
    <path d="M11 22 L15 5 L28 15 Z" />
    <path d="M53 22 L49 5 L36 15 Z" />
    <rect x={6} y={14} width={52} height={46} rx={15} />
  </>
);

export function DayFill({
  id,
  total,
  doneColors,
  size = 18,
}: {
  id: string;
  total: number;
  // 끝낸 할 일의 색. 먼저 온 것이 맨 아래에 깔린다.
  doneColors: string[];
  size?: number;
}) {
  // 할 일이 없는 날도 자리는 지킨다. 날마다 칸 높이가 달라지면 달력 줄이 들쭉날쭉해진다.
  if (total === 0) return <span aria-hidden className="block shrink-0" style={{ width: size, height: size }} />;

  const share = 64 / total;
  const done = doneColors.slice(0, total);

  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 64 64" className="shrink-0">
      <defs>
        <clipPath id={id}>{SHAPES}</clipPath>
      </defs>
      {/* 테두리는 도리처럼 두 겹으로 그린다. 굵게 칠한 뒤 안쪽을 채움이 덮어 바깥 윤곽만 남는다. */}
      <g fill="var(--color-border)" stroke="var(--color-border)" strokeWidth={10} strokeLinejoin="round">
        {SHAPES}
      </g>
      <g clipPath={`url(#${id})`}>
        <rect width={64} height={64} fill="var(--color-surface-hover)" />
        {done.map((color, index) => (
          <rect
            key={index}
            x={0}
            // 칸 사이가 벌어져 보이지 않게 조금 겹친다.
            y={64 - share * (index + 1) - 0.5}
            width={64}
            height={share + 0.5}
            fill={color}
          />
        ))}
      </g>
    </svg>
  );
}
