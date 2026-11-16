import { ai } from "@/lib/i18n/messages/ai";
import { getT } from "@/lib/i18n/server";

const list = "flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed";

/** 접었다 펴는 한 칸. 누르기 전에는 제목 줄만 보인다. 글자와 키보드(Enter·Space)로 여는 것은 브라우저의 details가 맡는다. */
function Topic({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <svg
          aria-hidden
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-muted transition-transform group-open:rotate-90"
        >
          <path d="M9 5 L16 12 L9 19" />
        </svg>
      </summary>
      <div className="flex flex-col gap-3 px-5 pb-5">{children}</div>
    </details>
  );
}

/**
 * AI 연결(MCP) 화면 아래쪽의 자세한 설명과 도움말(2026-11-16 요청: 들어가자마자 긴 설명이 보이지 않게, 눌렀을 때만 펴지게).
 * 위쪽에는 연결 방법·서버 주소·토큰 만들기·내 토큰만 둔다(components/api-token-manager.tsx).
 * 무엇을 시킬 수 있고 무엇은 못 하는지, 한도가 무엇인지, 안 될 때 어떻게 하는지는 토큰을 만들기 전에 읽어 둘 글이다.
 */
export async function AiHelp() {
  const t = await getT(ai);
  return (
    <section aria-labelledby="ai-help-title" className="flex flex-col gap-3">
      <h2 id="ai-help-title" className="text-sm font-semibold text-muted">
        {t("helpTitle")}
      </h2>

      <Topic title={t("aboutTitle")}>
        <p className="text-sm leading-relaxed">{t("intro")}</p>
        <p className="text-sm leading-relaxed">{t("introMcp")}</p>
      </Topic>

      <Topic title={t("safetyTitle")}>
        <ul className={list}>
          {(["safety1", "safety2", "safety3", "safety4"] as const).map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </Topic>

      <Topic title={t("examplesTitle")}>
        <ul className="flex flex-col gap-2">
          {(["example1", "example2", "example3", "example4"] as const).map((key) => (
            <li key={key} className="rounded-xl bg-surface-hover px-4 py-3 text-sm leading-relaxed">
              {t(key)}
            </li>
          ))}
        </ul>
      </Topic>

      <Topic title={t("canTitle")}>
        <ul className={list}>
          {(["can1", "can2", "can3", "can4", "can5", "can6", "can7"] as const).map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-muted">{t("canNote")}</p>
      </Topic>

      <Topic title={t("cannotTitle")}>
        <ul className={list}>
          {(["cannot1", "cannot2", "cannot3"] as const).map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </Topic>

      <Topic title={t("limitsTitle")}>
        <p className="text-sm leading-relaxed">{t("limitsBody")}</p>
      </Topic>

      <Topic title={t("fixTitle")}>
        <ul className={list}>
          {(["fix1", "fix2", "fix3"] as const).map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </Topic>
    </section>
  );
}
