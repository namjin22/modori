"use client";

import { createContext, useContext } from "react";

import type { ReceivedReaction } from "@/lib/reactions";

/** 홈이 한 달치로 받아 둔 할 일 한 줄. */
export type HomeTodo = {
  id: string;
  date: string;
  content: string;
  done: boolean;
  color: string | null;
  memo: string | null;
  // 메모를 팔로워에게 보일지(2026-10-17). 적는 중인 할 일 등은 비워 둔다(비공개).
  memoPublic?: boolean;
  // 세부 할 일이면 큰 할 일의 id(2026-11-20). 큰 할 일이거나 보통 할 일이면 비어 있다.
  parentId?: string | null;
  // 끝낸 시각(ms). 달력 칸이 끝낸 차례대로 차도록 정렬하는 데만 쓴다.
  doneAt: number | null;
  category: { id: string; name: string; color: string } | null;
  received: ReceivedReaction[];
};

/** 서버 응답 전에 화면에 먼저 반영할 바뀜. */
export type TodoChange =
  | { type: "add"; todo: HomeTodo }
  | { type: "patch"; id: string; patch: Partial<Pick<HomeTodo, "content" | "memo" | "memoPublic" | "done" | "doneAt" | "date" | "category" | "color">> }
  | { type: "remove"; id: string }
  // 지난 날의 안 끝낸 일을 모두 오늘로.
  | { type: "moveUndone"; from: string; to: string };

/** 서버가 아직 모르는 할 일(적는 중). id가 이렇게 시작하면 누르거나 끌 수 없다. */
export const PENDING_PREFIX = "pending:";

/**
 * 서버(lib/sub-todos.ts, app/(tabs)/actions.ts)가 하는 일을 화면이 먼저 따라 그린다.
 * 큰 할 일을 지우면 세부 할 일도 사라지고, 큰 할 일이 다른 날로 가면 안 끝낸 세부 할 일은 같이 가고 끝낸 세부 할 일은 그 날에 남아 연결이 끊기며,
 * 큰 할 일의 카테고리가 바뀌면 세부 할 일도 따라간다.
 */
export function applyTodoChange(todos: HomeTodo[], change: TodoChange): HomeTodo[] {
  switch (change.type) {
    case "add":
      return [...todos, change.todo];
    case "patch": {
      const { date, category } = change.patch;
      return todos.map((todo) => {
        if (todo.id === change.id) return { ...todo, ...change.patch };
        if (todo.parentId !== change.id) return todo;
        if (date !== undefined && date !== todo.date) return todo.done ? { ...todo, parentId: null } : { ...todo, date, ...(category !== undefined && { category }) };
        return category !== undefined ? { ...todo, category } : todo;
      });
    }
    case "remove":
      return todos.filter((todo) => todo.id !== change.id && todo.parentId !== change.id);
    case "moveUndone": {
      const moving = new Set(todos.filter((todo) => todo.date === change.from && !todo.done).map((todo) => todo.id));
      return todos.map((todo) => {
        if (moving.has(todo.id)) return todo.parentId && !moving.has(todo.parentId) ? { ...todo, date: change.to, parentId: null } : { ...todo, date: change.to };
        // 큰 할 일이 떠나고 남은 끝낸 세부 할 일은 연결만 끊긴다.
        return todo.parentId && moving.has(todo.parentId) ? { ...todo, parentId: null } : todo;
      });
    }
  }
}

const TodoStoreContext = createContext<((change: TodoChange) => void) | null>(null);
export const TodoStoreProvider = TodoStoreContext.Provider;

/**
 * 홈의 할 일을 고치는 부품(적기·체크·고치기·옮기기·지우기)이 서버 응답 전에 화면부터 바꾼다.
 * useOptimistic의 갱신이라 서버 액션을 부르는 전환(transition) 안에서, await 전에 불러야 한다.
 * 액션이 끝나면 서버가 다시 보낸 한 달치로 바뀌고, 실패하면 저절로 원래대로 돌아간다. 홈 밖(친구 화면 등)에서는 null이다.
 */
export function useTodoStore() {
  return useContext(TodoStoreContext);
}
