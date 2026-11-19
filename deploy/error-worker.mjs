/**
 * 모도리 서버가 죽었을 때 Cloudflare의 기본 오류 화면(1033·530·502 …) 대신 보이는 모도리 화면(2026-11-19 운영자 요청).
 * Cloudflare Worker 하나다. 모든 요청을 그대로 원래 서버로 넘기고(fetch), 화면(HTML) 요청의 응답이 서버 오류(502·503·504, 520~530)면
 * 그 응답 대신 아래 화면을 같은 상태 번호로 돌려준다. 서버가 멀쩡할 때는 응답을 건드리지 않는다.
 *
 * 쓰는 법과 한계는 deploy/README.md "서버가 죽었을 때 보이는 오류 화면". 중요한 것만:
 * - 이 화면은 앱이 아니라 Cloudflare Worker가 그린다. 앱 컨테이너·VM·터널이 죽어도 뜰 수 있는 이유다. 앱 안의 404·500 화면은 앱이 살아 있을 때만 뜬다.
 * - **실제 장애(터널이 끊긴 1033 등)에서 Worker가 이 상태 번호를 받아 바꿔 주는지는 확인하지 못했다.** 미리보기(`/__error-preview?code=530`)로 모양만 본다.
 * - 화면이 아닌 요청(API·이미지·스크립트)은 그대로 둔다. 앱 코드가 진짜 상태 번호를 보고 판단해야 하기 때문이다.
 */

/** 이 화면으로 바꾸는 상태 번호: 게이트웨이 오류와 Cloudflare가 원서버에 닿지 못했을 때의 520~530. 앱이 직접 내는 500은 앱의 오류 화면이 있어 건드리지 않는다. */
export function shouldReplace(status) {
  return status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 530);
}

const TEXT = {
  ko: {
    title: "잠시 접속할 수 없어요",
    body: "모도리 서버에 문제가 생겼어요. 자동으로 다시 시도하고 있어요. 서버가 돌아오면 이 화면이 저절로 바뀌어요.",
    maintenanceTitle: "점검 중이에요",
    maintenanceBody: "잠시 뒤에 다시 들어와 주세요. 서버가 돌아오면 이 화면이 저절로 바뀌어요.",
    retry: "지금 다시 시도",
    ref: "문의할 때 이 번호를 알려 주세요",
  },
  en: {
    title: "We can't connect right now",
    body: "Modori's server is having a problem. We're retrying automatically. This screen changes by itself when the server is back.",
    maintenanceTitle: "Under maintenance",
    maintenanceBody: "Please come back in a moment. This screen changes by itself when the server is back.",
    retry: "Try now",
    ref: "If you contact us, please share this reference",
  },
  ja: {
    title: "ただいま接続できません",
    body: "モドリのサーバーに問題が発生しました。自動的に再試行しています。サーバーが復旧すると、この画面は自動で切り替わります。",
    maintenanceTitle: "メンテナンス中です",
    maintenanceBody: "しばらくしてからもう一度お越しください。サーバーが復旧すると、この画面は自動で切り替わります。",
    retry: "今すぐ再試行",
    ref: "お問い合わせの際はこの番号をお知らせください",
  },
};

/** 화면 언어: 앱이 기억해 둔 쿠키(locale)가 먼저, 없으면 브라우저 언어, 그것도 모르면 한국어. */
export function pickLocale(request) {
  const cookie = /(?:^|;\s*)locale=(ko|en|ja)\b/.exec(request.headers.get("cookie") ?? "");
  if (cookie) return cookie[1];
  const header = (request.headers.get("accept-language") ?? "").toLowerCase();
  for (const part of header.split(",")) {
    const code = part.trim().slice(0, 2);
    if (code === "ko" || code === "en" || code === "ja") return code;
  }
  return "ko";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

/** 오류 화면 한 장. 바깥 파일 없이 이 문자열 하나로 끝나야 한다(서버가 죽어 있으니 글꼴·이미지를 받을 곳이 없다). */
export function renderErrorPage({ status, locale, ray }) {
  const text = TEXT[locale] ?? TEXT.ko;
  const maintenance = status === 503;
  const title = maintenance ? text.maintenanceTitle : text.title;
  const body = maintenance ? text.maintenanceBody : text.body;
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="20">
<title>${status} · ${escapeHtml(title)}</title>
<style>
:root{--bg:#f7f8fa;--fg:#191f28;--muted:#667080;--brand:#2563eb;--on:#ffffff}
@media (prefers-color-scheme:dark){:root{--bg:#0e1013;--fg:#edeff2;--muted:#8b95a1;--brand:#60a5fa;--on:#08152d}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,"Segoe UI","Noto Sans KR","Noto Sans JP",sans-serif;text-align:center}
main{width:100%;max-width:360px}
.code{margin:0;font-size:64px;font-weight:800;letter-spacing:-.02em;color:var(--brand);font-variant-numeric:tabular-nums}
h1{margin:8px 0 0;font-size:20px}
p{margin:8px 0 0;font-size:14px;line-height:1.6;color:var(--muted)}
a.retry{display:flex;align-items:center;justify-content:center;height:48px;margin-top:24px;border-radius:16px;background:var(--brand);color:var(--on);font-size:14px;font-weight:600;text-decoration:none}
.ref{margin-top:16px;font-size:12px;word-break:break-all}
</style>
</head>
<body>
<main>
<p class="code">${status}</p>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(body)}</p>
<a class="retry" href="">${escapeHtml(text.retry)}</a>
${ray ? `<p class="ref">${escapeHtml(text.ref)}: ${escapeHtml(ray)}</p>` : ""}
</main>
</body>
</html>`;
}

function errorResponse(status, request, ray) {
  return new Response(renderErrorPage({ status, locale: pickLocale(request), ray }), {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "30" },
  });
}

function wantsHtml(request) {
  return (request.headers.get("accept") ?? "").includes("text/html");
}

const worker = {
  async fetch(request) {
    const url = new URL(request.url);
    // 모양만 보는 미리보기. 서버를 건드리지 않는다. 예: /__error-preview?code=530
    if (url.pathname === "/__error-preview") {
      const code = Number(url.searchParams.get("code"));
      return errorResponse(shouldReplace(code) ? code : 530, request, "preview");
    }

    let response;
    try {
      response = await fetch(request);
    } catch {
      // Worker가 원래 서버에 아예 닿지 못했다. 화면 요청만 오류 화면으로 바꾼다.
      return wantsHtml(request) ? errorResponse(502, request) : new Response("Bad Gateway", { status: 502 });
    }
    if (wantsHtml(request) && shouldReplace(response.status)) {
      return errorResponse(response.status, request, response.headers.get("cf-ray") ?? undefined);
    }
    return response;
  },
};

export default worker;
