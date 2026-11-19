"use client";

import { type FormEvent, useEffect, useOptimistic, useRef, useState, useTransition } from "react";

import { addTodo } from "@/app/(tabs)/actions";
import { addSubGoal, deleteGoal, deleteSubGoal, restoreGoal, setGoalDone } from "@/app/(tabs)/goals/actions";
import { ChoicePicker } from "@/components/choice-picker";
import { DatePicker } from "@/components/date-picker";
import { GoalForm } from "@/components/goal-form";
import { useT } from "@/components/locale-provider";
import { NEW_GOAL_EVENT } from "@/components/manage-menu";
import { Modal } from "@/components/modal";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";
import { useSaveFailure } from "@/components/use-save-failure";
import { dueLabel, GOAL_TITLE_MAX, type GoalView, goalChoices, goalProgress, sortGoals } from "@/lib/goals";
import { goals as goalMessages } from "@/lib/i18n/messages/goals";
import { LIMITS } from "@/lib/limits";

/** 처음에 보이는 목표 카드 수. 넘으면 "더 보기"로 펼친다. */
const VISIBLE = 3;

type Patch = { type: "check"; id: string; done: boolean } | { type: "removeSub"; id: string };

/** 낙관적으로 먼저 그리는 변화: 달성 표시를 켜고 끄기, 세부 목표 지우기. 서버가 돌려준 값이 오면 그것으로 바뀐다. */
function applyPatch(state: GoalView[], patch: Patch): GoalView[] {
  return state.map((goal) => {
    if (patch.type === "check" && goal.id === patch.id) return { ...goal, done: patch.done };
    return {
      ...goal,
      children: goal.children.flatMap((child) => {
        if (child.id !== patch.id) return [child];
        return patch.type === "removeSub" ? [] : [{ ...child, done: patch.done }];
      }),
    };
  });
}

/**
 * 홈 위쪽의 목표 칸(2026-11-19 운영자 결정, docs/decisions.md). 일정 칸처럼 하루 화면 위에 뜬다. 날짜를 넘겨도 그대로다(목표는 날짜가 없다).
 * 카드에는 이름·기한(D-day)·진행(세부 목표 n/m)이 보이고, 누르면 펼쳐져 세부 목표를 바로 체크하고 더한다. 고치기·지우기는 창에서 한다.
 * 처음에는 3개까지만 보이고 나머지는 "더 보기"다.
 */
