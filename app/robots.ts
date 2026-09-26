import type { MetadataRoute } from "next";

// 로그인한 사람만 보는 서비스라 검색에 걸릴 화면은 로그인 화면뿐이다. API는 긁어 갈 이유가 없다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
  };
}
