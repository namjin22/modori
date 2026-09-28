/**
 * 카테고리 공개 스위치. 만들 때와 고칠 때 같이 쓴다. 체크박스 그대로 두어 키보드와 화면 읽기가 된다.
 * 서버 컴포넌트(만들기 폼)에서도 쓰므로 상태를 두지 않는다.
 */
export function PublicSwitch({ defaultChecked = true }: { defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="flex flex-col">
        <span className="text-sm font-medium">친구 피드에 보이기</span>
        <span className="text-xs text-muted">끄면 이 카테고리의 할 일은 나만 봐요</span>
      </span>
      <input
        type="checkbox"
        name="isPublic"
        defaultChecked={defaultChecked}
        className="relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-border transition-colors before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-brand checked:before:translate-x-4"
      />
    </label>
  );
}
