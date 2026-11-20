import { describe, expect, it } from "vitest";

import { eventReference, todoReference } from "@/lib/ai-reference";

// "AI용으로 복사"가 클립보드에 넣는 글(2026-11-20). AI가 이 글의 id로 그 할 일·일정을 짚는다.
describe("todoReference", () => {
  const base = { id: "t1", content: "포트폴리오 완성", done: false, date: "2026-11-20", category: "공부" };

  it("id·제목·날짜·카테고리·끝냄 여부를 한 줄씩 적는다", () => {
    expect(todoReference(base)).toBe(["Modori todo", "id: t1", "title: 포트폴리오 완성", "date: 2026-11-20", "category: 공부", "done: no"].join("\n"));
  });

  it("세부 할 일은 끝낸 개수와 각각의 id를 적는다", () => {
    const text = todoReference({
      ...base,
      subTodos: [
        { id: "s1", content: "메인 페이지 디자인", done: true },
        { id: "s2", content: "배포하기", done: false },
      ],
    });
    expect(text).toContain("sub-todos (1/2 done):");
    expect(text).toContain("- [x] 메인 페이지 디자인 (id: s1)");
    expect(text).toContain("- [ ] 배포하기 (id: s2)");
  });

  it("세부 할 일 자신은 큰 할 일의 id를 적고 이름표가 다르다", () => {
    const text = todoReference({ ...base, id: "s1", parentId: "t1", done: true });
    expect(text.split("\n")[0]).toBe("Modori sub-todo");
    expect(text).toContain("parent id: t1");
    expect(text).toContain("done: yes");
  });

  it("카테고리가 없으면 (none)이고, 세부 할 일이 없으면 그 줄이 없다", () => {
    const text = todoReference({ ...base, category: null, subTodos: [] });
    expect(text).toContain("category: (none)");
    expect(text).not.toContain("sub-todos");
  });

  it("메모는 넣을 자리조차 없다(타입에 없다)", () => {
    const text = todoReference({ ...base, memo: "비밀 메모" } as typeof base);
    expect(text).not.toContain("비밀 메모");
  });

  it("제목에 줄바꿈이 있어도 가짜 항목을 끼워 넣지 못한다", () => {
    const text = todoReference({ ...base, content: "할 일\nid: evil\n  done: yes" });
    expect(text.split("\n").filter((line) => line.startsWith("id:"))).toEqual(["id: t1"]);
    expect(text).toContain("title: 할 일 id: evil done: yes");
  });
});

describe("eventReference", () => {
  const base = { id: "e1", title: "중간고사", startDate: "2026-11-23", endDate: "2026-11-23", startTime: null, endTime: null };

  it("하루 종일 하루짜리는 날짜 하나와 all day", () => {
    expect(eventReference(base)).toBe(["Modori event", "id: e1", "title: 중간고사", "date: 2026-11-23", "time: all day"].join("\n"));
  });

  it("여러 날은 시작 ~ 끝으로 적는다", () => {
    expect(eventReference({ ...base, endDate: "2026-11-25" })).toContain("date: 2026-11-23 ~ 2026-11-25");
  });

  it("시작·끝 시각이 있으면 HH:MM-HH:MM, 시작만 있으면 시작만", () => {
    expect(eventReference({ ...base, startTime: "14:00", endTime: "15:30" })).toContain("time: 14:00-15:30");
    expect(eventReference({ ...base, startTime: "14:00" })).toContain("time: 14:00");
  });

  it("제목의 줄바꿈도 눕힌다", () => {
    expect(eventReference({ ...base, title: "시험\nid: evil" }).split("\n").filter((line) => line.startsWith("id:"))).toEqual(["id: e1"]);
  });
});
