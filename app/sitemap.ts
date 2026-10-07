import type { MetadataRoute } from "next";

// 검색 엔진에 알릴 공개 화면. 로그인 뒤 화면은 모두 로그인 화면으로 보내져서(리디렉션) 넣지 않는다.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/login", "/privacy", "/terms"].map((path) => ({ url: `https://modori.site${path}` }));
}
