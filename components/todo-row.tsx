"use client";

import { useState, useTransition } from "react";

import { deleteTodo, moveTodo, restoreTodo, updateTodo } from "@/app/(tabs)/actions";
import { DatePicker } from "@/components/date-picker";
import { Modal } from "@/components/modal";
import { ReceivedReactions } from "@/components/received-reactions";
import { SubmitButton } from "@/components/submit-button";
import { TodoCheckbox } from "@/components/todo-checkbox";
import { useToast } from "@/components/toast";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";
import { useSaveFailure } from "@/components/use-save-failure";
import { addDays, formatKST, parseKSTDate } from "@/lib/date";
import { MAX_MEMO_LENGTH } from "@/lib/memo";
import type { ReceivedReaction } from "@/lib/reactions";

type Todo = {
  id: string;
  content: string;
  done: boolean;
  color: string | null;
  memo: string | null;
  category: { name: string; color: string } | null;
};

/**
 * 할 일 한 줄. 글자를 누르면 창이 떠서 글자와 메모를 고치고, 다른 날로 옮기거나 지운다.
 * 메모는 글자 밑에 몇 줄만 보여준다. 색은 카테고리를 따라가므로 여기서 고르지 않는다.
 */
export function TodoRow({
  todo,
  date,
  quickMove,
  received = [],
}: {
  todo: Todo;
  // 이 할 일의 날짜("YYYY-MM-DD"). "다른 날에 하기"의 처음 값(다음 날)을 여기서 정한다.
  date: string;
  // 한 번에 옮기는 버튼. 지난 날 할 일은 "오늘 하기", 오늘 할 일은 "내일 하기", 앞날 할 일은 "다음 날에 하기"(app/(tabs)/page.tsx가 정한다).
  quickMove: { label: string; target: string };
  // 친구들이 이 할 일에 보낸 반응. 종류별로 묶여 온다.
  received?: ReceivedReaction[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  return (
    <div className="py-2.5 pr-3">
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
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="할 일">
        <form
          // 실패하면 창을 열어 둔 채 고친 글자를 남긴다. form action은 실패해도
          // 입력칸을 처음 값으로 되돌려서 onSubmit으로 보낸다.
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              try {
                await updateTodo(formData);
                setOpen(false);
              } catch (error) {
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
            defaultValue={todo.content}
            maxLength={200}
            required
            autoFocus
            data-autofocus
            aria-label="할 일 내용 수정"
            className="h-12 w-full rounded-xl bg-surface-hover px-4 text-[15px] outline-none focus:ring-2 focus:ring-brand"
          />
          {/* 날짜 옮기기는 자주 누르므로 메모·삭제·저장보다 위에 둔다(사용자 요청). */}
          <MoveToDay id={todo.id} date={date} quickMove={quickMove} onMoved={() => setOpen(false)} />
          <textarea
            name="memo"
            defaultValue={todo.memo ?? ""}
            maxLength={MAX_MEMO_LENGTH}
            rows={3}
            placeholder="메모 (나만 봐요)"
            aria-label="할 일 메모"
            className="w-full resize-none rounded-xl bg-surface-hover px-4 py-3 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
          />
          <div className="flex items-center justify-between gap-2">
            <UndoableDeleteButton
              id={todo.id}
              remove={deleteTodo}
              restore={restoreTodo}
              message="할 일을 지웠어요"
              onDone={() => setOpen(false)}
              className="h-10 rounded-xl px-3 text-sm font-medium text-danger"
            />
            <SubmitButton
              pending={pending}
              pendingLabel="저장 중"
              className="h-10 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-contrast"
            >
              저장
            </SubmitButton>
          </div>
        </form>

      </Modal>

      {/* 친구가 보낸 반응(투두메이트처럼). 누르면 누가 보냈는지 보인다. */}
      <ReceivedReactions received={received} />
    </div>
  );
}

/**
 * 할 일을 다음 날이나 고른 날로 옮긴다. 할 일 폼 안에 들어가므로(폼 안에 폼을 둘 수 없다) 버튼으로 보낸다.
 * 날짜는 달력 창에서 고르고(components/date-picker.tsx), "옮기기"를 눌러야 옮겨진다.
 */
function MoveToDay({
  id,
  date,
  quickMove,
  onMoved,
}: {
  id: string;
  date: string;
  quickMove: { label: string; target: string };
  onMoved: () => void;
}) {
  const nextDay = formatKST(addDays(parseKSTDate(date), 1));
  const [picking, setPicking] = useState(false);
  const [day, setDay] = useState(nextDay);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const saveFailed = useSaveFailure();

  function move(target: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await moveTodo(id, target);
        if (!result.ok) {
          setMessage(result.message);
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => move(quickMove.target)} className={button}>
          {quickMove.label}
        </button>
        <button
          type="button"
          aria-expanded={picking}
          onClick={() => setPicking((value) => !value)}
          className={`${button} ${picking ? "border-brand text-brand" : ""}`}
        >
          다른 날에 하기
        </button>
      </div>

      {picking && (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <p className="text-xs text-muted">어느 날로 옮길까요?</p>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <DatePicker label="옮길 날짜" value={day} onChange={setDay} compact />
            </div>
            <button
              type="button"
              disabled={pending || !day}
              onClick={() => move(day)}
              className="h-10 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast disabled:opacity-50"
            >
              {pending ? "옮기는 중" : "옮기기"}
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
