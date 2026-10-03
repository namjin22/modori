import type { ReactNode } from "react";

import type { Metadata, Viewport } from "next";

import { NativeBridge } from "@/components/native-bridge";
import { StaleBanner } from "@/components/stale-banner";
import { ValidationBubble } from "@/components/validation-bubble";

import "./globals.css";

export const metadata: Metadata = {
  // 미리보기 그림 등 상대 주소를 이 주소 기준으로 채운다.
  metadataBase: new URL("https://modori.site"),
  title: "모도리",
  description: "모도리에서 친구들과 함께 매일을 채워가요",
  // 카카오톡·디스코드에 주소를 붙였을 때 뜨는 미리보기. 홍보할 때 첫인상이다.
  openGraph: {
    type: "website",
    url: "/",
    siteName: "모도리",
    title: "모도리",
    description: "모도리에서 친구들과 함께 매일을 채워가요",
    locale: "ko_KR",
    // 카카오톡 등은 미리보기 그림을 오래 붙잡아 둔다. 그림을 바꾸면 v를 올린다.
    images: [{ url: "/og.png?v=4", width: 1200, height: 630, alt: "모도리에서 친구들과 함께 매일을 채워가요" }],
  },
  twitter: { card: "summary_large_image" },
  // 홈 화면에 추가했을 때 주소창 없이 열린다.
  appleWebApp: { capable: true, title: "모도리", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  // 주소창 색을 배경과 맞춰 화면이 끊겨 보이지 않게 한다.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1013" },
  ],
  // 입력칸을 눌렀을 때 iOS가 화면을 확대해버리는 것만 막는다.
  // 사용자가 손가락으로 키우는 것은 막지 않는다.
  initialScale: 1,
  width: "device-width",
  viewportFit: "cover",
};

const FONT_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

// 스크립트가 붙인 스타일시트는 화면 그리기를 막지 않는다.
const FONT_SCRIPT = `
var l = document.createElement("link");
l.rel = "stylesheet";
l.href = ${JSON.stringify(FONT_CSS)};
document.head.appendChild(l);
`;

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
        {/* 글꼴 CSS를 <link rel="stylesheet">로 걸면 받을 때까지 화면을 그리지 않는다. 다른 도메인이라
            연결부터 새로 맺어서, 느린 3G에서 첫 화면이 6초 걸렸다. 미리 받기만 걸어 두고 스크립트로 붙여
            화면은 기본 글꼴로 먼저 그리고 Pretendard가 오면 바꿔 끼운다(글꼴 CSS가 font-display: swap).
            CSS의 @import는 Tailwind가 규칙을 앞에 붙여 무시되므로 쓰지 않는다. */}
        <link rel="preload" as="style" href={FONT_CSS} />
        <script dangerouslySetInnerHTML={{ __html: FONT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <NativeBridge />
        {children}
        {/* 브라우저 기본 입력 말풍선 대신 앱 모양의 말풍선을 띄운다. */}
        <ValidationBubble />
        {/* 화면이 오래돼 저장하지 못했을 때 새로고침 버튼을 띄운다(모바일 앱에는 새로고침 수단이 없다). */}
        <StaleBanner />
      </body>
    </html>
  );
}
