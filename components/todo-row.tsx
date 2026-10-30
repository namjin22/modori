"use client";

import { useState, useTransition } from "react";

import { deleteTodo, moveTodo, repeatTodo, restoreTodo, updateTodo } from "@/app/(tabs)/actions";
import { ChoicePicker } from "@/components/choice-picker";
import { DatePicker } from "@/components/date-picker";
import { useT } from "@/components/locale-provider";
import { MemoPrivateToggle } from "@/components/memo-private-toggle";
import { Modal } from "@/components/modal";
import { ReceivedReactions } from "@/components/received-reactions";
import { SubmitButton } from "@/components/submit-button";
import { TodoCheckbox } from "@/components/todo-checkbox";
import { PENDING_PREFIX, useTodoStore } from "@/components/todo-store";
import { useToast } from "@/components/toast";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";
import { useSaveFailure } from "@/components/use-save-failure";
import { addDays, formatKST, parseKSTDate } from "@/lib/date";
import { MAX_MEMO_LENGTH } from "@/lib/memo";
import { common } from "@/lib/i18n/messages/common";
import { todos as todoMessages } from "@/lib/i18n/messages/todos";
import type { ReceivedReaction } from "@/lib/reactions";

type Todo = {
  id: string;
  content: string;
  done: boolean;
  color: string | null;
  memo: string | null;
  memoPublic?: boolean;
  category: { id?: string; name: string; color: string } | null;
};

type CategoryOption = { id: string; name: string; color: string };

/**
 * 할 일 한 줄. 글자를 누르면 창이 떠서 글자와 메모를 고치고, 다른 날로 옮기거나 지운다.
 * 메모는 글자 밑에 몇 줄만 보여준다. 색은 카테고리를 따라가므로 여기서 고르지 않는다.
 */
