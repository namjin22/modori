"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { acceptAiChatConsent, applyAiPlan, undoAiPlan } from "@/app/(tabs)/ai/actions";
import type { ChatResponse } from "@/app/api/ai/chat/route";
import { Dori } from "@/components/dori";
import { useLocale, useT } from "@/components/locale-provider";
import { parseKSTDate, weekdayKST } from "@/lib/date";
import { formatMonthDay, weekdayName } from "@/lib/i18n/format";
import { aichat } from "@/lib/i18n/messages/aichat";
import type { PlanEvent, PlanTodo } from "@/lib/ai/plan";

type Proposal = { todos: PlanTodo[]; events: PlanEvent[] };
type Applied = { state: "idle" } | { state: "adding" } | { state: "added"; todos: number; events: number; batchIds: string[] } | { state: "undone" } | { state: "failed"; message: string };
type Message = { id: number; role: "user" | "assistant"; text: string; proposal?: Proposal; applied?: Applied; isError?: boolean; code?: string; canRetry?: boolean };

/**
 * AI 도우미 대화 화면(2026-11-17, docs/decisions.md). 대화는 이 화면의 상태에만 있고 서버에 저장하지 않는다(새로 고치면 사라진다).
 * AI가 제안한 할 일·일정은 미리보기로 보이고, 사용자가 골라서 "모도리에 넣기"를 눌러야 저장된다.
 * 동의하지 않은 사람에게는 무엇이 어디로 전송되는지 먼저 보이고, 동의해야 대화창이 열린다.
 */
export function AiChat({ consented, configured }: { consented: boolean; configured: boolean }) {
  const t = useT(aichat);
  if (!configured) return <p role="note" className="rounded-2xl bg-surface p-5 text-sm leading-relaxed text-muted">{t("notConfigured")}</p>;
  return (
    <div className="flex flex-col gap-4">
      {/* 건강·정확성 안내는 늘 보이되 작게 둔다(상자로 크게 두면 대화창을 밀어낸다). */}
      <p role="note" className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted">
        <svg aria-hidden width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
          <circle cx={12} cy={12} r={9} />
          <path d="M12 11v5 M12 8h.01" />
        </svg>
        <span>{t("disclaimer")}</span>
      </p>
      {consented ? <Conversation /> : <Consent />}
    </div>
  );
}

