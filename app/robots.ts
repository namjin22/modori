import type { MetadataRoute } from "next";

// 로그인한 사람만 보는 서비스라 검색에 걸릴 화면은 로그인 화면·방침·약관뿐이다(app/sitemap.ts).
// API와 로그인 뒤 화면(온보딩·앱 로그인 중계·운영자)은 긁어 갈 이유가 없다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/desktop/", "/onboarding", "/admin/"] },
    sitemap: "https://modori.site/sitemap.xml",
  };
}
