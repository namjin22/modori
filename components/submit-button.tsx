"use client";

import { useFormStatus } from "react-dom";

// 제출 중에 버튼이 계속 눌리면 같은 것이 여러 개 만들어진다.
// 실제로 루틴이 17개 쌓인 적이 있다.
export function SubmitButton({
  children,
  pendingLabel = "저장 중",
  className,
  pending: pendingFromForm,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  // onSubmit으로 보내는 폼은 useFormStatus가 모른다. 폼이 직접 알려준다.
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingFromForm ?? status.pending;

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className ?? ""} disabled:opacity-50`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
