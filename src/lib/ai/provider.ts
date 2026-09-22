/**
 * The boundary between the app and whichever language model is available.
 *
 * Everything above this file works in terms of `complete()` and knows nothing
 * about who answers it. That matters for three reasons: the free tiers we rely
 * on have rate limits and we need somewhere to fall back to, a judged demo must
 * not depend on one vendor being reachable, and swapping providers should not
 * mean touching the prompts.
 *
 * Providers are selected by which credentials are present. If none are, callers
 * get `null` and fall back to the deterministic path.
 */

export interface CompletionRequest {
  system: string;
  user: string;
  /**
   * A JSON schema the reply must satisfy. When present the provider asks for
   * JSON, but the reply is still parsed and validated on our side afterwards —
   * a model claiming to follow a schema is not the same as it having done so.
   */
  schema?: Record<string, unknown>;
  maxOutputTokens?: number;
}

export interface AiProvider {
  readonly name: string;
  complete(request: CompletionRequest, signal?: AbortSignal): Promise<string>;
}

/** How long to wait before giving up and using the deterministic path. */
export const AI_TIMEOUT_MS = 12_000;

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/**
 * Picks a provider from the environment.
 *
 * Gemini first because its free tier is the more generous of the two; GitHub
 * Models second because any GitHub account already has access, which makes it a
 * realistic backup during a hackathon. Returns null when neither is configured,
 * which is a supported state rather than an error.
 */
export async function resolveProvider(): Promise<AiProvider | null> {
  if (process.env.GEMINI_API_KEY) {
    const { createGeminiProvider } = await import("./providers/gemini");
    return createGeminiProvider(process.env.GEMINI_API_KEY);
  }

  if (process.env.GITHUB_MODELS_TOKEN) {
    const { createGitHubModelsProvider } = await import("./providers/github-models");
    return createGitHubModelsProvider(process.env.GITHUB_MODELS_TOKEN);
  }

  return null;
}

/** Runs a request with a timeout, so a slow provider cannot hang a page. */
export async function completeWithTimeout(
  provider: AiProvider,
  request: CompletionRequest,
  timeoutMs: number = AI_TIMEOUT_MS,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await provider.complete(request, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pulls the first JSON object or array out of a reply.
 *
 * Models asked for JSON sometimes wrap it in a fenced code block or add a line
 * of commentary. Rather than fail on that, take the first balanced structure
 * and let the schema decide whether it is acceptable.
 */
export function extractJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.search(/[[{]/);
    if (start === -1) throw new AiUnavailableError("No JSON found in the reply");

    const opening = trimmed[start];
    const closing = opening === "{" ? "}" : "]";
    const end = trimmed.lastIndexOf(closing);
    if (end <= start) throw new AiUnavailableError("Truncated JSON in the reply");

    return JSON.parse(trimmed.slice(start, end + 1));
  }
}