function Consent() {
  const t = useT(aichat);
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [pending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      await acceptAiChatConsent();
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="ai-consent-title" className="flex flex-col gap-4 rounded-2xl bg-surface p-5">
      <h2 id="ai-consent-title" className="text-base font-bold">
        {t("consentTitle")}
      </h2>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
        {(["consent1", "consent2", "consent3", "consent4", "consent5"] as const).map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="size-5 accent-brand" />
        {t("consentCheck")}
      </label>
      <button
        type="button"
        disabled={!checked || pending}
        onClick={accept}
        className="h-12 rounded-xl bg-brand text-sm font-semibold text-brand-contrast disabled:opacity-50"
      >
        {pending ? t("consentSaving") : t("consentStart")}
      </button>
    </section>
  );
}

/** 도우미 얼굴. 말풍선 왼쪽과 "생각하는 중" 옆에 둔다. */
function AssistantFace() {
  return (
    <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle">
      <Dori avatar size={32} mood="happy" />
    </span>
  );
}

function Conversation() {
  const t = useT(aichat);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  // 입력창은 쓴 만큼 늘어난다(여섯 줄쯤에서 멈추고 안에서 스크롤한다).
  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 144)}px`;
  }, [input]);

  function errorMessage(response: Extract<ChatResponse, { ok: false }>): { text: string; canRetry: boolean } {
    switch (response.error) {
      case "busy":
        return { text: t("errorBusy"), canRetry: true };
      case "limit-burst":
        return { text: t("errorBurst", { seconds: response.retryAfter ?? 10 }), canRetry: true };
      case "limit-day":
        return { text: t("errorDay"), canRetry: false };
      case "blocked":
        return { text: t("errorBlocked"), canRetry: false };
      case "unavailable":
        return { text: t("errorUnavailable"), canRetry: true };
      case "format":
        return { text: t("errorFormat"), canRetry: true };
      case "not-configured":
        return { text: t("notConfigured"), canRetry: false };
      case "login":
        return { text: t("errorLogin"), canRetry: false };
      case "server":
        return { text: t("errorServer"), canRetry: true };
      default:
        return { text: t("errorGeneric"), canRetry: true };
    }
  }

  function addError(text: string, code: string | undefined, canRetry: boolean) {
    setMessages((current) => [...current, { id: nextId.current++, role: "assistant", text, isError: true, code, canRetry }]);
  }

  /** `history`의 맨 끝은 내 말이다. 서버는 이 대화를 저장하지 않고 그때그때 받는다. */
  async function ask(history: Message[]) {
    setPending(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // 오류 말풍선은 AI가 한 말이 아니므로 대화에 싣지 않는다.
        body: JSON.stringify({ messages: history.filter((message) => !message.isError).map((message) => ({ role: message.role, text: message.text })) }),
      });
      // JSON이 아닌 답(앞단이 오류 화면으로 바꾼 것 등)이면 HTTP 상태를 코드로 보여 원인을 좁힐 수 있게 한다.
      const data = (await response.json().catch(() => null)) as ChatResponse | null;
      if (data?.ok) {
        const proposal = data.todos.length > 0 || data.events.length > 0 ? { todos: data.todos, events: data.events } : undefined;
        setMessages((current) => [...current, { id: nextId.current++, role: "assistant", text: data.reply, proposal, applied: proposal ? { state: "idle" } : undefined }]);
      } else if (data && typeof data.error === "string") {
        const failed = errorMessage(data);
        addError(failed.text, data.code, failed.canRetry);
      } else {
        addError(t("errorGeneric"), `http-${response.status}`, true);
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : "unknown";
      console.error("[ai] 대화를 보내지 못했다.", name);
      addError(t("errorGeneric"), `network-${name}`, true);
    } finally {
      setPending(false);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const history = [...messages, { id: nextId.current++, role: "user" as const, text: trimmed }];
    setMessages(history);
    setInput("");
    await ask(history);
  }

  /** 맨 끝의 오류 말풍선을 치우고 마지막 내 말을 그대로 다시 보낸다(내 말이 두 번 쌓이지 않는다). */
  function retry() {
    if (pending) return;
    const kept = [...messages];
    while (kept.length > 0 && kept[kept.length - 1].isError) kept.pop();
    if (kept.length === 0 || kept[kept.length - 1].role !== "user") return;
    setMessages(kept);
    void ask(kept);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  function setApplied(id: number, applied: Applied) {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, applied } : message)));
  }

  const lastId = messages.length > 0 ? messages[messages.length - 1].id : null;

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-2 pt-1 text-center">
            <Dori mood="hello" size={88} />
            <h2 className="text-lg font-bold">{t("welcome")}</h2>
            <p className="text-sm leading-relaxed text-muted">{t("intro")}</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="px-1 text-xs font-semibold text-muted">{t("suggestionsLabel")}</p>
            <ul className="flex flex-col gap-2">
              {(["suggestion1", "suggestion2", "suggestion3"] as const).map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => void send(t(key))}
                    className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left text-sm leading-relaxed transition-transform active:scale-[0.98]"
                  >
                    <span className="flex-1">{t(key)}</span>
                    <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
                      <path d="M9 5 L16 12 L9 19" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setMessages([])}
              disabled={pending}
              className="flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-xs font-semibold text-muted transition-transform active:scale-95 disabled:opacity-50"
            >
              <svg aria-hidden width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14 M5 12h14" />
              </svg>
              {t("newChat")}
            </button>
          </div>
          <div role="log" aria-label={t("conversation")} aria-live="polite" className="flex flex-col gap-4">
            {messages.map((message) => (
              <Bubble
                key={message.id}
                message={message}
                onApplied={(applied) => setApplied(message.id, applied)}
                onRetry={message.isError && message.canRetry && message.id === lastId && !pending ? retry : undefined}
              />
            ))}
            {pending && (
              <div role="status" className="flex items-start gap-2">
                <AssistantFace />
                <span className="flex h-10 items-center gap-1.5 rounded-2xl rounded-tl-md bg-surface px-4">
                  {[0, 1, 2].map((index) => (
                    <span key={index} aria-hidden className="size-1.5 animate-bounce rounded-full bg-muted motion-reduce:animate-none" style={{ animationDelay: `${index * 150}ms` }} />
                  ))}
                </span>
                <span className="sr-only">{t("thinking")}…</span>
              </div>
            )}
            {/* 아래 입력창과 하단 탭에 가리지 않도록 끝을 더 위로 맞춘다. */}
            <div ref={end} className="scroll-mb-40" />
          </div>
        </>
      )}

      {/* 하단 탭(높이 56px+테두리)이 같은 아래 끝에 붙어 있어서, 입력창은 탭 위에 붙인다. 예전에는 탭 뒤로 가려졌다. */}
      <form
        onSubmit={onSubmit}
        className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-10 flex items-end gap-2 rounded-3xl bg-surface p-2 shadow-lg ring-1 ring-border focus-within:ring-2 focus-within:ring-brand"
      >
        <label className="sr-only" htmlFor="ai-input">
          {t("inputLabel")}
        </label>
        <textarea
          ref={field}
          id="ai-input"
          value={input}
          maxLength={2000}
          rows={1}
          disabled={pending}
          placeholder={t("inputPlaceholder")}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            // Enter는 보내기, Shift+Enter는 줄바꿈. 한글 입력 중(조합 중)의 Enter는 보내지 않는다.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send(input);
            }
          }}
          className="min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] leading-6 outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          aria-label={t("send")}
          disabled={pending || input.trim() === ""}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-contrast transition-transform active:scale-90 disabled:opacity-40"
        >
          <svg aria-hidden width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5 M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function Bubble({ message, onApplied, onRetry }: { message: Message; onApplied: (applied: Applied) => void; onRetry?: () => void }) {
  const t = useT(aichat);
  if (message.role === "user") {
    return (
      <div role="group" aria-label={t("you")} className="flex animate-rise justify-end">
        <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] leading-relaxed text-brand-contrast">{message.text}</p>
      </div>
    );
  }
  return (
    <div role="group" aria-label={t("assistant")} className="flex animate-rise items-start gap-2">
      <AssistantFace />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <p
          className={`max-w-[92%] whitespace-pre-line rounded-2xl rounded-tl-md px-4 py-2.5 text-[15px] leading-relaxed ${
            message.isError ? "bg-danger/10 text-danger" : "bg-surface"
          }`}
        >
          {message.text}
        </p>
        {message.isError && (message.code || onRetry) && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            {onRetry && (
              <button type="button" onClick={onRetry} className="h-9 rounded-full bg-surface px-4 text-xs font-semibold transition-transform active:scale-95">
                {t("retry")}
              </button>
            )}
            {message.code && <span className="text-[11px] text-muted">{t("errorCode", { code: message.code })}</span>}
          </div>
        )}
        {message.proposal && message.applied && <ProposalCard proposal={message.proposal} applied={message.applied} onApplied={onApplied} />}
      </div>
    </div>
  );
}

function ProposalCard({ proposal, applied, onApplied }: { proposal: Proposal; applied: Applied; onApplied: (applied: Applied) => void }) {
  const t = useT(aichat);
  const locale = useLocale();
  // 고르지 않은 것만 담는다(처음에는 모두 고른 상태).
  const [off, setOff] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const picked = {
    todos: proposal.todos.filter((_, index) => !off.has(`t${index}`)),
    events: proposal.events.filter((_, index) => !off.has(`e${index}`)),
  };
  const count = picked.todos.length + picked.events.length;

  const when = (value: string) => {
    const date = parseKSTDate(value);
    return `${formatMonthDay(locale, date)} (${weekdayName(locale, weekdayKST(date))})`;
  };

  function toggle(key: string) {
    setOff((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function add() {
    if (count === 0) {
      onApplied({ state: "failed", message: t("addInvalid") });
      return;
    }
    onApplied({ state: "adding" });
    startTransition(async () => {
      try {
        const result = await applyAiPlan(picked);
        if (result.ok) onApplied({ state: "added", todos: result.todos, events: result.events, batchIds: result.batchIds });
        else onApplied({ state: "failed", message: result.reason === "partial" ? t("addPartial") : result.reason === "invalid" ? t("addInvalid") : t("addRejected") });
      } catch (error) {
        console.error("[ai] 제안을 저장하지 못했다.", error instanceof Error ? error.name : error);
        onApplied({ state: "failed", message: t("errorGeneric") });
      }
    });
  }

  function undo(batchIds: string[]) {
    startTransition(async () => {
      try {
        const result = await undoAiPlan(batchIds);
        onApplied(result.ok ? { state: "undone" } : { state: "failed", message: t("undoFailed") });
      } catch (error) {
        console.error("[ai] 되돌리지 못했다.", error instanceof Error ? error.name : error);
        onApplied({ state: "failed", message: t("undoFailed") });
      }
    });
  }

  return (
    <section aria-label={t("proposalTitle")} className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold">{t("proposalTitle")}</h3>
      {proposal.todos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-muted">{t("todosTitle")}</p>
          <ul className="flex flex-col gap-1">
            {proposal.todos.map((todo, index) => (
              <li key={`t${index}`}>
                <label className="flex items-start gap-3 py-1 text-sm leading-relaxed">
                  <input type="checkbox" checked={!off.has(`t${index}`)} onChange={() => toggle(`t${index}`)} disabled={applied.state !== "idle" && applied.state !== "failed"} className="mt-0.5 size-5 shrink-0 accent-brand" />
                  <span>
                    <span className="text-muted">{when(todo.date)}</span> {todo.content}
                    <span className="text-xs text-muted"> · {todo.category ?? t("uncategorized")}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {proposal.events.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-muted">{t("eventsTitle")}</p>
          <ul className="flex flex-col gap-1">
            {proposal.events.map((event, index) => (
              <li key={`e${index}`}>
                <label className="flex items-start gap-3 py-1 text-sm leading-relaxed">
                  <input type="checkbox" checked={!off.has(`e${index}`)} onChange={() => toggle(`e${index}`)} disabled={applied.state !== "idle" && applied.state !== "failed"} className="mt-0.5 size-5 shrink-0 accent-brand" />
                  <span>
                    <span className="text-muted">{event.startDate === event.endDate ? when(event.startDate) : `${when(event.startDate)} ~ ${when(event.endDate)}`}</span>
                    {event.startTime ? <span className="text-muted"> {event.startTime}{event.endTime ? `-${event.endTime}` : ""}</span> : null} {event.title}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(applied.state === "idle" || applied.state === "failed" || applied.state === "adding") && (
        <button type="button" onClick={add} disabled={pending || applied.state === "adding"} className="h-11 rounded-xl bg-brand text-sm font-semibold text-brand-contrast disabled:opacity-60">
          {applied.state === "adding" ? t("adding") : t("addToModori", { count })}
        </button>
      )}
      {applied.state === "failed" && (
        <p role="alert" className="text-sm leading-relaxed text-danger">
          {applied.message}
        </p>
      )}
      {applied.state === "added" && (
        <div className="flex flex-col gap-2">
          <p role="status" className="text-sm font-medium">
            {t("added", { todos: applied.todos, events: applied.events })}
          </p>
          <button type="button" onClick={() => undo(applied.batchIds)} disabled={pending} className="h-10 self-start rounded-xl bg-surface-hover px-4 text-sm font-semibold disabled:opacity-60">
            {t("undo")}
          </button>
        </div>
      )}
      {applied.state === "undone" && (
        <p role="status" className="text-sm text-muted">
          {t("undone")}
        </p>
      )}
    </section>
  );
}
