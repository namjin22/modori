import { z } from "zod";

import { dayInput, hexColorInput, idInput, MCP_LIMITS, timeInput } from "@/lib/mcp/inputs";

/**
 * 읽기 토큰에도 보이는 새 조회 도구와, 모든 권한(FULL) 토큰의 도구들의 입력 모양. 설명과 오류 문장은 AI가 읽으므로 영어로 적는다.
 * 핵심 도구(만들기·끝내기·옮기기)는 inputs.ts에 있다.
 */
const nickname = z.string().trim().min(1).max(20).describe("The person's exact nickname (case-insensitive), as shown in the app");
const todoCategory = z.string().trim().min(1).max(64).describe("Category id or exact name from get_overview");
const eventCategoryRef = z.string().trim().min(1).max(64).describe("A named color ('my colors') id or exact name from get_overview.eventCategories");
const categoryKind = z
  .enum(["todo", "event"])
  .describe("todo (default) = a todo category (get_overview.categories). event = a named color ('my colors', get_overview.eventCategories) that events, repeating events and the app's color pickers share.");

/** 고칠 칸을 하나도 안 준 항목은 아무 일도 안 하므로 AI의 실수로 보고 막는다. */
const hasChange = (value: Record<string, unknown>) => Object.entries(value).some(([key, entry]) => key !== "id" && entry !== undefined);
const needsChange = "Give at least one field to change besides id.";

export const updateTodosInput = {
  updates: z
    .array(
      z
        .object({
          id: idInput,
          content: z.string().trim().min(1).max(200).optional().describe("New text, up to 200 characters"),
          memo: z.string().trim().max(500).nullable().optional().describe("New private note, up to 500 characters. null or an empty string removes it."),
          memoPublic: z.boolean().optional().describe("Whether followers can read the memo (only matters if the todo's category is visible to followers)"),
          category: todoCategory.optional().describe("Move to this category (id or exact name). A todo cannot be left without a category once it has one."),
        })
        .refine(hasChange, needsChange),
    )
    .min(1)
    .max(MCP_LIMITS.todosPerCall)
    .describe(`1 to ${MCP_LIMITS.todosPerCall} todos to edit. All-or-nothing. Returns a batchId for undo_batch (it restores the previous text, memo and category).`),
};

export const deleteTodosInput = {
  ids: z.array(idInput).min(1).max(MCP_LIMITS.idsPerCall).describe("Todo ids from list_todos. Returns a batchId for undo_batch."),
};

export const updateEventsInput = {
  updates: z
    .array(
      z
        .object({
          id: idInput,
          title: z.string().trim().min(1).max(100).optional(),
          startDate: dayInput.optional(),
          endDate: dayInput.optional().describe("Last day. For a one-day event set it equal to startDate."),
          startTime: timeInput.nullable().optional().describe("null makes it an all-day event (and removes endTime)"),
          endTime: timeInput.nullable().optional().describe("null removes the end time. Requires a start time."),
          color: hexColorInput.optional().describe("Setting a color by hand detaches the event from its named color. Give either color or category, not both."),
          category: eventCategoryRef.nullable().optional().describe("Put the event under one of the user's named colors (it takes that color and name). null detaches it and keeps its color."),
          memo: z.string().trim().max(500).nullable().optional().describe("null or an empty string removes the memo"),
          isPublic: z.boolean().optional().describe("Whether followers can see this event. Only set true if the user asked."),
          memoPublic: z.boolean().optional(),
          dday: z.boolean().optional().describe("Whether the D-day counter is shown"),
        })
        .refine(hasChange, needsChange),
    )
    .min(1)
    .max(MCP_LIMITS.eventsPerCall)
    .describe(`1 to ${MCP_LIMITS.eventsPerCall} events to edit. All-or-nothing. Returns a batchId for undo_batch.`),
};

export const deleteEventsInput = {
  ids: z.array(idInput).min(1).max(MCP_LIMITS.eventsPerCall).describe("Event ids from list_events. Returns a batchId for undo_batch."),
};

export const createCategoryInput = {
  kind: categoryKind.optional(),
  name: z.string().trim().min(1).max(20),
  color: hexColorInput,
  isPublic: z.boolean().optional().describe("Todo categories only: whether followers can see the todos in this category. Default FALSE here (private) so an AI never shares something by accident."),
};

export const updateCategoryInput = {
  kind: categoryKind.optional(),
  id: idInput.describe("Category id from get_overview (categories for kind=todo, eventCategories for kind=event)"),
  name: z.string().trim().min(1).max(20).optional(),
  color: hexColorInput.optional().describe("For kind=event the events and repeating events that still have the old color follow."),
  isPublic: z.boolean().optional().describe("Todo categories only. Making a category public shows all of its todos to followers. Only do it if the user asked."),
};

export const deleteCategoryInput = {
  kind: categoryKind.optional(),
  id: idInput.describe("Category id. Todo category: its todos are kept with no category and its routines are paused. Named color (kind=event): events and repeating events keep their color. Returns a batchId for undo_batch."),
};

