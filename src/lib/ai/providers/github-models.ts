/**
 * GitHub Models, the backup provider.
 *
 * Worth having because every GitHub account can reach it with a personal access
 * token, so the app keeps working if the Gemini free tier rate-limits partway
 * through a demo. The wire format is OpenAI-compatible.
 *
 * Both the base URL and the model are read from the environment, since this is
 * the provider most likely to need adjusting without a code change.
 */

import {
  AiUnavailableError,
  type AiProvider,
  type CompletionRequest,
} from "../provider";

const DEFAULT_ENDPOINT = "https://models.github.ai/inference/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  error?: { message?: string };
}

export function createGitHubModelsProvider(token: string): AiProvider {
  const endpoint = process.env.GITHUB_MODELS_ENDPOINT ?? DEFAULT_ENDPOINT;
  const model = process.env.GITHUB_MODELS_MODEL ?? DEFAULT_MODEL;

  return {
    name: `github-models:${model}`,

    async complete(request: CompletionRequest, signal?: AbortSignal) {
      const response = await fetch(endpoint, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: request.maxOutputTokens ?? 1024,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          // This endpoint takes a mode rather than a schema, so the schema is
          // restated in the prompt and enforced by our own validation.
          ...(request.schema ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new AiUnavailableError(
          `GitHub Models returned ${response.status}: ${detail.slice(0, 200)}`,
        );
      }

      const body = (await response.json()) as ChatCompletionResponse;

      if (body.error?.message) {
        throw new AiUnavailableError(`GitHub Models: ${body.error.message}`);
      }

      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new AiUnavailableError("GitHub Models returned an empty reply");
      }

      return text;
    },
  };
}
