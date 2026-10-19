"use client";

import { useTransition } from "react";

import { deletePost } from "@/app/(tabs)/feed/public/actions";
import { useSaveFailure } from "@/components/use-save-failure";

/** 내 피드 글 지우기. 모르는 사람도 본 글이라 되돌리기 없이 바로 지운다(지운 글이 다시 나타나면 더 곤란하다). */
export function PostDeleteButton({ postId }: { postId: string }) {
  const [pending, startTransition] = useTransition();
  const saveFailed = useSaveFailure();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await deletePost(postId);
          } catch (error) {
            saveFailed(error);
          }
        })
      }
      className="h-8 shrink-0 rounded-lg px-2 text-xs text-muted hover:bg-surface-hover hover:text-danger disabled:opacity-50"
    >
      {pending ? "지우는 중" : "지우기"}
    </button>
  );
}
