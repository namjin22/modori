"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { EventForm } from "@/components/event-form";
import { Modal } from "@/components/modal";
import { SortableList } from "@/components/sortable-list";
import { useToast } from "@/components/toast";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";
import { useSaveFailure } from "@/components/use-save-failure";
import { useBlurOutside } from "@/components/use-blur-outside";
import { formatKST, formatMonthDayKST, parseKSTDate } from "@/lib/date";
import { ddayLabel } from "@/lib/dday";
import { describeEventWhen, formatTime } from "@/lib/event-time";
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
  upcoming: DayEvent[];
  date: string;
  today: string;
}) {
  const [creating, setCreating] = useState(false);
  const blurOutside = useBlurOutside((container) => {
    const title = container.querySelector<HTMLInputElement>('input[name="title"]');
    if (title && title.value.trim() === "") setCreating(false);
  });
  const [editing, setEditing] = useState<DayEvent | null>(null);
  const [repeatOpen, setRepeatOpen] = useState<DayEvent | null>(null);
  // 하루 상한·순서 바꾸기는 그 날에만 있는 일정끼리. 반복 일정은 따로 둔다.
  const single = events.filter((event) => !event.repeat);
  const repeats = events.filter((event) => event.repeat);
  const todayDate = parseKSTDate(today);

  return (
    <section aria-label="일정" className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={creating}
        onClick={() => setCreating((value) => !value)}
        // 열린 채로 다시 누르면 입력칸이 먼저 포커스를 잃어 닫혔다가 클릭으로 다시 열린다.
        onMouseDown={(event) => {
          if (creating) event.preventDefault();
        }}
        className="-mx-1.5 -my-1.5 w-fit px-1.5 py-1.5 text-sm font-semibold text-foreground"
      >
        일정
      </button>

      {creating && (
        <div
          // 이름을 비운 채 다른 곳을 누르면 닫는다. 날짜 칸으로 옮겨 가는 것은 이 안이라 그대로 둔다(Safari 대응은 use-blur-outside).
          {...blurOutside}
          className="rounded-2xl bg-surface p-4"
        >
          <EventForm
            defaultDate={date}
            onSaved={() => setCreating(false)}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {single.length > 0 &&
        (() => {
          const rows = single.map((event) => {
            const card = <EventCard event={event} todayDate={todayDate} onOpen={() => setEditing(event)} />;
            return { id: event.id, label: event.title, node: card };
          });

          // 둘 이상이면 카드를 잡고 끌어(폰은 길게 눌러) 순서를 바꾼다. 하나뿐이면 바꿀 것이 없다.
          return rows.length > 1 ? (
            <SortableList variant="card" gap="gap-2" noun="일정" save={reorderEvents} items={rows} />
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
        <ul aria-label="반복 일정" className="flex flex-col gap-2">
          {repeats.map((event) => (
            <li key={event.id} className="rounded-2xl bg-surface">
              <EventCard event={event} todayDate={todayDate} onOpen={() => setRepeatOpen(event)} />
            </li>
          ))}
        </ul>
      )}

      {/* 제목("일정")만 있으면 누를 수 있는 곳인지 모른다. 예전에는 비어 있을 때만 이 버튼이 있어서
          하나를 만들면 더 넣을 길이 안 보였다. 하루 상한까지는 늘 둔다. */}
      {!creating &&
        (single.length < LIMITS.eventsPerDay ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-xl border border-dashed border-border py-3 text-sm text-muted hover:bg-surface"
          >
            {single.length === 0 ? "시험이나 행사 적어두기" : "+ 일정 더 적기"}
          </button>
        ) : (
          <p className="text-center text-xs text-muted">
            일정은 하루에 {LIMITS.eventsPerDay}개까지 둘 수 있어요
          </p>
        ))}

      {upcoming.length > 0 && (
        <ul className="flex flex-col gap-1">
          {upcoming.map((event) => {
            const dday = ddayLabel(event.startDate, event.endDate, todayDate);

            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => setEditing(event)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-1 py-1.5 text-left text-sm text-muted hover:bg-surface"
                >
                  <span
                    aria-hidden
                    className="color-edge size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: event.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  <span className="shrink-0 text-xs">
                    {formatMonthDayKST(event.startDate)}
                    {event.startTime !== null && ` ${formatTime(event.startTime)}`}
                  </span>
                  {dday && <Dday label={dday} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="일정"
      >
        {editing && (
          <>
            <EventForm
              defaultDate={date}
              event={{
                id: editing.id,
                title: editing.title,
                startDate: formatKST(editing.startDate),
                endDate: formatKST(editing.endDate),
                startTime: editing.startTime === null ? "" : formatTime(editing.startTime),
                endTime: editing.endTime === null ? "" : formatTime(editing.endTime),
                memo: editing.memo ?? "",
                isPublic: editing.isPublic ?? false,
                memoPublic: editing.memoPublic ?? false,
                dday: editing.dday,
                color: editing.color,
              }}
              onSaved={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
            <div className="flex justify-end">
              <UndoableDeleteButton
                id={editing.id}
                remove={deleteEvent}
                restore={restoreEvent}
                message="일정을 지웠어요"
                onDone={() => setEditing(null)}
                className="h-10 rounded-xl px-3 text-sm font-medium text-danger"
              />
            </div>
          </>
        )}
      </Modal>

      <RepeatModal event={repeatOpen} onClose={() => setRepeatOpen(null)} />
    </section>
  );
}

/** 반복 일정의 그 날 하나. 이 날만 빼기(되돌릴 수 있다), 이름·시간·규칙은 루틴 화면에서 고친다. */
function RepeatModal({ event, onClose }: { event: DayEvent | null; onClose: () => void }) {
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
        toast({ message: "이 날만 반복 일정을 뺐어요", action: { label: "되돌리기", run: () => includeEventOccurrence(skipped) } });
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  return (
    <Modal open={event !== null} onClose={onClose} title="반복 일정">
      {event && repeat && (
        <>
          <div className="flex items-start gap-3">
            <span aria-hidden className="color-edge mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
            <div className="min-w-0">
              <p className="font-semibold">{event.title}</p>
              <p className="text-sm text-muted">
                {[`↻ ${repeat.rule}`, describeEventWhen(event)].filter(Boolean).join(" · ")}
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
              {pending ? "빼는 중" : "이 날만 빼기"}
            </button>
            <Link
              prefetch={false}
              href="/routines"
              className="flex h-11 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
            >
              루틴에서 고치기
            </Link>
          </div>
        </>
      )}
    </Modal>
  );
}

/** 일정 카드 한 장. 바탕은 줄(li)이 깐다. 반복 일정이면 이름 아래에 반복 규칙이 붙는다. */
function EventCard({ event, todayDate, onOpen }: { event: DayEvent; todayDate: Date; onOpen: () => void }) {
  const when = describeEventWhen(event);
  // D-day를 끈 일정은 이름과 시간만 보인다. 반복 일정에는 D-day가 없다.
  const dday = event.dday ? ddayLabel(event.startDate, event.endDate, todayDate) : null;
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
        {dday && <Dday label={dday} />}
      </button>
    </div>
  );
}

/** 오늘과 그 앞뒤는 눈에 띄어야 하고, 먼 일정은 조용해야 한다. */
function Dday({ label }: { label: string }) {
  const soon = label === "D-DAY" || label === "진행 중";

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
