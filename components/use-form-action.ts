"use client";

import { type FormEvent, useState, useTransition } from "react";

import { orSaveFailure } from "@/components/use-save-failure";

type FormState = { message: string; ok?: boolean } | null;

/**
 * useActionState + <form action> 대신 쓴다.
 *
 * <form action>이면 React가 액션을 보내는 순간 입력칸을 모두 처음 값으로 되돌린다.
 * 서버가 "요일을 골라주세요"처럼 거절해도 적던 내용이 사라져서 처음부터 다시 적어야
 * 했다. 여기서는 onSubmit으로 보내고, 서버가 ok를 돌려줬을 때만 비운다.
 */
export function useFormAction<State extends FormState>(
  action: (previous: State, formData: FormData) => Promise<State>,
  initialState: State,
) {
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter를 연달아 누르면 같은 것이 여러 개 만들어진다.
    if (pending) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const next = await orSaveFailure(action)(state, formData);
      setState(next);
      if (next?.ok) form.reset();
    });
  }

  return [state, onSubmit, pending] as const;
}
