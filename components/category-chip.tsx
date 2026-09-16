/** 카테고리 이름을 그 색으로 옅게 깐 칩. 목록의 묶음 머리에 쓴다. */
export function CategoryChip({
  name,
  color,
}: {
  name: string;
  color: string | null;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        color ? "" : "bg-surface text-muted"
      }`}
      style={
        color
          ? // 색 값 뒤 1a는 10% 투명도다. 글씨는 원래 색 그대로 둔다.
            { color, backgroundColor: `${color}1a` }
          : undefined
      }
    >
      {name}
    </span>
  );
}
