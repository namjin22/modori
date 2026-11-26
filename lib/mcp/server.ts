import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

import {
  addTodoMemosInput,
  completeTodosInput,
  createEventsInput,
  createTodosInput,
  listEventsInput,
  listTodosInput,
  moveTodosInput,
  undoBatchInput,
} from "@/lib/mcp/inputs";
import {
  createCategoryInput,
  createRoutineInput,
  deleteCategoryInput,
  deleteEventsInput,
  deleteRoutineInput,
  deleteTodosInput,
  friendRangeInput,
  listPeopleInput,
  personInput,
  searchUsersInput,
  setReactionInput,
  updateCategoryInput,
  updateEventsInput,
  updateProfileInput,
  updateRoutineInput,
  updateSettingsInput,
  updateTodosInput,
} from "@/lib/mcp/inputs-full";
import { addTodoMemos, deleteEvents, deleteTodos, updateEvents, updateTodos } from "@/lib/mcp/edit-tools";
import { createCategory, createRoutine, deleteCategory, deleteRoutine, listRoutines, updateCategory, updateRoutine } from "@/lib/mcp/organize-tools";
import {
  followUser,
  getProfile,
  listFriendEvents,
  listFriendTodos,
  listPeople,
  removeFollower,
  searchUsers,
  setReaction,
  unfollowUser,
  updateProfile,
  updateSettings,
} from "@/lib/mcp/people-tools";
import type { McpContext } from "@/lib/mcp/shared";
import { completeTodos, createEvents, createTodos, getOverview, listEvents, listTodos, moveTodos, undoBatch } from "@/lib/mcp/tools";

const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
// 만들기는 있던 것을 지우거나 덮지 않는다.
const ADDS: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const CHANGES: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const REMOVES: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
// 남에게 닿는 일(팔로우·반응)은 모도리 밖이 아니라 같은 서비스의 다른 사람에게 가는 것이라 openWorld는 아니지만, 한 번 보내면 남의 폰에 닿는다.
const REACHES_OTHERS: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const INSTRUCTIONS = [
  "modori is a todo and calendar app. These tools read and change the signed-in user's own data.",
  "Call get_overview first: it returns today's date in the user's timezone, their todo categories, their named colors ('my colors', eventCategories: the colors the user gave a name, e.g. exam = orange, which events and repeating events can use), the limits, and what this token may do (access.scope).",
  "Create or edit many items in one call instead of one by one. Every call is all-or-nothing.",
  "Events, categories and repeating events you create are private to the user unless they asked to share them. Todos in a public category are visible to the user's followers.",
  "Every call that creates, edits or deletes returns a batchId; undo_batch puts things back within 24 hours if the user changes their mind.",
  "Other people's data is only readable when the token's owner turned that on, and only what those people already show their followers.",
].join(" ");

/**
 * 요청 하나를 위한 서버. 토큰의 권한(scope)에 맞는 도구만 등록한다: 읽기 토큰에는 바꾸는 도구가, 쓰기 토큰에는 고치기·지우기 도구가 목록에도 보이지 않는다.
 * 친구의 공개 할 일·일정을 읽는 도구는 토큰을 만든 사람이 허락한 토큰에만 보인다.
 * 요청마다 새로 만들어서 사용자 정보가 요청 사이에 섞이지 않게 한다(세션을 두지 않는 방식).
 */
