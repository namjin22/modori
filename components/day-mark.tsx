// 투두메이트처럼 날짜마다 작은 클로버를 붙인다. 숫자만 있으면 어느 날 무엇을
// 했는지 달력을 훑어서 알 수 없다. 한 일이 없으면 회색, 한 일이 있으면 그 일의
// 카테고리 색으로 잎을 칠하고, 그 날 할 일을 전부 끝냈으면 체크를 얹는다.
// 잎끼리 너무 겹치면 둥근 네모로 보인다. 가운데를 따로 채우고 잎은 벌린다.
const PETALS = [
  { cx: 6, cy: 6 },
  { cx: 14, cy: 6 },
  { cx: 6, cy: 14 },
  { cx: 14, cy: 14 },
];

export function DayMark({
  colors,
  allDone,
  size = 20,
}: {
  // 그 날 완료한 할 일의 카테고리 색. 겹치지 않게 넘긴다.
  colors: string[];
  allDone: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden
      className="shrink-0"
    >
      <circle
        cx={10}
        cy={10}
        r={4.5}
        className={colors.length === 0 ? "fill-border" : undefined}
        fill={colors.length === 0 ? undefined : colors[0]}
      />
      {PETALS.map((petal, index) => (
        <circle
          key={index}
          cx={petal.cx}
          cy={petal.cy}
          r={4.8}
          className={colors.length === 0 ? "fill-border" : undefined}
          fill={colors.length === 0 ? undefined : colors[index % colors.length]}
        />
      ))}
      {allDone && colors.length > 0 && (
        <path
          d="M6.4 10.2l2.4 2.4 4.8-5"
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
