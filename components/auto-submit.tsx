"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 열리자마자 한 번 보내는 폼. 앱에서 누른 로그인 버튼을 브라우저에서 이어 갈 때 쓴다.
 * 자바스크립트가 막혔거나 느리면 버튼을 직접 누를 수 있다.
 */
export function AutoSubmit({
  action,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    ref.current?.requestSubmit();
  }, []);

  return (
    <form ref={ref} action={action} className="flex w-full flex-col gap-3">
      {children}
    </form>
  );
}
