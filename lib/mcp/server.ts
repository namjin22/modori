import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

import type { McpScope } from "@/lib/mcp/auth";
import {
  completeTodosInput,
  createEventsInput,
  createTodosInput,
  listEventsInput,
  listTodosInput,
  moveTodosInput,
  undoBatchInput,
} from "@/lib/mcp/inputs";
import {
  completeTodos,
  createEvents,
  createTodos,
  getOverview,
  listEvents,
  listTodos,
  moveTodos,
  undoBatch,
  type McpContext,
} from "@/lib/mcp/tools";

const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
// 만들기는 있던 것을 지우거나 덮지 않는다.
const ADDS: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const CHANGES: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const REMOVES: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

const INSTRUCTIONS = [
  "modori is a todo and calendar app. These tools read and change the signed-in user's own todos and events.",
  "Call get_overview first: it returns today's date in the user's timezone, their categories, and the limits.",
  "Create many items in one call (create_todos / create_events) instead of one by one. A call is all-or-nothing.",
  "Events you create are private to the user unless they asked to share them. Todos in a public category are visible to the user's followers.",
  "Every create call returns a batchId; undo_batch removes what that call made if the user changes their mind.",
].join(" ");

/**
 * 요청 하나를 위한 서버. 토큰의 권한(scope)에 맞는 도구만 등록한다: 읽기 토큰에는 바꾸는 도구가 목록에도 보이지 않는다.
 * 요청마다 새로 만들어서 사용자 정보가 요청 사이에 섞이지 않게 한다(세션을 두지 않는 방식).
 */
export function createMcpServer(ctx: McpContext, scope: McpScope): McpServer {
  const server = new McpServer({ name: "modori", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "get_overview",
    {
      title: "Get overview",
      description: "Today's date in the user's timezone, the user's categories (id, name, color, whether followers can see it), and the limits. Call this first.",
      annotations: READ_ONLY,
    },
    () => getOverview(ctx),
  );
  server.registerTool(
    "list_todos",
    { title: "List todos", description: "List the user's todos between two dates, in display order.", inputSchema: listTodosInput, annotations: READ_ONLY },
    (input) => listTodos(ctx, input),
  );
  server.registerTool(
    "list_events",
    { title: "List events", description: "List the user's calendar events that overlap a date range.", inputSchema: listEventsInput, annotations: READ_ONLY },
    (input) => listEvents(ctx, input),
  );

  if (scope !== "WRITE") return server;

  server.registerTool(
    "create_todos",
    {
      title: "Create todos",
      description: "Create up to 20 todos at once, each for a given date and optional category. All-or-nothing. Returns a batchId for undo_batch.",
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
    "create_events",
    {
      title: "Create events",
      description: "Create up to 10 calendar events at once (one-day or multi-day, with optional times). Private by default. All-or-nothing. Returns a batchId for undo_batch.",
      inputSchema: createEventsInput,
      annotations: ADDS,
    },
    (input) => createEvents(ctx, input),
  );
  server.registerTool(
    "undo_batch",
    {
      title: "Undo a batch",
      description: "Delete the todos and events that one create_todos / create_events call made, within 24 hours. Todos the user already completed are kept.",
      inputSchema: undoBatchInput,
      annotations: REMOVES,
    },
    (input) => undoBatch(ctx, input),
  );

  return server;
}