export function TodoRow({
  todo,
  date,
  quickMove,
  received = [],
  saving = false,
  categories,
}: {
  todo: Todo;
  // 이 할 일의 날짜("YYYY-MM-DD"). "다른 날에 하기"의 처음 값(다음 날)을 여기서 정한다.
  date: string;
  // 한 번에 옮기는 버튼. 오늘 할 일은 내일로(tomorrow), 오늘이 아닌 날(지난 날·앞날)의 할 일은 오늘로(today) 옮긴다(components/home-view.tsx가 정한다).
  quickMove: { kind: "today" | "tomorrow"; target: string };
  // 친구들이 이 할 일에 보낸 반응. 종류별로 묶여 온다.
  received?: ReceivedReaction[];
  // 방금 적어 서버가 아직 모르는 할 일. 저장이 끝날 때까지(잠깐) 누를 수 없다.
  saving?: boolean;
  // 옮길 수 있는 카테고리(보관하지 않은 것). 주면 창에서 카테고리를 고를 수 있다. 폰에서는 끌어 옮기기가 어려워 이 길을 둔다.
  categories?: CategoryOption[];
}) {
  const t = useT(todoMessages);
  const tc = useT(common);
  const [open, setOpen] = useState(false);
  // 저장에 실패한 고친 글자. 다시 연 창에 그대로 채운다.
  const [draft, setDraft] = useState<{ content: string; memo: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const saveFailed = useSaveFailure();
  const store = useTodoStore();

  return (
    // 방금 적은 할 일은 살짝 떠오르며 들어온다(저장이 끝나 진짜 줄로 바뀔 때는 움직이지 않는다).
    <div className={`py-2.5 ${saving ? "pointer-events-none animate-rise opacity-60" : ""}`} aria-busy={saving || undefined}>
      {/* 메모가 있으면 줄이 길어진다. 체크는 가운데가 아니라 할 일 글자 줄에 맞춘다. */}
      <div className="flex items-start gap-3">
        <div className="mt-px">
          <TodoCheckbox id={todo.id} done={todo.done} color={todo.color ?? todo.category?.color} />
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 flex-col text-left"
        >
          <span className={`truncate transition-colors ${todo.done ? "text-muted line-through" : ""}`}>
            {todo.content}
          </span>
          {todo.memo && (
            <span className="line-clamp-3 whitespace-pre-line wrap-break-word text-[13px] text-muted">
              {todo.memo}
            </span>
          )}
        </button>

        {/* 친구가 보낸 반응(줄 오른쪽 끝에 겹친 그림과 개수). 반응이 많아도 줄이 길어지지 않는다. 누르면 누가 보냈는지 보인다. */}
        <ReceivedReactions received={received} />
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t("modalTitle")}>
        <form
          // 실패하면 창을 열어 둔 채 고친 글자를 남긴다. form action은 실패해도
          // 입력칸을 처음 값으로 되돌려서 onSubmit으로 보낸다.
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const edited = { content: String(formData.get("content") ?? ""), memo: String(formData.get("memo") ?? "") };
            // 한 달치를 받아 둔 홈에서는 고친 글자를 먼저 보여 주고 창을 바로 닫는다(전환 밖에서 닫아야 응답을 기다리지 않는다).
            // 실패하면 고친 글자를 담은 채 창을 다시 연다.
            if (store) setOpen(false);
            startTransition(async () => {
              if (store) {
                const memo = edited.memo.trim();
                const category = categories?.find((option) => option.id === formData.get("categoryId"));
                const moved = category && category.id !== todo.category?.id;
                store({
                  type: "patch",
                  id: todo.id,
                  patch: {
                    content: edited.content.trim(),
                    memo: memo || null,
                    memoPublic: formData.get("memoPrivate") !== "on",
                    ...(moved && { category, color: null }),
                  },
                });
              }
              try {
                await updateTodo(formData);
                setDraft(null);
                // 홈에서는 이미 닫았다. 그사이 다시 열어 고치는 중일 수 있어 또 닫지 않는다.
                if (!store) setOpen(false);
              } catch (error) {
                setDraft(edited);
                setOpen(true);
                saveFailed(error);
              }
            });
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="id" value={todo.id} />
          {/* 할 일 칸에서 Enter를 누르면 예전처럼 바로 저장된다. 메모 칸의 Enter는 줄바꿈이다. */}
          <input
            name="content"
            defaultValue={draft?.content ?? todo.content}
            maxLength={200}
            required
            autoFocus
            data-autofocus
            aria-label={t("editLabel")}
            className="h-12 w-full rounded-xl bg-surface-hover px-4 text-[15px] outline-none focus:ring-2 focus:ring-brand"
          />
          {categories && todo.category?.id && categories.some((option) => option.id === todo.category?.id) && (
            <div className="flex items-center gap-3 text-sm">
              <span className="shrink-0 text-muted">{t("categoryLabel")}</span>
              <div className="min-w-0 flex-1">
                <ChoicePicker
                  label={t("categoryPicker")}
                  name="categoryId"
                  defaultValue={todo.category.id}
                  options={categories.map((option) => ({ value: option.id, label: option.name, color: option.color }))}
                />
              </div>
            </div>
          )}
          {/* 날짜 옮기기는 자주 누르므로 메모·삭제·저장보다 위에 둔다(사용자 요청). */}
          <MoveToDay
            id={todo.id}
            date={date}
            quickMove={quickMove}
            done={todo.done}
            todo={todo}
            onMoved={() => setOpen(false)}
          />
          <textarea
            name="memo"
            defaultValue={draft?.memo ?? todo.memo ?? ""}
            maxLength={MAX_MEMO_LENGTH}
            rows={3}
            placeholder={t("memoPlaceholder")}
            aria-label={t("memoLabel")}
            className="w-full resize-none rounded-xl bg-surface-hover px-4 py-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
          />
          {/* 메모를 친구에게 숨길지(기본은 보인다, 2026-10-18). 할 일 자체는 카테고리 공개 여부를 따른다. 표시 칸은 이 스위치가 있는 화면이라는 표시다. */}
          <input type="hidden" name="memoPublicField" value="1" />
          <MemoPrivateToggle defaultChecked={!(todo.memoPublic ?? true)} />
          {/* 손잡이가 없어 순서를 바꾸는 법이 안 보인다. 폰은 길게 눌러, 컴퓨터는 줄을 잡고 끈다. */}
          <p className="hidden text-xs text-muted pointer-coarse:block">{t("hintTouch")}</p>
          <p className="hidden text-xs text-muted pointer-fine:block">{t("hintMouse")}</p>
          <div className="flex items-center justify-between gap-2">
            <UndoableDeleteButton
              id={todo.id}
              remove={(id) => {
                // 홈에서는 누르는 즉시 목록에서 뺀다(서버 응답 전).
                store?.({ type: "remove", id });
                return deleteTodo(id);
              }}
              restore={restoreTodo}
              message={t("deleted")}
              onDone={() => setOpen(false)}
              className="h-10 rounded-xl px-3 text-sm font-medium text-danger"
            />
            <SubmitButton
              // 홈에서는 저장이 뒤에서 돌아 창이 이미 닫혀 있다. 이어서 다시 열어 고칠 때 버튼을 막지 않는다.
              pending={!store && pending}
              pendingLabel={tc("saving")}
              className="h-10 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-contrast"
            >
              {tc("save")}
            </SubmitButton>
          </div>
        </form>

      </Modal>
    </div>
  );
}

