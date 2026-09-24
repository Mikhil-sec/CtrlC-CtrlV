"use client";

/**
 * The sandbox assistant.
 *
 * A conversation, not a search box: follow-ups are read in context, and every
 * answer that changes something is applied straight to the sandbox controls,
 * so the person watches the sliders move and the goal dates respond rather
 * than reading a paragraph about it. Goal targets come back as a short menu of
 * verified options, any of which can be tried with one click.
 */

import * as React from "react";
import {
  ArrowUp,
  Check,
  CircleSlash,
  Loader2,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  AssistantReply,
  ConversationTurn,
  GoalSeekOption,
  Goal,
  PlanResult,
  Scenario,
} from "@/lib/contract/types";
import { monthOf } from "@/lib/engine";
import { monthLabel, monthLabelLong } from "@/lib/format";
import { cn } from "@/lib/utils";

type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; reply: AssistantReply }
  | { id: string; role: "error"; text: string };

/** Turns sent back with each question. Enough for a follow-up, not a transcript. */
const HISTORY_TURNS = 6;

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toHistory(messages: Message[]): ConversationTurn[] {
  return messages
    .flatMap((message): ConversationTurn[] => {
      if (message.role === "user") return [{ role: "user", text: message.text }];
      if (message.role === "assistant") {
        const { headline, text } = message.reply;
        return [
          { role: "assistant", text: [headline, text].filter(Boolean).join(". ") },
        ];
      }
      return [];
    })
    .slice(-HISTORY_TURNS)
    .map((turn) => ({ ...turn, text: turn.text.slice(0, 400) }));
}

/** Starter questions built from this person's own plan, so they always make sense. */
function suggestionsFor(goals: Goal[], plan: PlanResult): string[] {
  const suggestions: string[] = [];
  const late = plan.goals.find(
    (p) => p.status === "at_risk" || p.status === "off_track",
  );
  const lateGoal = late && goals.find((g) => g.id === late.goalId);
  if (lateGoal) {
    suggestions.push(
      `Can I still have the ${lateGoal.name.toLowerCase()} by ${monthLabelLong(monthOf(lateGoal.targetDate))}?`,
    );
  }
  const other = goals.find((g) => g.id !== lateGoal?.id);
  if (other) {
    suggestions.push(
      `What would it take to get the ${other.name.toLowerCase()} 3 months sooner?`,
    );
  }
  suggestions.push(
    "What if I cut eating out by a third?",
    "What if my salary went up 10%?",
  );
  if (goals.length > 1) suggestions.push("Which goal is most at risk, and why?");
  return suggestions.slice(0, 4);
}

function SourceBadge({ source }: { source: AssistantReply["source"] }) {
  return source === "model" ? (
    <Badge
      variant="accent"
      title="Read by a language model; every figure is computed by the engine"
    >
      AI
    </Badge>
  ) : (
    <Badge
      variant="neutral"
      title="The AI was unavailable, so a keyword reader handled this. Figures are still computed by the engine."
    >
      Offline reader
    </Badge>
  );
}

function OptionButton({
  option,
  active,
  onPick,
}: {
  option: GoalSeekOption;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        active
          ? "border-accent bg-accent-soft/60"
          : "border-border hover:border-accent/50 hover:bg-surface",
        !option.feasible && "opacity-70",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          active ? "border-accent bg-accent text-accent-foreground" : "border-border",
        )}
      >
        {active && <Check className="size-3" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center justify-between gap-x-2">
          <span className="font-medium">{option.label}</span>
          <span
            className={cn(
              "text-xs tabular-nums",
              option.feasible ? "text-success" : "text-muted",
            )}
          >
            {option.feasible
              ? `ready ${option.fundedMonth ? monthLabel(option.fundedMonth) : ""}`
              : "not enough alone"}
          </span>
        </span>
        <span className="text-muted text-xs">{option.detail}</span>
      </span>
    </button>
  );
}

