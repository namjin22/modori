"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { EventForm } from "@/components/event-form";
import { useLocale, useT } from "@/components/locale-provider";
import { Modal } from "@/components/modal";
import { SortableList } from "@/components/sortable-list";
import { useToast } from "@/components/toast";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";
import { useSaveFailure } from "@/components/use-save-failure";
import { formatKST, parseKSTDate } from "@/lib/date";
import { ddayLabel, isSoonDday } from "@/lib/dday";
import { describeEventWhen, formatTime } from "@/lib/event-time";
import type { Locale } from "@/lib/i18n";
import { formatMonthDay } from "@/lib/i18n/format";
import { common } from "@/lib/i18n/messages/common";
import { events as eventMessages } from "@/lib/i18n/messages/events";
import { LIMITS } from "@/lib/limits";

import { deleteEvent, reorderEvents, restoreEvent } from "@/app/(tabs)/events/actions";
import { includeEventOccurrence, skipEventOccurrence } from "@/app/(tabs)/routines/event-routine-actions";

export type DayEvent = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  // 자정부터 몇 분. 없으면 하루 종일.
  startTime: number | null;
  endTime: number | null;
  color: string;
  // 이름 붙은 색(일정 카테고리)을 골랐으면 그 id. 반복 일정을 펼친 것에는 없다.
  categoryId?: string | null;
  memo: string | null;
  dday: boolean;
  // 팔로워에게 보일지, 메모까지 보일지(2026-10-17). 반복 일정을 펼친 것에는 없다.
  isPublic?: boolean;
  memoPublic?: boolean;
  // 반복 일정(일정 루틴)을 그 날로 펼친 것이면 있다(lib/event-routine.ts). 이 날만 빼기는 되고, 고치기는 루틴 화면에서 한다.
  repeat?: { routineId: string; date: string; rule: string };
};

/**
 * 고른 날의 일정. 할 일과 달리 체크가 없고, 달력에 이름으로 보인다.
 *
 * 만들 때는 "일정" 아래에 입력칸이 바로 열린다. 고칠 때는 날짜까지 손봐야 해서
 * 목록 한가운데가 밀리지 않도록 떠 있는 창에서 한다.
 *
 * 아직 오지 않은 일정도 몇 개 같이 보여준다. 그 날짜를 열어보지 않아도
 * 시험이 며칠 남았는지 알 수 있어야 한다.
 */
