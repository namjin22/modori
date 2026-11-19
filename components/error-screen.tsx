import type { ReactNode } from "react";

/**
 * 오류 화면의 공통 모양(2026-11-19 운영자 요청): 큰 오류 번호(404·500 같은 HTTP 번호) 아래에 제목과 설명, 단추.
 * 번호는 헤딩 밖의 따로 한 줄이라 헤딩 이름(제목)은 그대로다. 서버 컴포넌트(없는 주소)와 브라우저 컴포넌트(오류 화면)가 같이 쓴다.
 * `reference`는 서버가 오류에 붙여 준 번호(digest)로, 사용자가 알려 주면 서버 기록에서 찾는 데 쓴다.
 */
export function ErrorScreen({
  code,
  title,
  body,
  reference,
  mascot,
  children,
}: {
  code: string;
  title: string;
  body: string;
  reference?: string;
  mascot?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        {mascot}
        <p className="mt-2 text-6xl font-extrabold tabular-nums tracking-tight text-brand">{code}</p>
        <h1 className="mt-2 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
        {reference && <p className="mt-3 break-all text-xs text-muted">{reference}</p>}
      </div>
      {children}
    </main>
  );
}
