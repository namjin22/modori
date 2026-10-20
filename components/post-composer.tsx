"use client";

import { useEffect, useRef, useState } from "react";

import { createPost, type PostFormState } from "@/app/(tabs)/feed/public/actions";
import { PostPhotoField } from "@/components/post-photo-field";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/components/use-form-action";
import { MAX_POST_BODY } from "@/lib/public-feed-limits";

type DoneTodo = { id: string; content: string; color: string | null };

/**
 * 공개 피드에 올리기: 오늘 끝낸 할 일 하나를 고르고 짧은 글과 사진 한 장(2026-10-20)을 붙인다.
 * 모르는 사람도 보는 곳이라 올리기 전에 그렇다고 알리고, 사진에는 얼굴·개인정보를 올리지 말라고 적는다.
 */
export function PostComposer({ todos }: { todos: DoneTodo[] }) {
  const [state, action, pending] = useFormAction<PostFormState>(createPost, null);
  const [picked, setPicked] = useState(todos[0]?.id ?? "");
  const [length, setLength] = useState(0);
  const [photo, setPhoto] = useState("");
  const form = useRef<HTMLFormElement>(null);

  // 올리면 글 칸을 비운다.
  useEffect(() => {
    if (!state?.ok || !form.current) return;
    form.current.reset();
    setLength(0);
    setPhoto("");
  }, [state]);

  if (todos.length === 0) {
    return (
      <p className="rounded-2xl bg-surface p-4 text-sm text-muted">
        오늘 할 일을 하나 끝내면 여기서 피드에 올릴 수 있어요.
      </p>
    );
  }

  return (
    <form ref={form} onSubmit={action} aria-label="피드에 올리기" className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs text-muted">오늘 끝낸 일</legend>
        <div role="radiogroup" aria-label="올릴 할 일" className="flex flex-wrap gap-1.5">
          {todos.map((todo) => (
            <button
              key={todo.id}
              type="button"
              role="radio"
              aria-checked={picked === todo.id}
              onClick={() => setPicked(todo.id)}
              className={`flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                picked === todo.id ? "bg-brand-subtle font-semibold text-brand ring-1 ring-brand/40" : "bg-surface-hover text-muted"
              }`}
            >
              <span aria-hidden className="color-edge size-2.5 shrink-0 rounded-full" style={{ backgroundColor: todo.color ?? "var(--color-brand)" }} />
              <span className="truncate">{todo.content}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <input type="hidden" name="todoId" value={picked} />
      <textarea
        name="body"
        rows={3}
        maxLength={MAX_POST_BODY}
        onChange={(event) => setLength(event.target.value.length)}
        placeholder="한마디 남겨 보세요 (없어도 돼요)"
        aria-label="피드 글"
        className="w-full resize-none rounded-xl bg-surface-hover px-4 py-3 text-[15px] outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
      />
      <PostPhotoField photo={photo} onChange={setPhoto} />
      {photo && <p className="text-xs text-muted">사진에 얼굴이나 개인정보가 보이지 않게 해 주세요. 사진 속 위치 정보는 지우고 올려요.</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          모도리 사용자 누구나 볼 수 있어요 · {length}/{MAX_POST_BODY}
        </p>
        <SubmitButton pending={pending} pendingLabel="올리는 중" className="h-10 shrink-0 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-contrast">
          올리기
        </SubmitButton>
      </div>
      {state && (
        <p role="status" className={`text-sm ${state.ok ? "text-brand" : "text-danger"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