export function EventSection({
  events,
  upcoming,
  date,
  today,
}: {
  events: DayEvent[];
  // 아직 오지 않은 일정(보고 있는 날과 겹치는 것은 뺀 것). 제목 옆 토글을 눌러야 펼쳐진다(2026-11-19).
  upcoming: DayEvent[];
  date: string;
  today: string;
}) {
  const t = useT(eventMessages);
  // 일정 만들기는 일정을 고칠 때와 같이 떠 있는 창(팝업)에서 한다(2026-11-19 요청, 예전에는 이 칸 안에 입력 카드가 열렸다).
  const [creating, setCreating] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [editing, setEditing] = useState<DayEvent | null>(null);
  const [repeatOpen, setRepeatOpen] = useState<DayEvent | null>(null);
  // 하루 상한·순서 바꾸기는 그 날에만 있는 일정끼리. 반복 일정은 따로 둔다.
  const single = events.filter((event) => !event.repeat);
  const repeats = events.filter((event) => event.repeat);
  const todayDate = parseKSTDate(today);

  return (
    <section aria-label={t("section")} data-tour="events" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setCreating(true)}
            className="-mx-1.5 -my-1.5 w-fit px-1.5 py-1.5 text-sm font-semibold text-foreground"
          >
            {t("section")}
          </button>
          {/* 다가오는 일정(D-day)은 평소에는 접어 두고 이 작은 토글로 한꺼번에 펼친다(2026-11-19 요청). 없으면 토글도 없다. */}
          {upcoming.length > 0 && (
            <button
              type="button"
              aria-expanded={showUpcoming}
              aria-controls="upcoming-events"
              aria-label={t(showUpcoming ? "upcomingHide" : "upcomingShow", { count: upcoming.length })}
              onClick={() => setShowUpcoming((value) => !value)}
              className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-surface px-2.5 text-xs font-medium text-muted hover:text-foreground"
            >
              <span aria-hidden>{t("upcomingToggle", { count: upcoming.length })}</span>
              <svg
                aria-hidden
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${showUpcoming ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
        </div>
        {/* 일정이 이미 있으면 더 넣는 버튼은 제목 줄 오른쪽에 작게 둔다. 예전에는 카드 아래에 폭 전체를 쓰는 점선 상자였다(2026-10-20). */}
        {single.length > 0 && single.length < LIMITS.eventsPerDay && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            aria-label={t("addMore")}
            className="-my-1 flex h-8 items-center rounded-full px-3 text-xs font-medium text-muted hover:bg-surface hover:text-foreground"
          >
            {t("plusAdd")}
          </button>
        )}
      </div>

      {showUpcoming && upcoming.length > 0 && <UpcomingEvents id="upcoming-events" events={upcoming} date={date} today={today} />}

      {single.length > 0 &&
        (() => {
          const rows = single.map((event) => {
            const card = <EventCard event={event} todayDate={todayDate} onOpen={() => setEditing(event)} />;
            return { id: event.id, label: event.title, node: card };
          });

          // 둘 이상이면 카드를 잡고 끌어(폰은 길게 눌러) 순서를 바꾼다. 하나뿐이면 바꿀 것이 없다.
          return rows.length > 1 ? (
            <SortableList variant="card" gap="gap-2" noun={t("eventLabel")} save={reorderEvents} items={rows} />
          ) : (
            // 순서를 바꿀 것이 없을 때도 같은 카드 모양(components/sortable-list.tsx의 card 줄)으로 둔다.
            <ul className="flex flex-col gap-2">
              {rows.map((row) => (
                <li key={row.id} className="rounded-2xl bg-surface">
                  {row.node}
                </li>
              ))}
            </ul>
          );
        })()}

      {/* 반복 일정(일정 루틴)은 순서를 바꾸지 않고 시각순으로 둔다. 누르면 이 날만 빼거나 루틴 화면으로 간다. */}
      {repeats.length > 0 && (
        <ul aria-label={t("repeatList")} className="flex flex-col gap-2">
          {repeats.map((event) => (
            <li key={event.id} className="rounded-2xl bg-surface">
              <EventCard event={event} todayDate={todayDate} onOpen={() => setRepeatOpen(event)} />
            </li>
          ))}
        </ul>
      )}

      {/* 제목("일정")만 있으면 누를 수 있는 곳인지 모른다. 비어 있을 때는 이 상자, 하나라도 있으면 제목 줄의 "+ 추가"로 더 넣는다. */}
      {single.length === 0 && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-xl border border-dashed border-border py-3 text-sm text-muted hover:bg-surface"
        >
          {t("addPlaceholder")}
        </button>
      )}
      {single.length >= LIMITS.eventsPerDay && (
        <p className="text-center text-xs text-muted">
          {t("perDayLimit", { max: LIMITS.eventsPerDay })}
        </p>
      )}

      {/* 일정 만들기 창. 닫을 때 안의 입력도 사라지게 열려 있을 때만 폼을 그린다. */}
      <Modal open={creating} onClose={() => setCreating(false)} title={t("newEventLabel")}>
        {creating && <EventForm defaultDate={date} onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} />}
      </Modal>

      <EventEditModal event={editing} date={date} onClose={() => setEditing(null)} />

      <RepeatModal event={repeatOpen} onClose={() => setRepeatOpen(null)} />
    </section>
  );
}

/**
 * 아직 오지 않은 일정(D-day). 보고 있는 날이 아니라 오늘을 기준으로 센다. 그 날짜를 열어보지 않아도 시험이 며칠 남았는지 알 수 있어야 한다.
 * 일정 칸의 제목 옆 토글을 누르면 이 목록이 펼쳐진다(2026-11-19 요청, 예전에는 늘 보였고 한때 달력 칸 아래에 있었다).
 * 줄을 누르면 일정을 고치는 창이 뜬다. 보고 있는 날과 겹치는 일정은 홈이 이미 빼고 넘긴다(그 날의 일정 칸에 있다).
 */
function UpcomingEvents({ id, events, date, today }: { id: string; events: DayEvent[]; date: string; today: string }) {
  const t = useT(eventMessages);
  const locale = useLocale();
  const [editing, setEditing] = useState<DayEvent | null>(null);
  const todayDate = parseKSTDate(today);

  return (
    <div id={id} className="flex animate-rise flex-col gap-1 rounded-2xl bg-surface px-3 py-2">
      <ul aria-label={t("upcomingTitle")} className="flex flex-col">
        {events.map((event) => {
          const dday = ddayLabel(event.startDate, event.endDate, todayDate, locale);

          return (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => setEditing(event)}
                className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left text-sm text-muted hover:bg-surface-hover"
              >
                <span aria-hidden className="color-edge size-2 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
                <span className="min-w-0 flex-1 truncate">{event.title}</span>
                <span className="shrink-0 text-xs">
                  {formatMonthDay(locale, event.startDate)}
                  {event.startTime !== null && ` ${formatTime(event.startTime)}`}
                </span>
                {dday && <Dday label={dday} locale={locale} />}
              </button>
            </li>
          );
        })}
      </ul>
      <EventEditModal event={editing} date={date} onClose={() => setEditing(null)} />
    </div>
  );
}

