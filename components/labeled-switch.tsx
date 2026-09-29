/**
 * 켜고 끄는 스위치 한 줄(제목, 설명). 체크박스 그대로 두어 키보드와 화면 읽기가 된다.
 * 서버 컴포넌트 폼에서도 쓰므로 상태를 두지 않는다. 켜져 있으면 폼에 `name=on`이 실린다.
 */
export function LabeledSwitch({
  name,
  title,
  description,
  defaultChecked = true,
}: {
  name: string;
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted">{description}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-border transition-colors before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-brand checked:before:translate-x-4"
      />
    </label>
  );
}