function AssistantBubble({
  reply,
  activeScenarioId,
  onApply,
}: {
  reply: AssistantReply;
  activeScenarioId: string | null;
  onApply: (scenario: Scenario) => void;
}) {
  const applied =
    reply.kind === "scenario" &&
    reply.scenario &&
    activeScenarioId === reply.scenario.id;

  return (
    <div className="rise-in flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs">
        {reply.kind === "off_topic" ? (
          <CircleSlash className="text-muted size-3.5" />
        ) : (
          <Sparkles className="text-accent size-3.5" />
        )}
        <span className="text-muted font-medium">GoalPath</span>
        <SourceBadge source={reply.source} />
      </div>
      <div className="bg-surface flex flex-col gap-2 rounded-2xl rounded-tl-sm px-4 py-3">
        {reply.headline && <p className="text-sm font-semibold">{reply.headline}</p>}
        <p className="text-sm/relaxed">{reply.text}</p>

        {reply.seek && reply.seek.options.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-1">
            {reply.seek.options.map((option) => (
              <OptionButton
                key={option.lever}
                option={option}
                active={activeScenarioId === option.scenario.id}
                onPick={() => onApply(option.scenario)}
              />
            ))}
          </div>
        )}

        {reply.kind === "scenario" && reply.scenario && (
          <div className="flex items-center justify-between gap-2 pt-1 text-xs">
            {applied ? (
              <span className="text-success flex items-center gap-1">
                <Check className="size-3.5" /> Showing in the sandbox
              </span>
            ) : (
              <Button
                size="sm"
                variant="subtle"
                onClick={() => onApply(reply.scenario!)}
              >
                <WandSparkles /> Show this again
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Assistant({
  goals,
  plan,
  storageKey,
  activeScenarioId,
  onApply,
}: {
  goals: Goal[];
  plan: PlanResult;
  /** Where the conversation is kept for this tab, scoped to the account. */
  storageKey: string;
  activeScenarioId: string | null;
  onApply: (scenario: Scenario) => void;
}) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const restored = React.useRef(false);

  // The conversation survives moving between pages in the same tab, and is
  // gone when the tab closes. Session storage, not local: a finance chat is
  // not something to leave lying around on a shared computer.
  React.useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setMessages(JSON.parse(saved) as Message[]);
    } catch {
      // Unreadable or unavailable storage just means a fresh conversation.
    }
    restored.current = true;
  }, [storageKey]);

  React.useEffect(() => {
    if (!restored.current) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    } catch {
      // Best-effort.
    }
  }, [messages, storageKey]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  // "/" jumps to the question box from anywhere on the page, the way it does
  // in most search-first tools.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function applyFrom(reply: AssistantReply) {
    if (reply.kind === "scenario" && reply.scenario) {
      onApply(reply.scenario);
    } else if (reply.kind === "goal_seek" && reply.seek) {
      const best = reply.seek.options.find((o) => o.feasible);
      if (best) onApply(best.scenario);
      else if (reply.scenario) onApply(reply.scenario);
    }
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 2 || loading) return;

    const history = toHistory(messages);
    setMessages((prev) => [...prev, { id: newId(), role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, locale: "en", history }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "error",
            text: body?.error?.message ?? "That couldn't be answered right now.",
          },
        ]);
        return;
      }

      const reply = body.data as AssistantReply;
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", reply }]);
      applyFrom(reply);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "error",
          text: "Couldn't reach the server. Check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const lastQuestion = [...messages].reverse().find((m) => m.role === "user");
  const suggestions = suggestionsFor(goals, plan);

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="border-border flex items-center justify-between gap-2 border-b px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="bg-accent text-accent-foreground flex size-6 items-center justify-center rounded-md">
            <Sparkles className="size-3.5" />
          </span>
          <h3 className="text-sm font-semibold">Ask your plan</h3>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="border-border text-muted hidden rounded border px-1.5 text-[10px] sm:inline">
            /
          </kbd>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Clear conversation"
              title="Clear conversation"
              onClick={() => setMessages([])}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex max-h-[30rem] min-h-40 flex-col gap-4 overflow-y-auto px-5 py-4"
        aria-live="polite"
      >
        {messages.length === 0 && !loading && (
          <div className="flex flex-col gap-3">
            <p className="text-muted text-sm">
              Ask about a change, or name a goal and a date. I&apos;ll set up the
              sandbox to show you — every figure comes from the same engine as the
              sliders.
            </p>
            <div className="flex flex-col items-start gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="border-border text-foreground/80 hover:border-accent/50 hover:bg-surface hover:text-foreground rounded-full border px-3 py-1 text-left text-xs transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) =>
          message.role === "user" ? (
            <div
              key={message.id}
              className="bg-accent text-accent-foreground rise-in max-w-[85%] self-end rounded-2xl rounded-tr-sm px-4 py-2 text-sm"
            >
              {message.text}
            </div>
          ) : message.role === "error" ? (
            <p
              key={message.id}
              className="bg-danger-soft text-danger rise-in rounded-lg px-3 py-2 text-sm"
            >
              {message.text}
            </p>
          ) : (
            <AssistantBubble
              key={message.id}
              reply={message.reply}
              activeScenarioId={activeScenarioId}
              onApply={onApply}
            />
          ),
        )}

        {loading && (
          <div
            className="text-muted flex items-center gap-1 px-1"
            aria-label="Thinking"
          >
            <span className="typing-dot bg-muted size-1.5 rounded-full" />
            <span className="typing-dot bg-muted size-1.5 rounded-full" />
            <span className="typing-dot bg-muted size-1.5 rounded-full" />
          </div>
        )}
      </div>

      <form
        className="border-border flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <textarea
          ref={inputRef}
          value={question}
          rows={1}
          maxLength={500}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(question);
            } else if (
              e.key === "ArrowUp" &&
              !question &&
              lastQuestion?.role === "user"
            ) {
              // Recall the last question to tweak it, like a shell.
              e.preventDefault();
              setQuestion(lastQuestion.text);
            } else if (e.key === "Escape") {
              setQuestion("");
            }
          }}
          placeholder={
            messages.length === 0
              ? "Can I have the Japan trip by December?"
              : "Ask a follow-up…"
          }
          aria-label="Ask a question about your plan"
          disabled={loading}
          className="border-border bg-surface-raised placeholder:text-muted focus-visible:ring-ring max-h-32 min-h-10 flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading || question.trim().length < 2}
          aria-label="Ask"
        >
          {loading ? <Loader2 className="animate-spin" /> : <ArrowUp />}
        </Button>
      </form>
    </Card>
  );
}