/**
 * 할 일을 다음 날이나 고른 날로 옮긴다. 할 일 폼 안에 들어가므로(폼 안에 폼을 둘 수 없다) 버튼으로 보낸다.
 * 날짜는 달력 창에서 고르고(components/date-picker.tsx), "옮기기"를 눌러야 옮겨진다.
 */
/**
 * 안 끝낸 할 일은 다른 날로 "옮기고", 이미 끝낸 할 일은 끝낸 기록을 그 날에 두고 다른 날에 "또 하기"(베끼기)를 더한다.
 * 끝낸 일을 옮겨 버리면 그날 한 일의 기록이 사라진다.
 */
function MoveToDay({
  id,
  date,
  quickMove,
  done,
  todo,
  onMoved,
}: {
  id: string;
  date: string;
  quickMove: { kind: "today" | "tomorrow"; target: string };
  done: boolean;
  todo: Todo;
  onMoved: () => void;
}) {
  const t = useT(todoMessages);
  const nextDay = formatKST(addDays(parseKSTDate(date), 1));
  const [picking, setPicking] = useState(false);
  const [day, setDay] = useState(nextDay);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const saveFailed = useSaveFailure();
  const store = useTodoStore();

  function move(target: string) {
    setMessage(null);
    // 같은 날은 서버에 묻지 않아도 안다(먼저 옮겨 보이면 줄이 사라졌다 돌아온다). 서버도 같은 이유로 거절한다.
    if (target === date) {
      setMessage(done ? t("sameDayAgain") : t("sameDayMove"));
      return;
    }
    startTransition(async () => {
      // 홈에서는 누르는 즉시 그 날로 옮겨(또 하기는 그 날에 더해) 보여 준다. 거절 이유는 알림으로 띄운다.
      if (done) {
        store?.({
          type: "add",
          todo: {
            id: `${PENDING_PREFIX}${crypto.randomUUID()}`,
            date: target,
            content: todo.content,
            done: false,
            color: todo.color,
            memo: todo.memo,
            doneAt: null,
            category: todo.category?.id ? { id: todo.category.id, name: todo.category.name, color: todo.category.color } : null,
            received: [],
          },
        });
      } else {
        store?.({ type: "patch", id, patch: { date: target } });
      }
      try {
        const result = await (done ? repeatTodo(id, target) : moveTodo(id, target));
        if (!result.ok) {
          if (store) toast({ message: result.message });
          else setMessage(result.message);
          return;
        }
        onMoved();
        toast({ message: result.message });
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  const button = "h-10 flex-1 rounded-xl border border-border text-sm font-medium disabled:opacity-50";
  const quickLabel =
    quickMove.kind === "today" ? t(done ? "moveTodayAgain" : "moveToday") : t(done ? "moveTomorrowAgain" : "moveTomorrow");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => move(quickMove.target)} className={button}>
          {quickLabel}
        </button>
        <button
          type="button"
          aria-expanded={picking}
          onClick={() => setPicking((value) => !value)}
          className={`${button} ${picking ? "border-brand text-brand" : ""}`}
        >
          {done ? t("moveOtherAgain") : t("moveOther")}
        </button>
      </div>

      {picking && (
        <div className="flex animate-rise flex-col gap-2 rounded-xl border border-border p-3">
          <p className="text-xs text-muted">{done ? t("whichDayAgain") : t("whichDayMove")}</p>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <DatePicker label={done ? t("againDate") : t("moveDate")} value={day} onChange={setDay} compact />
            </div>
            <button
              type="button"
              disabled={pending || !day}
              onClick={() => move(day)}
              className="h-10 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast disabled:opacity-50"
            >
              {pending ? (done ? t("writing") : t("moving")) : done ? t("doAgain") : t("doMove")}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
