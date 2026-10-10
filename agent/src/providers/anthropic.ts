import type { LlmProvider, LlmResult, HealthResult } from './llm-provider.js';

export interface AnthropicConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * AnthropicProvider
 * Native integration for Claude 3.5 Sonnet / Haiku using tool-use structured JSON output.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';

  private readonly apiKey: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;

  constructor(config: AnthropicConfig = {}) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.temperature = config.temperature ?? 0;
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async complete(
    systemPrompt: string,
    userMessage: string,
    schema: Record<string, unknown>
  ): Promise<LlmResult> {
    if (!this.apiKey) {
      return { ok: false, error: 'ANTHROPIC_API_KEY is not configured' };
    }

    try {
      const payload = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        tools: [
          {
            name: 'submit_environment_parameters',
            description: 'Extract validated environment parameters from natural language request',
            input_schema: schema,
          },
        ],
        tool_choice: { type: 'tool', name: 'submit_environment_parameters' },
      };

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { ok: false, error: `Anthropic API error (${response.status}): ${errText}` };
      }

      const resData = (await response.json()) as any;
      const toolUse = resData.content?.find((c: any) => c.type === 'tool_use');
      if (!toolUse?.input) {
        return { ok: false, error: 'Anthropic did not return tool call input' };
      }

      return { ok: true, data: toolUse.input, rawResponse: JSON.stringify(resData) };
    } catch (err) {
      return { ok: false, error: `Anthropic network error: ${(err as Error).message}` };
    }
  }

  async healthCheck(): Promise<HealthResult> {
    if (!this.apiKey) {
      return { healthy: false, message: 'ANTHROPIC_API_KEY is not configured in environment' };
    }
    return { healthy: true, message: 'Anthropic API key is configured' };
  }
}
