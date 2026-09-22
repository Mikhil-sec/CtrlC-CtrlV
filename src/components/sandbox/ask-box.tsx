"use client";

import * as React from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDelta } from "@/lib/engine";
import type { PlanDelta, Scenario } from "@/lib/contract/types";

interface ScenarioResponse {
  scenario: Scenario | null;
  source: "model" | "rules";
  note?: string;
  headline?: string;
  delta?: PlanDelta;
  explanation?: string;
  explanationSource?: "model" | "rules";
}

const SUGGESTIONS = [
  "What if I cut eating out by a third?",
  "What if my salary went up 10%?",
  "Fund the laptop before the emergency fund",
];

export function AskBox() {
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ScenarioResponse | null>(null);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, locale: "en" }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(
          body?.error?.message ?? "That question could not be answered right now.",
        );
        return;
      }

      setResult(body.data as ScenarioResponse);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="text-accent size-4" />
        <h3 className="text-sm font-semibold">Ask a what-if question</h3>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What if I cut eating out by a third?"
          disabled={loading}
        />
        <Button type="submit" size="icon" disabled={loading || !question.trim()}>
          {loading ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuestion(s);
              ask(s);
            }}
            disabled={loading}
            className="border-border text-muted hover:bg-surface hover:text-foreground rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <p className="bg-danger-soft text-danger rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {result && (
        <div className="bg-surface flex flex-col gap-2 rounded-lg p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              {result.headline ??
                result.note ??
                "No change could be worked out from that."}
            </span>
            <Badge variant={result.source === "model" ? "accent" : "neutral"}>
              {result.source === "model" ? "AI" : "Rules fallback"}
            </Badge>
          </div>
          {result.explanation && (
            <p className="text-muted text-sm">{result.explanation}</p>
          )}
          {result.delta && (
            <p className="text-muted text-sm tabular-nums">
              Surplus change: {formatDelta(result.delta.surplusDeltaMinor)} / month
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