const frequency = z.enum(["DAILY", "WEEKLY", "MONTHLY"]).describe("How often it repeats");
const weekdays = z.array(z.number().int().min(0).max(6)).max(7).describe("For WEEKLY: weekdays, 0=Sunday … 6=Saturday");
const monthdays = z.array(z.number().int().min(1).max(31)).max(31).describe("For MONTHLY: days of the month, 1 … 31");
const kind = z.enum(["todo", "event"]).describe("todo = a routine that creates a todo (needs a category); event = a repeating calendar event");

export const createRoutineInput = {
  kind: kind.optional().describe("Default todo"),
  title: z.string().trim().min(1).max(200).describe("What to do (todo, up to 200 characters) or the event name (event, up to 100)"),
  category: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional()
    .describe("kind=todo: required, a todo category (id or exact name from get_overview). kind=event: optional, a named color from get_overview.eventCategories (id or exact name); give either it or color."),
  frequency,
  weekdays: weekdays.optional(),
  monthdays: monthdays.optional(),
  startDate: dayInput.optional().describe("First day. Default today."),
  endDate: dayInput.optional().describe("Last day. Omit to repeat forever."),
  startTime: timeInput.optional().describe("Events only. Omit for all day."),
  endTime: timeInput.optional().describe("Events only. Requires startTime."),
  color: hexColorInput.optional().describe("Events only. Omit for the default color. Give either color or category, not both."),
  isPublic: z.boolean().optional().describe("Events only. Whether followers can see it. Default FALSE here (private)."),
};

export const updateRoutineInput = {
  id: idInput.describe("Routine id from list_routines"),
  kind: kind.optional().describe("Optional hint. Found automatically from the id."),
  title: z.string().trim().min(1).max(200).optional(),
  category: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .nullable()
    .optional()
    .describe(
      "Todo routine: a todo category (id or exact name); also moves the not-yet-done todos from today on. Repeating event: a named color from get_overview.eventCategories (id or exact name), or null to detach it and keep the color.",
    ),
  frequency: frequency.optional(),
  weekdays: weekdays.optional(),
  monthdays: monthdays.optional(),
  startDate: dayInput.optional(),
  endDate: dayInput.nullable().optional().describe("null makes it repeat forever"),
  paused: z.boolean().optional().describe("true pauses it, false resumes it (a todo routine whose category was deleted needs a new category first)"),
  startTime: timeInput.nullable().optional().describe("Events only. null makes it all day."),
  endTime: timeInput.nullable().optional().describe("Events only"),
  color: hexColorInput.optional().describe("Events only. Setting a color by hand detaches the repeating event from its named color. Give either color or category, not both."),
  isPublic: z.boolean().optional().describe("Events only"),
};

export const deleteRoutineInput = {
  id: idInput.describe("Routine id from list_routines. Todos it already made are kept. Returns a batchId for undo_batch."),
  kind: kind.optional().describe("Optional hint. Found automatically from the id."),
};

export const updateProfileInput = {
  nickname: z.string().trim().min(1).max(20).optional().describe("Must be unique. Friends find you by it."),
  bio: z.string().trim().max(100).optional().describe("Up to 100 characters. An empty string removes it."),
  avatarCharacter: z.string().trim().min(1).max(20).optional().describe("A built-in character id, e.g. dori. Photos cannot be uploaded through this server."),
};

export const updateSettingsInput = {
  timezone: z.string().trim().min(1).max(64).optional().describe("IANA time zone name such as Asia/Seoul. It decides what 'today' is."),
  notifyFriendDone: z.boolean().optional().describe("Push notification when a followed friend finishes a todo"),
  hideFromRecommend: z.boolean().optional().describe("Hide this account from the recommended-friends list"),
  eventDigestMinute: z
    .number()
    .int()
    .min(0)
    .max(1435)
    .multipleOf(5)
    .nullable()
    .optional()
    .describe("Morning push about today's events, as minutes after midnight in the user's time zone, in steps of 5 (360 = 06:00). null turns it off."),
};

export const searchUsersInput = {
  query: z.string().trim().min(1).max(20).describe("Part of a nickname"),
};

export const listPeopleInput = {
  kind: z.enum(["following", "followers"]).describe("following = people the user follows, followers = people who follow the user"),
};

export const personInput = { nickname };

export const setReactionInput = {
  todoId: idInput.describe("Id of a finished todo of someone the user follows (from list_friend_todos)"),
  emoji: z.string().trim().min(1).max(32).describe("One of the app's reaction emoji, e.g. 👍 🔥 👏 🎉 💪 🫶 ✨ 💯"),
  on: z.boolean().optional().describe("true (default) adds the reaction, false removes the user's own reaction"),
};

export const friendRangeInput = {
  nickname,
  from: dayInput.describe("First day, YYYY-MM-DD"),
  to: dayInput.optional().describe(`Last day. Defaults to 'from'. At most ${MCP_LIMITS.listDays} days after 'from'.`),
};
