"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";

type ToastAction = {
  label: string;
  run: () => Promise<void>;
};

type Toast = {
  id: number;
  message: string;
  action?: ToastAction;
};

type ShowToast = (toast: Omit<Toast, "id">) => void;

const ToastContext = createContext<ShowToast | null>(null);

// 되돌리기를 읽고 누를 시간. 짧으면 놓치고, 길면 다음 동작을 가린다.
const VISIBLE_MS = 5000;

export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error("ToastProvider 바깥에서 useToast를 불렀다.");
  return show;
}

/**
 * 브라우저 기본 확인창 대신 화면 안에서 띄우는 알림.
 * 한 번에 하나만 보여준다. 새 알림이 오면 앞의 것을 바로 바꾼다.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [isRunning, startTransition] = useTransition();

  const show = useCallback<ShowToast>((next) => {
    setToast({ ...next, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function runAction(action: ToastAction) {
    startTransition(async () => {
      try {
        await action.run();
        setToast(null);
      } catch (error) {
        console.error("[toast] 알림의 동작이 실패했다.", error);
        setToast({ id: Date.now(), message: "되돌리지 못했어요. 다시 시도해주세요." });
      }
    });
  }

  return (
    <ToastContext.Provider value={show}>
      {children}

      {/* 하단 탭 바로 위에 띄운다. 아이폰 홈 막대만큼 더 올린다. */}
      {/* 드래그 안내(dnd-kit)도 role="status"를 쓴다. 이름을 붙여 구분한다. */}
      <div
        role="status"
        aria-live="polite"
        aria-label="알림"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-50 flex justify-center px-5"
      >
        {toast && (
          <div
            key={toast.id}
            // 테마와 반대 색으로 칠해 어떤 배경 위에서도 떠 보이게 한다.
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-foreground py-3 pl-4 pr-2 text-sm text-background shadow-lg [animation:toast-in_0.2s_ease-out_both]"
          >
            <span className="flex-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                disabled={isRunning}
                onClick={() => toast.action && runAction(toast.action)}
                className="h-8 shrink-0 rounded-xl px-3 font-semibold underline-offset-4 hover:underline disabled:opacity-50"
              >
                {isRunning ? "되돌리는 중" : toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
