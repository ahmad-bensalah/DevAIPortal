import type { LlmProvider, LlmResult, HealthResult } from './llm-provider.js';

export interface OpenAIConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * OpenAiProvider
 * Communicates with standard OpenAI API endpoints (e.g. OpenAI official, Groq, LiteLLM)
 * uses strict structured outputs (JSON schema response_format).
 */
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;

  constructor(config: OpenAIConfig = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = (config.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model = config.model || 'gpt-4o';
    this.temperature = config.temperature ?? 0;
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async complete(
    systemPrompt: string,
    userMessage: string,
    schema: Record<string, unknown>
  ): Promise<LlmResult> {
    if (!this.apiKey && !process.env.MOCK_TEST) {
      return { ok: false, error: 'OPENAI_API_KEY is not configured' };
    }

    try {
      const payload = {
        model: this.model,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'environment_parameters',
            strict: true,
            schema,
          },
        },
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: `OpenAI API error (${response.status}): ${errorText}` };
      }

      const resData = (await response.json()) as any;
      const content = resData.choices?.[0]?.message?.content;
      if (!content) {
        return { ok: false, error: 'Empty response content from OpenAI model' };
      }

      const parsed = JSON.parse(content);
      return { ok: true, data: parsed, rawResponse: content };
    } catch (err) {
      return { ok: false, error: `OpenAI completion network error: ${(err as Error).message}` };
    }
  }

  async healthCheck(): Promise<HealthResult> {
    if (!this.apiKey) {
      return { healthy: false, message: 'OPENAI_API_KEY is not configured in environment' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return {
        healthy: response.ok,
        message: response.ok ? 'OpenAI endpoint authenticated and accessible' : `Auth failed: HTTP ${response.status}`,
      };
    } catch (err) {
      return { healthy: false, message: `Failed to connect to OpenAI endpoint: ${(err as Error).message}` };
    }
  }
}