export function GoalSection({ goals, today }: { goals: GoalView[]; today: string }) {
  const t = useT(goalMessages);
  const sectionRef = useRef<HTMLElement>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GoalView | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [shown, patch] = useOptimistic(goals, applyPatch);

  // 관리 메뉴의 "목표"를 누르면 만들기 칸을 열고 이 칸으로 내린다(components/manage-menu.tsx).
  useEffect(() => {
    function open() {
      setCreating(true);
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.addEventListener(NEW_GOAL_EVENT, open);
    return () => window.removeEventListener(NEW_GOAL_EVENT, open);
  }, []);

  const sorted = sortGoals(shown);
  const visible = showAll ? sorted : sorted.slice(0, VISIBLE);
  const canAdd = goals.length < LIMITS.goals;

  return (
    <section ref={sectionRef} aria-label={t("section")} data-tour="goals" className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-expanded={creating}
          onClick={() => setCreating((value) => !value)}
          className="-mx-1.5 -my-1.5 w-fit px-1.5 py-1.5 text-sm font-semibold text-foreground"
        >
          {t("section")}
        </button>
        {/* 목표가 이미 있으면 더 넣는 버튼은 제목 줄 오른쪽에 작게 둔다(일정 칸과 같다). */}
        {!creating && goals.length > 0 && canAdd && (
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

      {creating && (
        <div className="rounded-2xl bg-surface p-4">
          <GoalForm onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} />
        </div>
      )}

      {visible.length > 0 && (
        <ul className="flex flex-col gap-2">
          {visible.map((goal) => (
            <GoalCard key={goal.id} goal={goal} today={today} patch={patch} onEdit={() => setEditing(goals.find((item) => item.id === goal.id) ?? goal)} />
          ))}
        </ul>
      )}

      {sorted.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          aria-expanded={showAll}
          className="h-9 self-start rounded-full px-3 text-xs font-medium text-muted hover:bg-surface hover:text-foreground"
        >
          {showAll ? t("less") : t("moreCount", { count: sorted.length - VISIBLE })}
        </button>
      )}

      {/* 비어 있을 때만 이 상자. 하나라도 있으면 제목 줄의 "+ 추가"로 더 넣는다. */}
      {!creating && goals.length === 0 && (
        <button type="button" onClick={() => setCreating(true)} className="rounded-xl border border-dashed border-border py-3 text-sm text-muted hover:bg-surface">
          {t("addPlaceholder")}
        </button>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={t("editTitle")}>
        {editing && (
          <GoalForm
            goal={{ id: editing.id, title: editing.title, dueDate: editing.dueDate, isPublic: editing.isPublic }}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
            deleteButton={
              <UndoableDeleteButton
                id={editing.id}
                remove={deleteGoal}
                restore={restoreGoal}
                message={t("goalDeleted")}
                onDone={() => setEditing(null)}
                className="-ml-2 h-11 rounded-xl px-2 text-sm font-medium text-danger"
              />
            }
          />
        )}
      </Modal>
    </section>
  );
}

function GoalCard({ goal, today, patch, onEdit }: { goal: GoalView; today: string; patch: (action: Patch) => void; onEdit: () => void }) {
  const t = useT(goalMessages);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();
  const progress = goalProgress(goal);
  const due = goal.dueDate ? dueLabel(goal.dueDate, today) : null;
  const percent = progress.hasChildren ? Math.round((progress.done / progress.total) * 100) : progress.complete ? 100 : 0;

  function toggleGoal() {
    startTransition(async () => {
      patch({ type: "check", id: goal.id, done: !goal.done });
      try {
        await setGoalDone(goal.id, !goal.done);
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  return (
    <li className="overflow-hidden rounded-2xl bg-surface">
      <div className="flex items-center gap-1 pl-2 pr-1">
        {/* 세부 목표가 없는 목표는 여기서 바로 달성 체크한다. 있는 목표는 세부 목표를 센 값이라 체크 칸이 없다. */}
        {!progress.hasChildren ? (
          <CheckButton checked={goal.done} label={t("check", { title: goal.title })} onClick={toggleGoal} />
        ) : (
          <span aria-hidden className="w-2 shrink-0" />
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-label={t(open ? "collapse" : "expand", { title: goal.title })}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-2 py-3 pl-1 pr-2 text-left"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={`min-w-0 flex-1 truncate font-medium ${progress.complete ? "text-muted line-through" : ""}`}>{goal.title}</span>
            {!goal.isPublic && <LockIcon label={t("privateIcon")} />}
            {progress.complete ? (
              <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-brand-contrast">{t("complete")}</span>
            ) : (
              due && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${due.soon ? "bg-brand text-brand-contrast" : "bg-surface-hover text-muted"}`}
                >
                  {due.text}
                </span>
              )
            )}
            <Chevron open={open} />
          </span>
          {progress.hasChildren && (
            <span className="flex items-center gap-2">
              <span
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
                aria-label={t("progressLabel", { total: progress.total, done: progress.done })}
                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-hover"
              >
                <span className="block h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${percent}%` }} />
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {progress.done}/{progress.total}
              </span>
            </span>
          )}
        </button>
      </div>

      {open && <GoalPanel goal={goal} today={today} patch={patch} onEdit={onEdit} />}
    </li>
  );
}

/** 펼친 카드 안: 세부 목표 체크 목록, 세부 목표 더하기, 고치기. */
function GoalPanel({ goal, today, patch, onEdit }: { goal: GoalView; today: string; patch: (action: Patch) => void; onEdit: () => void }) {
  const t = useT(goalMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const saveFailed = useSaveFailure();
  const full = goal.children.length >= LIMITS.subGoalsPerGoal;
  // "할 일 넣기": 이 목표(또는 고른 세부 목표)로 연결된 할 일을 바로 적는다(2026-11-19).
  const [todoDraft, setTodoDraft] = useState("");
  const [todoDate, setTodoDate] = useState(today);
  const [todoTarget, setTodoTarget] = useState(goal.id);
  const [todoMessage, setTodoMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [todoPending, startTodoTransition] = useTransition();

  function addLinkedTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (todoPending || !todoDraft.trim()) return;
    startTodoTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("content", todoDraft);
        formData.set("date", todoDate);
        formData.set("goalId", goal.children.some((child) => child.id === todoTarget) ? todoTarget : goal.id);
        const result = await addTodo(formData);
        if (result.ok) {
          setTodoDraft("");
          setTodoMessage({ ok: true, text: t("todoAdded") });
        } else {
          setTodoMessage({ ok: false, text: result.message });
        }
      } catch (failure) {
        saveFailed(failure);
      }
    });
  }

  function toggle(id: string, done: boolean) {
    startTransition(async () => {
      patch({ type: "check", id, done });
      try {
        await setGoalDone(id, done);
      } catch (failure) {
        saveFailed(failure);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      patch({ type: "removeSub", id });
      try {
        await deleteSubGoal(id);
      } catch (failure) {
        saveFailed(failure);
      }
    });
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !draft.trim()) return;
    startTransition(async () => {
      try {
        const message = await addSubGoal(goal.id, draft);
        if (message) {
          setError(message);
          return;
        }
        setError(null);
        setDraft("");
      } catch (failure) {
        saveFailed(failure);
      }
    });
  }

  return (
    <div className="flex animate-rise flex-col gap-3 border-t border-border px-4 pb-4 pt-3">
      <p className="text-xs font-semibold text-muted">{t("subGoalsTitle")}</p>

      {goal.children.length === 0 ? (
        <p className="text-sm text-muted">{t("leafHint")}</p>
      ) : (
        <ul className="flex flex-col">
          {goal.children.map((child) => (
            <li key={child.id} className="flex items-center gap-1">
              <CheckButton checked={child.done} label={t("check", { title: child.title })} onClick={() => toggle(child.id, !child.done)} />
              <span className={`min-w-0 flex-1 break-words py-2 text-[15px] ${child.done ? "text-muted line-through" : ""}`}>{child.title}</span>
              {child.linked && child.linked.total > 0 && (
                <span aria-label={t("linkedCount", { done: child.linked.done, total: child.linked.total })} className="shrink-0 text-xs tabular-nums text-muted">
                  {child.linked.done}/{child.linked.total}
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(child.id)}
                aria-label={t("subDelete", { title: child.title })}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-danger"
              >
                <svg aria-hidden width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                  <path d="M6 6l12 12 M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <form onSubmit={add} className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={GOAL_TITLE_MAX}
            placeholder={t("subPlaceholder")}
            aria-label={t("subInputLabel", { title: goal.title })}
            className="h-10 min-w-0 flex-1 rounded-xl bg-surface-hover px-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="h-10 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast disabled:opacity-50"
          >
            {t("subAdd")}
          </button>
        </form>
      )}
      {full && <p className="text-xs text-muted">{t("subTooMany", { max: LIMITS.subGoalsPerGoal })}</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-xs font-semibold text-muted">{t("addTodoTitle")}</p>
        <form onSubmit={addLinkedTodo} className="flex flex-col gap-2">
          <input
            value={todoDraft}
            onChange={(event) => setTodoDraft(event.target.value)}
            maxLength={200}
            placeholder={t("addTodoPlaceholder")}
            aria-label={t("addTodoInputLabel", { title: goal.title })}
            className="h-10 w-full rounded-xl bg-surface-hover px-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
          />
          <div className="flex flex-wrap items-center gap-2">
            {goal.children.length > 0 && (
              <div className="min-w-0 flex-1">
                <ChoicePicker label={t("addTodoTargetLabel", { title: goal.title })} options={goalChoices([goal], "").slice(1)} value={todoTarget} onChange={setTodoTarget} />
              </div>
            )}
            <DatePicker label={t("addTodoDateLabel", { title: goal.title })} value={todoDate} onChange={setTodoDate} short />
            <button
              type="submit"
              disabled={todoPending || !todoDraft.trim()}
              className="ml-auto h-10 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast disabled:opacity-50"
            >
              {t("addTodoButton")}
            </button>
          </div>
        </form>
        {todoMessage && (
          <p role={todoMessage.ok ? "status" : "alert"} className={`text-sm ${todoMessage.ok ? "text-muted" : "text-danger"}`}>
            {todoMessage.text}
          </p>
        )}
        {goal.linked && goal.linked.total > 0 && (
          <p className="text-xs text-muted">{t("linkedCount", { done: goal.linked.done, total: goal.linked.total })}</p>
        )}
      </div>

      <button type="button" onClick={onEdit} className="h-9 self-end rounded-full px-3 text-xs font-medium text-muted hover:bg-surface-hover hover:text-foreground">
        {t("edit")}
      </button>
    </div>
  );
}

/** 달성 체크 칸. 눌리는 곳은 44px에 가깝게 키우고 눈에 보이는 동그라미는 작게 둔다. */
function CheckButton({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onClick} className="flex size-11 shrink-0 items-center justify-center">
      <span
        aria-hidden
        className={`flex size-6 items-center justify-center rounded-full border-2 transition-colors ${checked ? "border-brand bg-brand text-brand-contrast" : "border-border"}`}
      >
        {checked && (
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
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
      className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function LockIcon({ label }: { label: string }) {
  return (
    <svg role="img" aria-label={label} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
      <rect x={5} y={11} width={14} height={9} rx={2} />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
