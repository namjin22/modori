"use client";

import { unstable_rethrow } from "next/navigation";
import { useCallback } from "react";

import { useToast } from "@/components/toast";

export const OFFLINE_MESSAGE = "인터넷에 연결되어 있지 않아요. 연결된 뒤 다시 해주세요.";
// 연결은 되는데 서버 액션이 실패하는 가장 흔한 까닭: 화면을 오래 열어 두는 사이 앱이 새 버전으로 바뀌었거나 로그인이 만료됐다.
// "인터넷을 확인하라"고 하면 사용자가 엉뚱한 곳을 살핀다.
export const STALE_MESSAGE = "화면이 오래돼서 저장하지 못했어요. 새로고침하면 해결돼요.";

/** 화면이 오래됐다는 알림을 띄워 달라는 신호. components/stale-banner.tsx가 듣는다. */
export const STALE_EVENT = "modori:stale";

/**
 * 화면이 오래돼서 실패했을 때, 어느 화면에서든 보이는 새로고침 배너를 띄운다. 모바일 앱에는 새로고침 버튼이 없어서
 * 알림이 사라지면 사용자가 빠져나올 길이 없다. 배너는 새로고침할 때까지 남는다.
 */
function announceStale() {
  window.dispatchEvent(new Event(STALE_EVENT));
}

/** 인터넷이 끊겨서 실패한 것인지. 브라우저가 알려 주는 오프라인 상태와 fetch가 던지는 네트워크 오류를 함께 본다. */
function isOffline(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return error instanceof TypeError && /fetch|network|load failed/i.test(error.message);
}

/**
 * 서버에 보내다 실패했을 때 부른다. 화면은 그대로 두고 아래에 알림만 띄운다.
 *
 * 잡지 않으면 가장 가까운 error.tsx가 화면 전체를 오류 화면으로 바꾼다. 지하철에서
 * 연결이 한 번 끊겼다고 적던 글자까지 사라지면 안 된다.
 *
 * 세션이 끊겨 서버가 redirect("/login")을 하면 그것도 예외로 넘어온다. 그건 삼키지
 * 않고 Next에 돌려줘야 로그인 화면으로 간다.
 *
 * 인터넷이 끊겼으면 그렇게 말하고, 연결은 되는데 실패했으면 화면이 오래된 것으로 보고 새로고침 버튼을 준다.
 */
export function useSaveFailure(): (error: unknown) => void {
  const toast = useToast();
  return useCallback(
    (error: unknown) => {
      unstable_rethrow(error);
      console.error("[save] 서버에 저장하지 못했다.", error);
      if (isOffline(error)) {
        toast({ message: OFFLINE_MESSAGE });
        return;
      }
      announceStale();
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
      if (isOffline(error)) return { message: OFFLINE_MESSAGE } as State;
      announceStale();
      return { message: STALE_MESSAGE } as State;
    }
  };
}
