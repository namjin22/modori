// AI 도우미가 제안하는 날짜의 범위(2026-11-19): 서버 액션·AI 연결과 같은 오늘에서 앞뒤 10년이고, 넘는 항목은 개수를 알려 안내 문구를 띄운다.
import { describe, expect, it } from "vitest";

import { AI_LIMITS, buildSystemPrompt, parseReply } from "@/lib/ai/plan";
import { addDays, formatKST, parseKSTDate } from "@/lib/date";
import { LIMITS } from "@/lib/limits";

const today = parseKSTDate("2026-11-17");
const context = { today, categories: [] as string[] };
const day = (offset: number) => formatKST(addDays(today, offset));
const reply = (body: unknown) => JSON.stringify(body);

describe("AI 도우미 제안 날짜 범위", () => {
  it("범위는 할 일 날짜 범위(10년)와 같은 값이다", () => {
    expect(AI_LIMITS.daysFromToday).toBe(LIMITS.todoDays);
    expect(AI_LIMITS.daysFromToday).toBe(3650);
  });

  it("앞뒤 10년까지는 받고, 하루라도 넘으면 버리면서 몇 개를 뺐는지 알린다", () => {
    const plan = parseReply(
      reply({
        reply: "네",
        todos: [
          { content: "딱 10년 뒤", date: day(3650) },
          { content: "10년 하루 뒤", date: day(3651) },
          { content: "딱 10년 전", date: day(-3650) },
          { content: "10년 하루 전", date: day(-3651) },
        ],
        events: [
          { title: "범위 안 일정", startDate: day(3650), endDate: day(3650) },
          { title: "범위 밖 일정", startDate: day(3651), endDate: day(3651) },
        ],
      }),
      context,
    );
    expect(plan?.todos.map((todo) => todo.content)).toEqual(["딱 10년 뒤", "딱 10년 전"]);
    expect(plan?.events.map((event) => event.title)).toEqual(["범위 안 일정"]);
    expect(plan?.tooFar).toBe(3);
  });

  it("버린 것이 없으면 tooFar 칸이 없다. 진짜가 아닌 날짜(2월 30일)는 먼 날짜로 세지 않는다", () => {
    const plan = parseReply(reply({ reply: "네", todos: [{ content: "정상", date: day(1) }, { content: "2월 30일", date: "2026-02-30" }] }), context);
    expect(plan?.todos).toHaveLength(1);
    expect(plan).not.toHaveProperty("tooFar");
  });

  it("지시문이 AI에게 10년 안으로만 잡으라고 한다(예전의 60일 안 지시는 없다)", () => {
    const prompt = buildSystemPrompt({ today: "2026-11-17", timezone: "Asia/Seoul", context: "" });
    expect(prompt).toContain("앞뒤 3650일(10년) 안으로만 잡는다");
    expect(prompt).not.toContain("60일 안");
  });
});
