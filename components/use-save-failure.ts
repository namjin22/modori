"use client";

import { unstable_rethrow } from "next/navigation";
import { useCallback } from "react";

import { useToast } from "@/components/toast";

export const SAVE_FAILED_MESSAGE = "저장하지 못했어요. 연결을 확인하고 다시 해주세요.";

/**
 * 서버에 보내다 실패했을 때 부른다. 화면은 그대로 두고 아래에 알림만 띄운다.
 *
 * 잡지 않으면 가장 가까운 error.tsx가 화면 전체를 오류 화면으로 바꾼다. 지하철에서
 * 연결이 한 번 끊겼다고 적던 글자까지 사라지면 안 된다.
 *
 * 세션이 끊겨 서버가 redirect("/login")을 하면 그것도 예외로 넘어온다. 그건 삼키지
 * 않고 Next에 돌려줘야 로그인 화면으로 간다.
 */
export function useSaveFailure(): (error: unknown) => void {
  const toast = useToast();
  return useCallback(
    (error: unknown) => {
      unstable_rethrow(error);
      console.error("[save] 서버에 저장하지 못했다.", error);
      toast({ message: SAVE_FAILED_MESSAGE });
    },
    [toast],
  );
}

type FormState = { message: string } | null;

/**
 * useActionState에 넘기는 서버 액션을 감싼다. 연결이 끊겨 실패하면 오류 화면 대신
 * 폼 아래 안내 문구로 알려준다. 폼들이 이미 state.message를 보여주고 있다.
 */
export function orSaveFailure<State extends FormState>(
  action: (previous: State, formData: FormData) => Promise<State>,
): (previous: State, formData: FormData) => Promise<State> {
  return async (previous, formData) => {
    try {
      return await action(previous, formData);
    } catch (error) {
      unstable_rethrow(error);
      console.error("[save] 서버에 저장하지 못했다.", error);
      return { message: SAVE_FAILED_MESSAGE } as State;
    }
  };
}
