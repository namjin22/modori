// 서버가 죽었을 때 보이는 오류 화면(deploy/error-worker.mjs, 2026-11-19): 어떤 응답을 바꾸고 어떤 응답은 그대로 두는지, 화면에 무엇이 들어가는지.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import worker, { pickLocale, renderErrorPage, shouldReplace } from "../../deploy/error-worker.mjs";

const fetchMock = vi.fn();
const page = (path: string, headers: Record<string, string> = {}) => new Request(`https://modori.site${path}`, { headers: { accept: "text/html,application/xhtml+xml", ...headers } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("shouldReplace", () => {
  it("게이트웨이 오류와 Cloudflare가 원서버에 닿지 못한 520~530만 바꾼다. 앱의 500·404와 정상 응답은 그대로다", () => {
    for (const status of [502, 503, 504, 520, 522, 523, 525, 530]) expect(shouldReplace(status), String(status)).toBe(true);
    for (const status of [200, 301, 304, 400, 401, 403, 404, 429, 500, 501, 505, 519, 531]) expect(shouldReplace(status), String(status)).toBe(false);
  });
});

describe("worker.fetch", () => {
  it("정상 응답은 그대로 돌려준다(같은 객체)", async () => {
    const ok = new Response("hello", { status: 200 });
    fetchMock.mockResolvedValue(ok);
    expect(await worker.fetch(page("/"))).toBe(ok);
  });

  it("앱이 직접 낸 404·500은 건드리지 않는다(앱의 오류 화면이 있다)", async () => {
    for (const status of [404, 500]) {
      const original = new Response("앱 화면", { status });
      fetchMock.mockResolvedValue(original);
      expect(await worker.fetch(page("/x"))).toBe(original);
    }
  });

  it("화면 요청에 530이 오면 같은 상태 번호의 모도리 오류 화면으로 바꾸고, 캐시하지 않으며 다시 시도하라고 알린다. Cloudflare 요청 번호를 붙인다", async () => {
    fetchMock.mockResolvedValue(new Response("cloudflare 1033", { status: 530, headers: { "cf-ray": "a5c6aa80a81ab853-ICN" } }));
    const response = await worker.fetch(page("/"));
    expect(response.status).toBe(530);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("30");
    const html = await response.text();
    expect(html).toContain(">530</p>");
    expect(html).toContain("잠시 접속할 수 없어요");
    expect(html).toContain("a5c6aa80a81ab853-ICN");
    expect(html).toContain('http-equiv="refresh"');
  });

  it("503은 점검 중 문구다. 다른 번호는 접속 불가 문구다", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));
    expect(await (await worker.fetch(page("/"))).text()).toContain("점검 중이에요");
    fetchMock.mockResolvedValue(new Response("", { status: 502 }));
    expect(await (await worker.fetch(page("/"))).text()).toContain("잠시 접속할 수 없어요");
  });

  it("화면이 아닌 요청(API 등)은 5xx여도 그대로 둔다", async () => {
    const original = new Response('{"error":"x"}', { status: 502 });
    fetchMock.mockResolvedValue(original);
    expect(await worker.fetch(new Request("https://modori.site/api/health", { headers: { accept: "application/json" } }))).toBe(original);
  });

  it("원서버에 아예 닿지 못하면(fetch 예외) 화면 요청은 502 화면, 그 밖은 짧은 502 글이다", async () => {
    fetchMock.mockRejectedValue(new TypeError("network"));
    const html = await worker.fetch(page("/"));
    expect(html.status).toBe(502);
    expect(await html.text()).toContain(">502</p>");
    const api = await worker.fetch(new Request("https://modori.site/api/x", { headers: { accept: "application/json" } }));
    expect(api.status).toBe(502);
    expect(await api.text()).toBe("Bad Gateway");
  });

  it("미리보기는 원서버를 부르지 않고, 알 수 없는 번호는 530으로 본다", async () => {
    const response = await worker.fetch(page("/__error-preview?code=502"));
    expect(response.status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await worker.fetch(page("/__error-preview?code=abc"))).status).toBe(530);
    expect((await worker.fetch(page("/__error-preview?code=200"))).status).toBe(530);
  });
});

describe("pickLocale / renderErrorPage", () => {
  it("앱이 기억한 언어 쿠키가 먼저, 없으면 브라우저 언어, 그것도 모르면 한국어", () => {
    expect(pickLocale(page("/", { cookie: "a=1; locale=ja" }))).toBe("ja");
    expect(pickLocale(page("/", { "accept-language": "en-US,en;q=0.9" }))).toBe("en");
    expect(pickLocale(page("/", { "accept-language": "fr-FR" }))).toBe("ko");
    expect(pickLocale(page("/", { cookie: "locale=en", "accept-language": "ja" }))).toBe("en");
  });

  it("영어·일본어 화면과 글자 이스케이프, 바깥 파일을 쓰지 않는다", () => {
    // 작은따옴표는 HTML 안전 문자(&#39;)로 나간다.
    expect(renderErrorPage({ status: 522, locale: "en" })).toContain("We can&#39;t connect right now");
    expect(renderErrorPage({ status: 522, locale: "ja" })).toContain("ただいま接続できません");
    const html = renderErrorPage({ status: 530, locale: "ko", ray: '<script>alert("x")</script>' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    // 서버가 죽어 있어도 그려져야 하니 바깥 글꼴·이미지·스크립트를 받지 않는다.
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toMatch(/<link\b|<script\b|@import/);
  });
});
