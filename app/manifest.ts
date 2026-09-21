import type { MetadataRoute } from "next";

// 홈 화면에 추가했을 때 앱처럼 열리게 한다.
// Service Worker는 아직 붙이지 않았다. 잘못 캐시하면 고친 화면이 사용자에게
// 영영 안 가므로, 얻는 것이 확실한 설치부터 먼저 한다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "모도리",
    short_name: "모도리",
    description: "오늘 할 일을 색으로 남겨요",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#2563eb",
    lang: "ko",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // 안드로이드가 아이콘을 원 모양 등으로 깎을 때 쓴다.
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
