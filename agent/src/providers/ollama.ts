import type { LlmProvider, LlmResult, HealthResult } from './llm-provider.js';

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
  temperature?: number;
}

/**
 * OllamaProvider
 * Connects to local air-gapped Ollama instance (e.g. llama3, qwen2.5-coder)
 * enforcing JSON schema validation format.
 */
export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama';

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly temperature: number;

  constructor(config: OllamaConfig = {}) {
    this.baseUrl = (config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
    this.model = config.model || 'llama3';
    this.temperature = config.temperature ?? 0;
  }

  async complete(
    systemPrompt: string,
    userMessage: string,
    schema: Record<string, unknown>
  ): Promise<LlmResult> {
    try {
      const payload = {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        format: schema,
        options: {
          temperature: this.temperature,
        },
        stream: false,
      };

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return { ok: false, error: `Ollama server error: HTTP ${response.status}` };
      }

      const resData = (await response.json()) as any;
      const content = resData.message?.content;
      if (!content) {
        return { ok: false, error: 'Empty response content from Ollama' };
      }

      const parsed = JSON.parse(content);
      return { ok: true, data: parsed, rawResponse: content };
    } catch (err) {
      return { ok: false, error: `Failed to communicate with local Ollama: ${(err as Error).message}` };
    }
  }

  async healthCheck(): Promise<HealthResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return {
        healthy: response.ok,
        message: response.ok ? 'Ollama daemon is reachable locally' : `Ollama returned HTTP ${response.status}`,
      };
    } catch (err) {
      return { healthy: false, message: `Ollama is not running at ${this.baseUrl}` };
    }
  }
}
