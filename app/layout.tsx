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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
