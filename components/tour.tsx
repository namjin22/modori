"use client";

import { useRouter } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";

import { finishTutorial } from "@/app/(tabs)/tutorial-actions";
import { Dori } from "@/components/dori";
import { useT } from "@/components/locale-provider";
import { useSaveFailure } from "@/components/use-save-failure";
import { subscribeNothing } from "@/lib/device-timezone";
import { tutorial } from "@/lib/i18n/messages/tutorial";
import { TIP, TOUR_STEPS, placeTip, type Spot, type TipPlacement, type TourMode, type TourStep } from "@/lib/tutorial";

/** 짚은 곳 둘레에 두는 여백. 둥근 모서리도 이만큼 키운다. */
const PAD = 6;

/** 같은 data-tour가 여러 곳에 있으면(할 일 줄처럼) 눈에 보이는 첫 것을 짚는다. */
function findTarget(name: string): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return element;
  }
  return null;
}

function measureSpot(target: string | null): { spot: Spot; viewport: { width: number; height: number } } {
  const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight };
  const element = target ? findTarget(target) : null;
  if (!element) return { spot: { top: viewport.height / 2, left: viewport.width / 2, width: 0, height: 0, radius: 0 }, viewport };
  const rect = element.getBoundingClientRect();
  // 모서리는 짚은 요소의 것을 따르되, 둥글지 않은 감싸는 칸(관리 메뉴처럼)이면 안의 첫 요소(버튼)의 것을 쓴다.
  const radiusOf = (node: Element | null) => (node ? Number.parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0 : 0);
  const radius = radiusOf(element) || radiusOf(element.firstElementChild);
  return {
    spot: { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, radius: Math.min(radius + PAD, 28) },
    viewport,
  };
}

/**
 * 처음 쓰는 사람용 둘러보기(2026-11-16). 홈 화면 위에 어둡게 덮고, 단계마다 버튼이나 칸 하나만 밝게 뚫어 말풍선으로
 * "이게 무엇이고 어떻게 쓰는지"를 알려 준다. 처음 가입한 뒤 한 번(first), 설정의 "사용법 다시 보기"로 언제든(replay).
 *
 * 화면이 만들어진 뒤에야 짚을 곳을 찾을 수 있어서 브라우저에서만 그린다. 지금 화면에 없는 곳(할 일이 없을 때의 "할 일 줄" 등)은 건너뛴다.
 * 뒤 화면은 누를 수 없고(누르다 길을 잃지 않게), 건너뛰기·끝내기는 모두 "봤다"고 적는다.
 */
export function Tour({ mode }: { mode: TourMode }) {
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);
  // 지금 화면에 짚을 곳이 있는 단계만 센다. 화면이 그려진 뒤에야 찾을 수 있다: 가입 직후처럼 화면을 옮겨 들어올 때는
  // 이 컴포넌트가 새 홈이 붙기 전에 그려져서, 그때 찾으면 하단 탭밖에 없다.
  const [steps, setSteps] = useState<readonly TourStep[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => setSteps(TOUR_STEPS.filter((step) => step.target === null || findTarget(step.target) !== null)));
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  if (!ready) return null;
  // 단계를 찾는 동안(한 프레임)은 어둡게만 덮는다. 뒤 화면이 한 순간 눌리지 않게.
  if (!steps) return <div aria-hidden className="fixed inset-0 z-80 bg-black/60" />;
  return <TourRun mode={mode} steps={steps} />;
}

