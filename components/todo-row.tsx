"use client";

import { useState, useTransition } from "react";

import { deleteTodo, restoreTodo, updateTodo } from "@/app/(tabs)/actions";
import { Modal } from "@/components/modal";
import { ReceivedReactions } from "@/components/received-reactions";
import { SubmitButton } from "@/components/submit-button";
import { TodoCheckbox } from "@/components/todo-checkbox";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";
import { useSaveFailure } from "@/components/use-save-failure";
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
 * 할 일 한 줄. 글자를 누르면 창이 떠서 글자와 메모를 고치거나 지운다.
 * 메모는 글자 밑에 몇 줄만 보여준다. 색은 카테고리를 따라가므로 여기서 고르지 않는다.
 */
export function TodoRow({
  todo,
  received = [],
}: {
  todo: Todo;
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
