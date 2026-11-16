import { ai } from "@/lib/i18n/messages/ai";
import { getT } from "@/lib/i18n/server";

const card = "flex flex-col gap-3 rounded-2xl bg-surface p-5";
const heading = "text-sm font-semibold text-muted";
const list = "flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed";

/** AI 연결 화면 위쪽의 설명(2026-11-16 요청: 더 자세히). 무엇을 시킬 수 있고 무엇은 못 하는지, 한도가 무엇인지. 토큰을 만들기 전에 읽는 글이다. */
export async function AiGuide() {
  const t = await getT(ai);
  return (
    <>
      <section className={card}>
        <h2 className={heading}>{t("examplesTitle")}</h2>
        <ul className="flex flex-col gap-2">
          {(["example1", "example2", "example3"] as const).map((key) => (
            <li key={key} className="rounded-xl bg-surface-hover px-4 py-3 text-sm leading-relaxed">
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <h2 className={heading}>{t("canTitle")}</h2>
        <ul className={list}>
          {(["can1", "can2", "can3", "can4"] as const).map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-muted">{t("canNote")}</p>
      </section>

      <section className={card}>
        <h2 className={heading}>{t("cannotTitle")}</h2>
        <ul className={list}>
          {(["cannot1", "cannot2", "cannot3"] as const).map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <h2 className={heading}>{t("limitsTitle")}</h2>
        <p className="text-sm leading-relaxed">{t("limitsBody")}</p>
      </section>
    </>
  );
}

/** 토큰 목록·만들기 아래에 두는 "연결이 안 될 때". */
export async function AiTroubleshoot() {
  const t = await getT(ai);
  return (
    <section className={card}>
      <h2 className={heading}>{t("fixTitle")}</h2>
      <ul className={list}>
        {(["fix1", "fix2", "fix3"] as const).map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
    </section>
  );
}
