/**
 * Gemini, over its REST API.
 *
 * Called with `fetch` rather than through an SDK deliberately: the request is
 * small enough to read at a glance, there is one fewer dependency to keep in
 * step, and the exact bytes going to a third party are visible in the file.
 *
 * The key travels in the `x-goog-api-key` header and never in the query string,
 * so it cannot end up in a proxy log or a browser history.
 */

import {
  AiUnavailableError,
  type AiProvider,
  type CompletionRequest,
} from "../provider";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Overridable because free-tier model availability changes. */
const DEFAULT_MODEL = "gemini-2.5-flash";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

export function createGeminiProvider(apiKey: string): AiProvider {
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

  return {
    name: `gemini:${model}`,

    async complete(request: CompletionRequest, signal?: AbortSignal) {
      const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.user }] }],
          generationConfig: {
            // A low temperature: compiling a sentence into a fixed set of
            // adjustments is an extraction task, not a creative one.
            temperature: 0.2,
            maxOutputTokens: request.maxOutputTokens ?? 1024,
            ...(request.schema
              ? {
                  responseMimeType: "application/json",
                  responseSchema: request.schema,
                }
              : {}),
          },
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new AiUnavailableError(
          `Gemini returned ${response.status}: ${detail.slice(0, 200)}`,
        );
      }

      const body = (await response.json()) as GeminiResponse;

      if (body.promptFeedback?.blockReason) {
        throw new AiUnavailableError(
          `Gemini blocked the prompt: ${body.promptFeedback.blockReason}`,
        );
      }

      const text = body.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!text) {
        throw new AiUnavailableError("Gemini returned an empty reply");
      }

      return text;
    },
  };
}
