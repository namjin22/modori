import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GSMSV VM에서 Docker로 돌린다. 실행에 필요한 파일만 .next/standalone에 모은다.
  output: "standalone",
  // 화면을 옮기면서 없어진 주소. 즐겨찾기나 예전 링크로 들어와도 길을 잃지 않게 한다.
  // 쿼리(?month=...)는 그대로 따라간다.
  async redirects() {
    return [
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
