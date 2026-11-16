"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { finishTutorial } from "@/app/welcome/actions";
import { Dori } from "@/components/dori";
import { useT } from "@/components/locale-provider";
import { useSaveFailure } from "@/components/use-save-failure";
import { TUTORIAL_STEPS } from "@/lib/tutorial";
import { tutorial } from "@/lib/i18n/messages/tutorial";

/**
 * 처음 쓰는 사람용 사용법 카드 몇 장(2026-11-16). 다음·이전·건너뛰기, 마지막 카드의 시작하기가 모두 "봤다"고 적고 나간다.
 * 가입 뒤 처음이면 홈으로, 설정에서 다시 본 것이면 설정으로 돌아간다. 좌우 화살표 키로도 넘긴다.
 */
export function Tutorial({ replay }: { replay: boolean }) {
  const t = useT(tutorial);
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  const step = TUTORIAL_STEPS[index];
  const last = index === TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setIndex((current) => Math.min(current + 1, TUTORIAL_STEPS.length - 1));
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(current - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function leave() {
    if (pending) return;
    startTransition(async () => {
      try {
        await finishTutorial();
        router.replace(replay ? "/settings/preferences" : "/");
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-10 items-center justify-between">
        <span className="text-sm tabular-nums text-muted" aria-live="polite">
          {t("stepOf", { current: index + 1, total: TUTORIAL_STEPS.length })}
        </span>
        {!last && (
          <button type="button" onClick={leave} disabled={pending} className="-mr-2 h-10 rounded-xl px-3 text-sm font-medium text-muted hover:text-foreground disabled:opacity-60">
            {t("skip")}
          </button>
        )}
      </header>

      <section aria-labelledby="tutorial-title" className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
        <Dori key={step.id} mood={step.mood} size={128} />
        <div className="flex flex-col gap-2">
          <h1 id="tutorial-title" className="text-2xl font-bold">
            {t(`${step.id}Title`)}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">{t(`${step.id}Body`)}</p>
        </div>
        <ul className="flex w-full flex-col gap-2 text-left">
          {([1, 2, 3] as const).map((number) => (
            <li key={number} className="rounded-2xl bg-surface px-4 py-3 text-sm leading-relaxed">
              {t(`${step.id}${number}`)}
            </li>
          ))}
        </ul>
        {last && <p className="text-xs leading-relaxed text-muted">{t("replayNote")}</p>}
      </section>

      <nav aria-label={t("progress")} className="flex flex-col gap-5">
        <ol className="flex justify-center gap-2">
          {TUTORIAL_STEPS.map((each, position) => (
            <li key={each.id}>
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={t("stepOf", { current: position + 1, total: TUTORIAL_STEPS.length })}
                aria-current={position === index ? "step" : undefined}
                className="flex size-6 items-center justify-center"
              >
                <span className={`block h-2 rounded-full transition-all ${position === index ? "w-6 bg-brand" : "w-2 bg-border"}`} />
              </button>
            </li>
          ))}
        </ol>
        <div className="flex gap-2">
          {index > 0 && (
            <button type="button" onClick={() => setIndex(index - 1)} className="h-12 rounded-xl bg-surface-hover px-6 text-sm font-semibold">
              {t("back")}
            </button>
          )}
          {last ? (
            <button type="button" onClick={leave} disabled={pending} className="h-12 flex-1 rounded-xl bg-brand text-sm font-semibold text-brand-contrast disabled:opacity-60">
              {replay ? t("close") : t("start")}
            </button>
          ) : (
            <button type="button" onClick={() => setIndex(index + 1)} className="h-12 flex-1 rounded-xl bg-brand text-sm font-semibold text-brand-contrast">
              {t("next")}
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
