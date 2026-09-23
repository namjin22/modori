import { onColorText } from "@/lib/colors";

/**
 * 카테고리 이름을 그 색으로 칠한 칩.
 *
 * 예전에는 색을 글씨에 쓰고 배경만 옅게 깔았는데, 팔레트에 흰색과 검정이 들어오면서
 * 한쪽 테마에서 글씨가 배경과 같아진다. 색을 배경으로 쓰고 글씨는 대비가 큰 쪽으로
 * 고른다. 카테고리 색이 더 잘 보이기도 한다.
 */
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
        color ? "color-edge" : "bg-surface text-muted"
      }`}
      style={
        color
          ? { backgroundColor: color, color: onColorText(color) }
          : undefined
      }
    >
      {name}
    </span>
  );
}
