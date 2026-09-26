import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GSMSV VM에서 Docker로 돌린다. 실행에 필요한 파일만 .next/standalone에 모은다.
  output: "standalone",
  // 어떤 서버로 만들었는지 알려줄 이유가 없다. 공격하는 쪽에 버전 힌트만 준다.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 한 번 https로 들어온 브라우저는 다음부터 http로 시도하지 않는다.
          // http로 받은 이 헤더는 브라우저가 무시하므로 로컬 개발에는 영향이 없다.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // 다른 사이트가 모도리를 iframe에 넣어 버튼을 누르게 속이는 것을 막는다.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  // 화면을 옮기면서 없어진 주소. 즐겨찾기나 예전 링크로 들어와도 길을 잃지 않게 한다.
  // 쿼리(?month=...)는 그대로 따라간다.
  async redirects() {
    return [
      // Cloudflare는 http 요청도 그대로 넘겨준다. 로그인 화면이 평문으로 뜨지 않게 https로 보낸다.
      // 로컬 테스트(http://localhost)는 호스트가 달라 걸리지 않는다.
      {
        source: "/:path*",
        has: [
          { type: "host", value: "modori.site" },
          { type: "header", key: "x-forwarded-proto", value: "http" },
        ],
        destination: "https://modori.site/:path*",
        permanent: true,
      },
      // 운영이 GSMSV(modori.site)로 옮겨졌다. 예전 Vercel 주소로 오면 새 주소로 보낸다.
      // DB도 옮겨서 Vercel 쪽에 남으면 옛 DB에 쓰게 된다. www는 로그인 주소(AUTH_URL)와
      // 달라 로그인이 깨지므로 역시 넘긴다.
      {
        source: "/:path*",
        has: [{ type: "host", value: "modori.vercel.app" }],
        destination: "https://modori.site/:path*",
        permanent: false,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.modori.site" }],
        destination: "https://modori.site/:path*",
        permanent: true,
      },
      { source: "/calendar", destination: "/", permanent: false },
      { source: "/settings/categories", destination: "/categories", permanent: false },
      { source: "/settings/routines", destination: "/routines", permanent: false },
    ];
  },
};

export default nextConfig;
