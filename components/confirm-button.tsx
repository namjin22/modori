"use client";

import { useFormStatus } from "react-dom";

// 삭제는 되돌릴 수 없다. 한 번 묻는다.
export function ConfirmButton({
  children,
  message,
  className,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={`${className ?? ""} disabled:opacity-50`}
    >
      {pending ? "처리 중" : children}
    </button>
  );
}
