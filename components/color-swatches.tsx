import { isPaletteColor, PALETTE } from "@/lib/colors";

/**
 * 색 고르기. 라디오 버튼이라 자바스크립트 없이 폼으로 그대로 전송된다.
 * emptyLabel을 주면 "고르지 않음"(카테고리 색 따르기) 칸을 맨 앞에 둔다.
 */
export function ColorSwatches({
  name,
  defaultValue,
  emptyLabel,
  legend,
}: {
  name: string;
  defaultValue: string;
  emptyLabel?: string;
  legend: string;
}) {
  // 예전에 색 선택기로 고른 색은 팔레트에 없을 수 있다. 그대로 보여주지 않으면
  // 아무것도 고르지 않은 상태가 되어, 저장을 눌러도 조용히 무시된다.
  const legacy =
    defaultValue && !isPaletteColor(defaultValue) ? defaultValue : null;

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-2 text-xs text-muted">{legend}</legend>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {emptyLabel && (
          <label className="relative flex h-7 cursor-pointer items-center rounded-full bg-surface-hover px-2.5 text-xs text-muted has-[:checked]:bg-foreground has-[:checked]:text-background">
            {/* 라디오를 칸 전체에 깔아둔다. 1px로 숨기면 손가락도 테스트도 라벨에 막힌다. */}
            <input
              type="radio"
              name={name}
              value=""
              defaultChecked={defaultValue === ""}
              aria-label={emptyLabel}
              className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-full"
            />
            {emptyLabel}
          </label>
        )}
        {legacy && (
          <label
            title="지금 쓰는 색"
            className="color-edge relative flex size-7 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-surface has-[:checked]:ring-2 has-[:checked]:ring-foreground"
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
            className="color-edge relative flex size-7 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-surface has-[:checked]:ring-2 has-[:checked]:ring-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
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
