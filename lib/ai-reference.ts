/**
 * "AI용으로 복사" 단추가 클립보드에 넣는 글(2026-11-20 운영자 요청).
 * AI(MCP로 모도리에 연결한 것이든 아니든)에게 "이 할 일 밑에 세부 할 일 달아 줘"처럼 말할 때, 이름만 대면 어느 할 일인지 못 찾거나
 * 같은 이름을 헷갈린다. id를 같이 주면 MCP 도구(`update_todos`, `create_todos`의 `parentId` 등)가 바로 그 일을 짚는다.
 *
 * 사용자가 눌러 복사하는 것이라 모도리가 데이터를 AI 쪽으로 보내는 것이 아니다(CLAUDE.md 규칙 7).
 * 메모는 넣지 않는다: 사적인 글이 붙여넣기로 새기 쉽다. 이름표는 어느 언어로 말해도 AI가 읽도록 영어로 고정한다(화면 글이 아니다).
 */

/** 사용자가 적은 글은 한 줄이어야 한다. 줄바꿈이 섞여 있으면 가짜 항목(`id: …`)을 끼워 넣을 수 있어 한 칸 공백으로 눕힌다. */
const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

export type TodoReference = {
  id: string;
  content: string;
  done: boolean;
  // "YYYY-MM-DD"
  date: string;
  category: string | null;
  // 세부 할 일이면 큰 할 일의 id.
  parentId?: string | null;
  // 이 할 일 밑의 세부 할 일.
  subTodos?: { id: string; content: string; done: boolean }[];
};

export function todoReference(todo: TodoReference): string {
  const isSub = todo.parentId != null;
  const lines = [
    isSub ? "Modori sub-todo" : "Modori todo",
    `id: ${todo.id}`,
    `title: ${oneLine(todo.content)}`,
    `date: ${todo.date}`,
    `category: ${todo.category ? oneLine(todo.category) : "(none)"}`,
    `done: ${todo.done ? "yes" : "no"}`,
  ];
  if (isSub) lines.push(`parent id: ${todo.parentId}`);

  const subs = todo.subTodos ?? [];
  if (subs.length > 0) {
    lines.push(`sub-todos (${subs.filter((sub) => sub.done).length}/${subs.length} done):`);
    for (const sub of subs) lines.push(`- [${sub.done ? "x" : " "}] ${oneLine(sub.content)} (id: ${sub.id})`);
  }
  return lines.join("\n");
}

export type EventReference = {
  id: string;
  title: string;
  // "YYYY-MM-DD"
  startDate: string;
  endDate: string;
  // "HH:MM". 없으면 하루 종일.
  startTime: string | null;
  endTime: string | null;
};

export function eventReference(event: EventReference): string {
  const date = event.startDate === event.endDate ? event.startDate : `${event.startDate} ~ ${event.endDate}`;
  const time = event.startTime === null ? "all day" : event.endTime === null ? event.startTime : `${event.startTime}-${event.endTime}`;
  return ["Modori event", `id: ${event.id}`, `title: ${oneLine(event.title)}`, `date: ${date}`, `time: ${time}`].join("\n");
}