export function createMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer({ name: "modori", version: "2.0.0" }, { instructions: INSTRUCTIONS });

  // 읽기: 모든 토큰.
  server.registerTool(
    "get_overview",
    {
      title: "Get overview",
      description:
        "Today's date in the user's timezone, the user's todo categories (id, name, color, whether followers can see it), the user's named colors for events (eventCategories: id, name, color), the limits, and what this token may do. Call this first.",
      annotations: READ_ONLY,
    },
    () => getOverview(ctx),
  );
  server.registerTool(
    "list_todos",
    { title: "List todos", description: "List the user's todos between two dates, in display order. A sub-todo has a parentId (the todo it sits under).", inputSchema: listTodosInput, annotations: READ_ONLY },
    (input) => listTodos(ctx, input),
  );
  server.registerTool(
    "list_events",
    {
      title: "List events",
      description: "List the user's calendar events that overlap a date range, with the named color (category) each one uses, if any. Repeating events are listed by list_routines.",
      inputSchema: listEventsInput,
      annotations: READ_ONLY,
    },
    (input) => listEvents(ctx, input),
  );
  server.registerTool(
    "list_routines",
    { title: "List routines", description: "List the user's routines (todos that repeat) and repeating events, with their repeat rules.", annotations: READ_ONLY },
    () => listRoutines(ctx),
  );
  server.registerTool(
    "get_profile",
    { title: "Get profile", description: "The user's nickname, bio, language, time zone, notification settings and follower counts.", annotations: READ_ONLY },
    () => getProfile(ctx),
  );
  server.registerTool(
    "search_users",
    { title: "Search users", description: "Find people by part of their nickname (up to 20). Shows whether the user already follows them.", inputSchema: searchUsersInput, annotations: READ_ONLY },
    (input) => searchUsers(ctx, input),
  );
  server.registerTool(
    "list_people",
    { title: "List people", description: "List the people the user follows, or the people who follow the user.", inputSchema: listPeopleInput, annotations: READ_ONLY },
    (input) => listPeople(ctx, input),
  );

  // 친구의 공개 정보: 토큰을 만든 사람이 허락한 토큰만.
  if (ctx.allowFriends) {
    server.registerTool(
      "list_friend_todos",
      {
        title: "List a friend's todos",
        description:
          "List the todos a followed friend shows to their followers (public categories only; memos only if the friend made them public) between two dates. The user must follow the friend. This sends the friend's data to you, so only do it for what the user asked.",
        inputSchema: friendRangeInput,
        annotations: READ_ONLY,
      },
      (input) => listFriendTodos(ctx, input),
    );
    server.registerTool(
      "list_friend_events",
      {
        title: "List a friend's events",
        description: "List the events a followed friend shows to their followers (including repeating ones) between two dates. The user must follow the friend.",
        inputSchema: friendRangeInput,
        annotations: READ_ONLY,
      },
      (input) => listFriendEvents(ctx, input),
    );
  }

  if (ctx.scope === "READ") return server;

  // 만들기·끝내기·옮기기·메모 달기·되돌리기: 쓰기와 모든 권한.
  server.registerTool(
    "create_todos",
    {
      title: "Create todos",
      description: "Create up to 20 todos at once, each for a given date and optional category. Give parentId to add a sub-todo under an existing todo (same day and category as the parent, one level only). All-or-nothing. Returns a batchId for undo_batch.",
      inputSchema: createTodosInput,
      annotations: ADDS,
    },
    (input) => createTodos(ctx, input),
  );
  server.registerTool(
    "complete_todos",
    { title: "Complete todos", description: "Mark todos done (or not done with done=false). Already-matching todos are left alone.", inputSchema: completeTodosInput, annotations: CHANGES },
    (input) => completeTodos(ctx, input),
  );
  server.registerTool(
    "move_todos",
    { title: "Move todos", description: "Move todos to another date.", inputSchema: moveTodosInput, annotations: CHANGES },
    (input) => moveTodos(ctx, input),
  );
  server.registerTool(
    "add_todo_memos",
    {
      title: "Add notes to todos",
      description:
        "Add a private note (memo) to up to 20 existing todos. By default the note goes on a new line after the existing note; set replace=true to replace it. Notes you write are hidden from the user's followers. To put a note on a todo you are creating, use create_todos' memo field instead.",
      inputSchema: addTodoMemosInput,
      annotations: CHANGES,
    },
    (input) => addTodoMemos(ctx, input),
  );
  server.registerTool(
    "create_events",
    {
      title: "Create events",
      description:
        "Create up to 10 calendar events at once (one-day or multi-day, with optional times). Give color (#rrggbb) or category (one of the user's named colors, which also sets the event's color), not both. Private by default. All-or-nothing. Returns a batchId for undo_batch.",
      inputSchema: createEventsInput,
      annotations: ADDS,
    },
    (input) => createEvents(ctx, input),
  );
  server.registerTool(
    "undo_batch",
    {
      title: "Undo a batch",
      description:
        "Undo what one earlier call did, within 24 hours: delete what create_todos / create_events made (todos the user already completed are kept), or put back what delete_* and update_* removed or changed.",
      inputSchema: undoBatchInput,
      annotations: REMOVES,
    },
    (input) => undoBatch(ctx, input),
  );

  if (ctx.scope !== "FULL") return server;

  // 모든 권한: 고치기·지우기·카테고리·루틴·프로필·설정·친구·반응.
  server.registerTool(
    "update_todos",
    { title: "Edit todos", description: "Change the text, memo or category of up to 20 todos. Use complete_todos to finish and move_todos to change the date.", inputSchema: updateTodosInput, annotations: CHANGES },
    (input) => updateTodos(ctx, input),
  );
  server.registerTool(
    "delete_todos",
    { title: "Delete todos", description: "Delete up to 50 todos. Friends' reactions to them are lost for good, but undo_batch restores the todos.", inputSchema: deleteTodosInput, annotations: REMOVES },
    (input) => deleteTodos(ctx, input),
  );
  server.registerTool(
    "update_events",
    {
      title: "Edit events",
      description: "Change the title, dates, times, color or named color (category), memo or visibility of up to 10 events.",
      inputSchema: updateEventsInput,
      annotations: CHANGES,
    },
    (input) => updateEvents(ctx, input),
  );
  server.registerTool(
    "delete_events",
    { title: "Delete events", description: "Delete up to 10 events.", inputSchema: deleteEventsInput, annotations: REMOVES },
    (input) => deleteEvents(ctx, input),
  );
  server.registerTool(
    "create_category",
    {
      title: "Create category",
      description:
        "Create a todo category (up to 10 in total, private by default) or, with kind=event, a named color for events (up to 20 in total, e.g. exam = orange; followers only ever see the color).",
      inputSchema: createCategoryInput,
      annotations: ADDS,
    },
    (input) => createCategory(ctx, input),
  );
  server.registerTool(
    "update_category",
    {
      title: "Edit category",
      description:
        "Rename a category, change its color or (todo categories only) whether followers can see its todos. With kind=event it edits a named color: events and repeating events that still have its old color follow a new color. Returns the previous values.",
      inputSchema: updateCategoryInput,
      annotations: CHANGES,
    },
    (input) => updateCategory(ctx, input),
  );
  server.registerTool(
    "delete_category",
    {
      title: "Delete category",
      description:
        "Delete a todo category (its todos stay without a category and its routines are paused) or, with kind=event, a named color (events and repeating events keep their color). Returns a batchId for undo_batch.",
      inputSchema: deleteCategoryInput,
      annotations: REMOVES,
    },
    (input) => deleteCategory(ctx, input),
  );
  server.registerTool(
    "create_routine",
    {
      title: "Create routine",
      description:
        "Create a routine (a todo that repeats, needs a category) or, with kind=event, a repeating calendar event (optionally in one of the user's named colors via category). At most 50 in total. Repeating events are private by default.",
      inputSchema: createRoutineInput,
      annotations: ADDS,
    },
    (input) => createRoutine(ctx, input),
  );
  server.registerTool(
    "update_routine",
    {
      title: "Edit routine",
      description: "Change a routine or repeating event: title, category (named color for a repeating event), repeat rule, dates, times, or pause/resume it. Returns the previous values.",
      inputSchema: updateRoutineInput,
      annotations: CHANGES,
    },
    (input) => updateRoutine(ctx, input),
  );
  server.registerTool(
    "delete_routine",
    { title: "Delete routine", description: "Delete a routine or repeating event. Todos it already made are kept. Returns a batchId for undo_batch.", inputSchema: deleteRoutineInput, annotations: REMOVES },
    (input) => deleteRoutine(ctx, input),
  );
  server.registerTool(
    "update_profile",
    { title: "Edit profile", description: "Change the user's nickname, bio or built-in avatar character. Returns the previous values.", inputSchema: updateProfileInput, annotations: CHANGES },
    (input) => updateProfile(ctx, input),
  );
  server.registerTool(
    "update_settings",
    {
      title: "Edit settings",
      description: "Change the time zone, the friend-finished notification, whether the user shows in recommendations, or the morning events notification time. Returns the previous values.",
      inputSchema: updateSettingsInput,
      annotations: CHANGES,
    },
    (input) => updateSettings(ctx, input),
  );
  server.registerTool(
    "follow_user",
    { title: "Follow a user", description: "Follow someone by nickname. They get a push notification.", inputSchema: personInput, annotations: REACHES_OTHERS },
    (input) => followUser(ctx, input),
  );
  server.registerTool(
    "unfollow_user",
    { title: "Unfollow a user", description: "Stop following someone by nickname.", inputSchema: personInput, annotations: REMOVES },
    (input) => unfollowUser(ctx, input),
  );
  server.registerTool(
    "remove_follower",
    { title: "Remove a follower", description: "Make someone stop following the user (they can follow again; this is not a block).", inputSchema: personInput, annotations: REMOVES },
    (input) => removeFollower(ctx, input),
  );
  server.registerTool(
    "set_reaction",
    {
      title: "React to a todo",
      description:
        "Send an emoji reaction to a finished todo of someone the user follows (public categories only), or remove the user's own reaction with on=false. The person gets a push notification.",
      inputSchema: setReactionInput,
      annotations: REACHES_OTHERS,
    },
    (input) => setReaction(ctx, input),
  );

  return server;
}
