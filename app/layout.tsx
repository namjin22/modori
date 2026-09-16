import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "모도리",
  description: "오늘 할 일을 색으로 남긴다",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
