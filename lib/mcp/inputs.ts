import { z } from "zod";

/**
 * MCP 도구의 입력 모양과 한 번에 처리하는 개수. 도구 설명과 오류 문장은 AI가 읽으므로 영어로 적는다(화면 글이 아니다).
 * 한 번에 많이 만들 수 있어야 "한 번에 다 해 줘"가 되지만, AI의 실수나 조작된 글(프롬프트 주입)이 수백 개를 만들지 못하게 상한을 둔다.
 */
export const MCP_LIMITS = {
  todosPerCall: 20,
  eventsPerCall: 10,
  idsPerCall: 50,
  // 목록 조회는 이 기간·개수까지. 더 넓게 보려면 나눠서 부른다.
  listDays: 62,
  listRows: 300,
  // "방금 한 것 되돌리기"가 지울 수 있는 시간. 그 뒤에는 사용자가 앱에서 직접 지운다.
  undoHours: 24,
} as const;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").describe("Date as YYYY-MM-DD in the user's timezone (see get_overview.today)");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)").describe("Time as HH:MM (24-hour), the user's local time");
const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid id");

// 모든 권한 도구의 입력(inputs-full.ts)도 같은 칸 모양을 쓴다.
export const dayInput = day;
export const timeInput = time;
export const idInput = id;
export const hexColorInput = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use #rrggbb").describe("#rrggbb");

export const listTodosInput = {
  from: day.describe("First day to list, YYYY-MM-DD"),
  to: day.optional().describe(`Last day to list, YYYY-MM-DD. Defaults to 'from'. At most ${MCP_LIMITS.listDays} days after 'from'.`),
  includeMemo: z.boolean().optional().describe("Include each todo's private memo. Default false."),
};

export const createTodosInput = {
  todos: z
    .array(
      z.object({
        content: z.string().trim().min(1).max(200).describe("What to do, up to 200 characters"),
        date: day,
        category: z.string().trim().min(1).max(64).optional().describe("Category id or exact name from get_overview. Omit for no category."),
        memo: z.string().trim().max(500).optional().describe("Private note, up to 500 characters"),
      }),
    )
    .min(1)
    .max(MCP_LIMITS.todosPerCall)
    .describe(`1 to ${MCP_LIMITS.todosPerCall} todos. The whole call fails if any item is invalid, so nothing is half-created.`),
};

export const completeTodosInput = {
  ids: z.array(id).min(1).max(MCP_LIMITS.idsPerCall).describe("Todo ids from list_todos or create_todos"),
  done: z.boolean().optional().describe("true (default) marks them done, false marks them not done"),
};

export const moveTodosInput = {
  ids: z.array(id).min(1).max(MCP_LIMITS.idsPerCall).describe("Todo ids to move"),
  date: day.describe("Day to move them to, YYYY-MM-DD"),
};

/** 이미 있는 할 일에 메모를 다는 입력(쓰기 토큰도 쓴다). 새로 만들 때의 메모는 create_todos의 memo다. */
export const addTodoMemosInput = {
  memos: z
    .array(
      z.object({
        id,
        memo: z.string().trim().min(1).max(500).describe("The note to add, 1 to 500 characters"),
      }),
    )
    .min(1)
    .max(MCP_LIMITS.todosPerCall)
    .describe(`1 to ${MCP_LIMITS.todosPerCall} existing todos (ids from list_todos or create_todos) and the note for each. All-or-nothing.`),
  replace: z
    .boolean()
    .optional()
    .describe("false (default): add the note on a new line after the todo's existing note, if any. true: replace the existing note. Existing notes are only returned by list_todos with includeMemo=true."),
};

export const listEventsInput = {
  from: day.describe("First day, YYYY-MM-DD"),
  to: day.optional().describe(`Last day, YYYY-MM-DD. Defaults to 'from'. At most ${MCP_LIMITS.listDays} days after 'from'.`),
};

export const createEventsInput = {
  events: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(100),
        startDate: day,
        endDate: day.optional().describe("Last day for multi-day events. Omit for a one-day event."),
        startTime: time.optional().describe("Omit for an all-day event"),
        endTime: time.optional().describe("Requires startTime"),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "Use #rrggbb")
          .optional()
          .describe("#rrggbb. Omit for the default color."),
        memo: z.string().trim().max(500).optional(),
        isPublic: z
          .boolean()
          .optional()
          .describe("Whether followers can see this event. Default FALSE here (private) so an AI never shares something by accident. Set true only if the user asked."),
      }),
    )
    .min(1)
    .max(MCP_LIMITS.eventsPerCall),
};

export const undoBatchInput = {
  batchId: id.describe("batchId returned by create_todos or create_events"),
};