/** 일정을 고치는 떠 있는 창. 그 날의 일정 카드와 "다가오는 일정" 줄이 같이 쓴다(2026-11-19). */
export function EventEditModal({ event, date, onClose }: { event: DayEvent | null; date: string; onClose: () => void }) {
  const t = useT(eventMessages);
  return (
    <Modal open={event !== null} onClose={onClose} title={t("section")}>
      {event && (
        <EventForm
          defaultDate={date}
          event={{
            id: event.id,
            title: event.title,
            startDate: formatKST(event.startDate),
            endDate: formatKST(event.endDate),
            startTime: event.startTime === null ? "" : formatTime(event.startTime),
            endTime: event.endTime === null ? "" : formatTime(event.endTime),
            memo: event.memo ?? "",
            isPublic: event.isPublic ?? false,
            memoPublic: event.memoPublic ?? false,
            dday: event.dday,
            color: event.color,
            categoryId: event.categoryId ?? null,
          }}
          onSaved={onClose}
          onCancel={onClose}
          deleteButton={
            <UndoableDeleteButton
              id={event.id}
              remove={deleteEvent}
              restore={restoreEvent}
              message={t("eventDeleted")}
              onDone={onClose}
              className="-ml-2 h-11 rounded-xl px-2 text-sm font-medium text-danger"
            />
          }
        />
      )}
    </Modal>
  );
}

/** 반복 일정의 그 날 하나. 이 날만 빼기(되돌릴 수 있다), 이름·시간·규칙은 루틴 화면에서 고친다. */
function RepeatModal({ event, onClose }: { event: DayEvent | null; onClose: () => void }) {
  const t = useT(eventMessages);
  const tc = useT(common);
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const saveFailed = useSaveFailure();
  const repeat = event?.repeat;

  function skip() {
    if (!repeat) return;
    startTransition(async () => {
      try {
        const skipped = await skipEventOccurrence({ routineId: repeat.routineId, date: repeat.date });
        onClose();
        if (!skipped) return;
        toast({ message: t("skipDone"), action: { label: tc("undo"), run: () => includeEventOccurrence(skipped) } });
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  return (
    <Modal open={event !== null} onClose={onClose} title={t("repeatTitle")}>
      {event && repeat && (
        <>
          <div className="flex items-start gap-3">
            <span aria-hidden className="color-edge mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
            <div className="min-w-0">
              <p className="font-semibold">{event.title}</p>
              <p className="text-sm text-muted">
                {[`↻ ${repeat.rule}`, describeEventWhen(event, locale)].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={skip}
              className="h-11 rounded-xl border border-border text-sm font-medium disabled:opacity-50"
            >
              {pending ? t("skipping") : t("skipDay")}
            </button>
            <Link
              prefetch={false}
              href="/routines"
              className="flex h-11 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
            >
              {t("editInRoutines")}
            </Link>
          </div>
        </>
      )}
    </Modal>
  );
}

/** 일정 카드 한 장. 바탕은 줄(li)이 깐다. 반복 일정이면 이름 아래에 반복 규칙이 붙는다. */
function EventCard({ event, todayDate, onOpen }: { event: DayEvent; todayDate: Date; onOpen: () => void }) {
  const locale = useLocale();
  const when = describeEventWhen(event, locale);
  // D-day를 끈 일정은 이름과 시간만 보인다. 반복 일정에는 D-day가 없다.
  const dday = event.dday ? ddayLabel(event.startDate, event.endDate, todayDate, locale) : null;
  // 내 색(이름 붙은 색)의 이름은 카드에 적지 않는다(2026-11-26 운영자 요청). 색은 띠로, 이름은 일정을 고치는 창에서만 보인다.
  const detail = [event.repeat ? `↻ ${event.repeat.rule}` : null, when].filter(Boolean).join(" · ");
  return (
    <div className="flex items-stretch">
      {/* 색은 카드 안쪽의 둥근 막대로 보인다. 카드 가장자리에 붙인 띠는 둥근 모서리를 따라 위아래가 가늘어졌다.
          흰색·검정이 바탕에 묻히지 않게 테두리(color-edge)를 두른다. */}
      <span aria-hidden className="color-edge my-3 ml-4 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-3 pl-3 pr-4 text-left">
        {/* 기간을 제목 옆에 두면 좁은 폰(320px)에서 제목이 세 글자만 남는다. 아래 줄로 내린다. */}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{event.title}</span>
          {detail && <span className="text-xs text-muted">{detail}</span>}
          {event.memo && (
            <span className="mt-0.5 line-clamp-3 whitespace-pre-line wrap-break-word text-[13px] text-muted">{event.memo}</span>
          )}
        </span>
        {dday && <Dday label={dday} locale={locale} />}
      </button>
    </div>
  );
}

/** 오늘과 그 앞뒤는 눈에 띄어야 하고, 먼 일정은 조용해야 한다. */
export function Dday({ label, locale }: { label: string; locale: Locale }) {
  const soon = isSoonDday(label, locale);

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        soon ? "bg-brand text-brand-contrast" : "bg-surface-hover text-muted"
      }`}
    >
      {label}
    </span>
  );
}