function TourRun({ mode, steps }: { mode: TourMode; steps: readonly TourStep[] }) {
  const t = useT(tutorial);
  const router = useRouter();
  const saveFailed = useSaveFailure();
  const [, startTransition] = useTransition();
  const [index, setIndex] = useState(0);
  const [closed, setClosed] = useState(false);
  const [view, setView] = useState<ReturnType<typeof measureSpot> | null>(null);
  const [tipHeight, setTipHeight] = useState<number>(TIP.height);
  const primary = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const hasView = view !== null;

  const step = steps[index];
  const last = index === steps.length - 1;
  const intro = step.target === null;

  const measure = useCallback(() => setView(measureSpot(step.target)), [step.target]);

  // 단계가 바뀌면 짚을 곳을 화면 가운데로 올리고 위치를 다시 잰다. 스크롤·창 크기·글꼴이 바뀌어도 따라간다.
  useEffect(() => {
    if (closed) return;
    if (step.target) findTarget(step.target)?.scrollIntoView({ block: "center", inline: "nearest" });
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [closed, step.target, measure]);

  // 말풍선의 실제 높이를 잰다. 글이 길고 폭이 좁으면 높아져서, 고정 값으로는 아래·위에 들어가는지 틀린다.
  useEffect(() => {
    const node = card.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setTipHeight(Math.ceil(node.getBoundingClientRect().height)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasView, closed]);

  // 뒤 화면이 스크롤되어 짚은 곳이 밀려나지 않게 막는다. 단계를 옮길 때의 scrollIntoView는 막혀 있어도 된다.
  useEffect(() => {
    if (closed) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [closed]);

  // 단계가 바뀔 때마다 다음 단추로 포커스를 옮겨, 키보드와 화면 읽기가 새 안내를 따라온다.
  useEffect(() => {
    if (!closed) primary.current?.focus({ preventScroll: true });
  }, [closed, index]);

  const leave = useCallback(() => {
    setClosed(true);
    startTransition(async () => {
      try {
        await finishTutorial();
        // 다시 보기는 주소에 ?tour=1이 붙어 있다. 닫은 뒤에는 떼어서 새로고침해도 다시 뜨지 않게 한다.
        if (mode === "replay") router.replace("/");
      } catch (error) {
        saveFailed(error);
      }
    });
  }, [mode, router, saveFailed]);

  const goTo = useCallback(
    (next: number) => setIndex(Math.max(0, Math.min(next, steps.length - 1))),
    [steps.length],
  );

  useEffect(() => {
    if (closed) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        leave();
      } else if (event.key === "ArrowRight") {
        goTo(index + 1);
      } else if (event.key === "ArrowLeft") {
        goTo(index - 1);
      } else if (event.key === "Tab" && card.current) {
        // 말풍선 안에서만 돈다. 뒤 화면으로 포커스가 빠져나가 가려진 버튼을 누르지 않게 한다.
        const focusable = [...card.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
        const first = focusable[0];
        const lastOne = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (!card.current.contains(active)) {
          event.preventDefault();
          first?.focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          lastOne?.focus();
        } else if (!event.shiftKey && active === lastOne) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closed, index, goTo, leave]);

  if (closed || !view) {
    // 처음 잰 값이 올 때까지(한 프레임) 어둡게만 덮는다. 뒤 화면이 한 순간 눌리지 않게.
    return closed ? null : <div aria-hidden className="fixed inset-0 z-80 bg-black/60" />;
  }

  const { spot, viewport } = view;
  const tip = placeTip(intro ? null : spot, viewport, tipHeight);
  const total = steps.length;

  return (
    <div className="fixed inset-0 z-80 touch-none" data-tour-root>
      {/* 어둡게 덮은 막. 짚은 곳은 이 칸의 그림자가 뚫어 둔 구멍이라 밝게 남는다. 단계를 옮기면 구멍이 미끄러져 간다. */}
      <div
        aria-hidden
        data-tour-spot
        className="pointer-events-none absolute transition-[top,left,width,height,border-radius] duration-300 ease-out motion-reduce:transition-none"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          borderRadius: spot.radius,
          boxShadow: intro ? "0 0 0 100vmax rgb(0 0 0 / 0.62)" : "0 0 0 2px var(--color-brand), 0 0 0 100vmax rgb(0 0 0 / 0.62)",
        }}
      />

      {/* 바깥 칸은 자리만 잡고 넘치는 것을 자르지 않는다(화살표가 칸 밖으로 나와야 해서). 글이 화면보다 길면 안쪽 칸만 스크롤한다. */}
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={t("dialogLabel")}
        aria-describedby="tour-body"
        data-tour-step={step.id}
        data-tour-side={tip.side}
        className="absolute"
        style={{
          left: tip.left,
          width: tip.width,
          ...(tip.side === "middle" ? { top: "50%", transform: "translateY(-50%)" } : {}),
          ...(tip.side === "below" || tip.side === "edge-top" || tip.side === "right" || tip.side === "left" ? { top: tip.offset } : {}),
          ...(tip.side === "above" || tip.side === "edge-bottom" ? { bottom: tip.offset } : {}),
        }}
      >
        {tip.arrow !== null && <Arrow side={tip.side} at={tip.arrow} />}

        <div className="flex max-h-[calc(100dvh-24px)] flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl">
          {intro && (
            <div className="flex justify-center">
              <Dori mood="hello" size={72} />
            </div>
          )}
          <div className={`flex flex-col gap-1.5 ${intro ? "text-center" : ""}`}>
            <h2 className="text-lg font-bold">{t(`${step.id}Title`)}</h2>
            <p id="tour-body" className="text-sm leading-relaxed text-muted">
              {t(`${step.id}Body`)}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-muted" aria-live="polite">
              {t("stepOf", { current: index + 1, total })}
            </span>
            {!last && (
              <button type="button" onClick={leave} className="-mr-2 h-9 rounded-lg px-2.5 text-sm text-muted hover:text-foreground">
                {t("skip")}
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" onClick={() => goTo(index - 1)} className="h-11 rounded-xl bg-surface-hover px-5 text-sm font-semibold">
                {t("back")}
              </button>
            )}
            <button
              ref={primary}
              type="button"
              onClick={() => (last ? leave() : goTo(index + 1))}
              className="h-11 flex-1 rounded-xl bg-brand text-sm font-semibold text-brand-contrast hover:bg-brand-hover"
            >
              {last ? t("finish") : intro ? t("start") : t("next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 짚은 곳을 가리키는 화살표. 45도 돌린 네모의 두 변만 보이게 해서(말풍선 테두리와 이어지게) 가리키는 쪽 모서리를 뾰족하게 만든다. */
function Arrow({ side, at }: { side: TipPlacement["side"]; at: number }) {
  const shown: Record<string, CSSProperties> = {
    below: { left: at - 6, top: -7, borderTopWidth: 1, borderLeftWidth: 1 },
    above: { left: at - 6, bottom: -7, borderBottomWidth: 1, borderRightWidth: 1 },
    right: { top: at - 6, left: -7, borderLeftWidth: 1, borderBottomWidth: 1 },
    left: { top: at - 6, right: -7, borderTopWidth: 1, borderRightWidth: 1 },
  };
  const style = shown[side];
  return style ? <span aria-hidden className="absolute size-3 rotate-45 border-border bg-surface" style={style} /> : null;
}
