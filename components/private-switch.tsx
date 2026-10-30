import { LabeledSwitch } from "@/components/labeled-switch";

/**
 * "비공개" 스위치. 켜면 나만 보고, 꺼 두면(기본) 팔로우한 친구에게 보인다(2026-10-18 운영자 요청: 공개가 기본이고
 * 숨길 때만 켠다). 카테고리·일정·반복 일정·메모가 같이 쓴다. 폼에는 켜졌을 때만 name=on이 실린다.
 */
export function PrivateSwitch({
  name = "isPrivate",
  title,
  description,
  defaultChecked,
  checked,
  onChange,
}: {
  name?: string;
  title: string;
  description: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <LabeledSwitch
      name={name}
      title={title}
      description={description}
      {...(checked === undefined ? { defaultChecked: defaultChecked ?? false } : { checked, onChange })}
    />
  );
}
