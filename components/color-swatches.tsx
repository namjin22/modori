import { isPaletteColor, PALETTE } from "@/lib/colors";

/**
 * 색 고르기. 라디오 버튼이라 자바스크립트 없이 폼으로 그대로 전송된다.
 */
export function ColorSwatches({
  name,
  defaultValue,
  legend,
}: {
  name: string;
  defaultValue: string;
  legend: string;
}) {
  // 예전에 색 선택기로 고른 색은 팔레트에 없을 수 있다. 그대로 보여주지 않으면
  // 아무것도 고르지 않은 상태가 되어, 저장을 눌러도 조용히 무시된다.
  const legacy =
    defaultValue && !isPaletteColor(defaultValue) ? defaultValue : null;

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-2 text-xs text-muted">{legend}</legend>
      {/* 칸 수만큼 똑같이 나눈 격자라 폭이 좁으면 견본이 같이 작아진다(최대 28px).
          크기를 정해 두면 가장 좁은 폰에서 마지막 하나가 다음 줄로 떨어진다. */}
      <div
        className="grid gap-1.5 sm:gap-2"
        style={{
          gridTemplateColumns: `repeat(${PALETTE.length + (legacy ? 1 : 0)}, minmax(0, 1.75rem))`,
        }}
      >
        {legacy && (
          <label
            title="지금 쓰는 색"
            className="color-edge relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-surface has-[:checked]:ring-2 has-[:checked]:ring-foreground"
            style={{ backgroundColor: legacy }}
          >
            <input
              type="radio"
              name={name}
              value={legacy}
              defaultChecked
              aria-label="지금 쓰는 색"
              className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-full"
            />
          </label>
        )}
        {PALETTE.map((color) => (
          <label
            key={color.value}
            title={color.name}
            className="color-edge relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-surface has-[:checked]:ring-2 has-[:checked]:ring-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
            style={{ backgroundColor: color.value }}
          >
            <input
              type="radio"
              name={name}
              value={color.value}
              defaultChecked={defaultValue === color.value}
              aria-label={color.name}
              className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-full"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
