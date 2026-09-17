import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 화면을 옮기면서 없어진 주소. 즐겨찾기나 예전 링크로 들어와도 길을 잃지 않게 한다.
  // 쿼리(?month=...)는 그대로 따라간다.
  async redirects() {
    return [
      { source: "/calendar", destination: "/", permanent: false },
      { source: "/settings/categories", destination: "/categories", permanent: false },
      { source: "/settings/routines", destination: "/routines", permanent: false },
    ];
  },
};

export default nextConfig;
