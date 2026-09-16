import type { ReactNode } from "react";

import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "모도리",
  description: "오늘 할 일을 색으로 남긴다",
};

// 화면이 그려지기 전에 테마를 정해야 라이트로 한 번 번쩍이지 않는다.
// 그래서 React가 아니라 head의 동기 스크립트로 처리한다.
const THEME_SCRIPT = `
try {
  var t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {
  // 저장소를 못 읽으면 기기 설정을 따른다
}
`;

// LayoutProps는 next build가 만들어주는 전역 타입이라 빌드 전에는 없다.
// CI는 빌드 없이 tsc부터 돌리므로 직접 적는다.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* 글꼴을 CDN에서 받으므로 연결을 미리 열어둔다. 첫 화면에서 글자가 늦게 뜨는 시간이 줄어든다. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        {/* CSS의 @import로 넣으면 Tailwind가 앞에 규칙을 붙이면서
            @import가 규칙 뒤로 밀려 브라우저가 무시한다. link로 직접 건다. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
