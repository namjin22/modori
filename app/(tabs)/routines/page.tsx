import Link from "next/link";

import { CategoryChip } from "@/components/category-chip";
import { EventRoutineEditButton } from "@/components/event-routine-edit-button";
import { RoutineEditButton } from "@/components/routine-edit-button";
import { RoutineForm } from "@/components/routine-form";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";
import { formatKST, todayIn } from "@/lib/date";
import { routines as routineMessages } from "@/lib/i18n/messages/routines";
import { getLocale, getT } from "@/lib/i18n/server";
import { describeEventWhen } from "@/lib/event-time";
import { groupByCategory } from "@/lib/group-by-category";
import { prisma } from "@/lib/prisma";
import { describeRoutineRule } from "@/lib/routine";
import { requireUser } from "@/lib/session";

import {
  deleteRoutine,
  endRoutineToday,
  restoreRoutine,
  toggleRoutinePause,
} from "./actions";
import {
  deleteEventRoutine,
  endEventRoutineToday,
  restoreEventRoutine,
  toggleEventRoutinePause,
} from "./event-routine-actions";
import { BackLink } from "@/components/back-link";
import { DoriMessage } from "@/components/dori-message";

export default async function RoutinesPage() {
  const user = await requireUser();
  const t = await getT(routineMessages);
  const locale = await getLocale();

  const [routines, categories, eventRoutines] = await Promise.all([
    prisma.routine.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
      include: { category: { select: { id: true, name: true, color: true } } },
    }),
    prisma.category.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.eventRoutine.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);

  // 오늘 화면과 같은 방식으로 묶는다. 루틴이 열 개를 넘으면 쭉 나열된 목록은 읽기 힘들다.
  const groups = groupByCategory(routines, categories, { noCategoryLabel: t("noCategory") });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/" label={t("toFeed")} />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </header>

      <p className="text-sm text-muted">
        {t("intro")}
      </p>

      {categories.length === 0 ? (
        // 루틴은 카테고리 안에 묶인다. 카테고리가 없으면 만들어도 갈 곳이 없다.
        <div className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-5">
          <p className="text-sm font-medium">{t("needCategory")}</p>
          <p className="text-sm text-muted">{t("needCategoryBody")}</p>
          <Link prefetch={false}
            href="/categories"
            className="mt-1 flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast"
          >
            {t("createCategory")}
          </Link>
        </div>
      ) : (
      /* 일정과 같은 방식으로 맞춘다. 한 줄짜리 제목에 큰 동그라미와 넓은 카드를
         두면 아래 목록보다 무거워 보인다. */
      <details className="group">
        {/* 제목과 같은 글씨면 누를 수 있는 줄 모른다. 브랜드 색과 펼침 표시를 단다. */}
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-sm font-semibold text-brand [&::-webkit-details-marker]:hidden">
          {t("create")}
          <svg
            aria-hidden
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform group-open:rotate-180"
          >
            <path d="M6 9 L12 15 L18 9" />
          </svg>
        </summary>
        <div className="mt-3 rounded-2xl bg-surface p-4">
          <RoutineForm categories={categories} today={formatKST(todayIn(user.timezone))} />
        </div>
      </details>
      )}

      {eventRoutines.length > 0 && (
        <section aria-label={t("repeatSection")} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("repeatSection")}</h2>
          <ul className="flex flex-col gap-3">
            {eventRoutines.map((routine) => {
              const time = describeEventWhen({ ...routine, endDate: routine.startDate }, locale);
              return (
                <li key={routine.id} className="rounded-2xl bg-surface p-4">
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="color-edge size-2.5 shrink-0 rounded-full" style={{ backgroundColor: routine.color }} />
                    <span className="flex-1 truncate font-medium">{routine.title}</span>
                    {routine.pausedAt && <span className="text-xs text-muted">{t("paused")}</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {describeRoutineRule(routine, locale)}
                    {time && ` · ${time}`}
                    {routine.endDate && ` · ${t("until", { date: formatKST(routine.endDate) })}`}
                  </p>
                  <div className="-mx-2 mt-1 flex flex-wrap">
                    <EventRoutineEditButton routine={routine} />
                    <form action={toggleEventRoutinePause}>
                      <input type="hidden" name="id" value={routine.id} />
                      <input type="hidden" name="paused" value={String(!routine.pausedAt)} />
                      <button type="submit" className="h-8 rounded-lg px-2 text-xs text-muted hover:bg-surface-hover">
                        {routine.pausedAt ? t("resume") : t("pause")}
                      </button>
                    </form>
                    {!routine.endDate && (
                      <form action={endEventRoutineToday}>
                        <input type="hidden" name="id" value={routine.id} />
                        <button type="submit" className="h-8 rounded-lg px-2 text-xs text-muted hover:bg-surface-hover">
                          {t("endToday")}
                        </button>
                      </form>
                    )}
                    <UndoableDeleteButton
                      id={routine.id}
                      remove={deleteEventRoutine}
                      restore={restoreEventRoutine}
                      message={t("repeatDeleted")}
                      className="h-8 rounded-lg px-2 text-xs text-danger hover:bg-surface-hover"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {routines.length === 0 ? (
        eventRoutines.length === 0 && (
        <DoriMessage mood="happy">
          <p>{t("noRoutines")}</p>
        </DoriMessage>
        )
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <CategoryChip name={group.name} color={group.color} />
              <span className="text-xs text-muted">{t("countItems", { count: group.items.length })}</span>
            </div>

            <ul className="flex flex-col gap-3">
              {group.items.map((routine) => (
                <li key={routine.id} className="rounded-2xl bg-surface p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate font-medium">
                      {routine.content}
                    </span>
                    {routine.pausedAt ? (
                      <span className="text-xs text-muted">
                        {routine.categoryId ? t("paused") : t("categoryGonePaused")}
                      </span>
                    ) : (
                      group.archived && (
                        <span className="text-xs text-muted">{t("categoryArchived")}</span>
                      )
                    )}
                  </div>

                  <p className="mt-1 text-xs text-muted">
                    {describeRoutineRule(routine, locale)}
                    {routine.endDate && ` · ${t("until", { date: formatKST(routine.endDate) })}`}
                  </p>

                  <div className="-mx-2 mt-1 flex flex-wrap">
                    {categories.length > 0 && <RoutineEditButton routine={routine} categories={categories} />}
                    {/* 카테고리가 지워진 루틴은 다시 시작할 수 없다. 지우거나 그대로 둔다. */}
                    {(routine.categoryId || !routine.pausedAt) && (
                      <form action={toggleRoutinePause}>
                        <input type="hidden" name="id" value={routine.id} />
                        <input type="hidden" name="paused" value={String(!routine.pausedAt)} />
                        <button type="submit" className="h-8 rounded-lg px-2 text-xs text-muted hover:bg-surface-hover">
                          {routine.pausedAt ? t("resume") : t("pause")}
                        </button>
                      </form>
                    )}

                    {!routine.endDate && (
                      <form action={endRoutineToday}>
                        <input type="hidden" name="id" value={routine.id} />
                        <button type="submit" className="h-8 rounded-lg px-2 text-xs text-muted hover:bg-surface-hover">
                          {t("endToday")}
                        </button>
                      </form>
                    )}

                    {/* 이미 만들어진 할 일은 남는다. 되돌리면 그 할 일들에 다시 이어진다. */}
                    <UndoableDeleteButton
                      id={routine.id}
                      remove={deleteRoutine}
                      restore={restoreRoutine}
                      message={t("routineDeleted")}
                      className="h-8 rounded-lg px-2 text-xs text-danger hover:bg-surface-hover"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
