/**
 * LlmProvider — interface for structured output extraction from natural language.
 *
 * Every adapter must convert the request to a structured JSON object matching
 * the environment values schema. The adapter is NOT responsible for validation;
 * the caller validates and may retry once with error context.
 */
export interface LlmProvider {
  readonly name: string;

  /**
   * Complete a structured-output request.
   * @param systemPrompt — platform-controlled system prompt (never user-editable)
   * @param userMessage — the developer's natural-language request
   * @param schema — JSON Schema the output must conform to (for providers that support it)
   * @returns parsed JSON object (not validated yet) or a refusal string
   */
  complete(
    systemPrompt: string,
    userMessage: string,
    schema: Record<string, unknown>,
  ): Promise<LlmResult>;

  /** Lightweight connectivity check: send a 1-token prompt. */
  healthCheck(): Promise<HealthResult>;
}

export type LlmResult =
  | { ok: true; data: Record<string, unknown>; rawResponse?: string }
  | { ok: false; error: string; rawResponse?: string };

export interface HealthResult {
  healthy: boolean;
  message: string;
  latencyMs?: number;
}
