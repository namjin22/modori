import { LabeledSwitch } from "@/components/labeled-switch";

/** 카테고리 공개 스위치. 만들 때와 고칠 때 같이 쓴다. */
export function PublicSwitch({ defaultChecked = true }: { defaultChecked?: boolean }) {
  return (
    <LabeledSwitch
      name="isPublic"
      title="친구 피드에 보이기"
      description="끄면 이 카테고리의 할 일은 나만 봐요"
      defaultChecked={defaultChecked}
    />
  );
}
