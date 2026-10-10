import type { LlmProvider, LlmResult, HealthResult } from './llm-provider.js';

export interface AzureOpenAIConfig {
  apiKey?: string;
  endpoint?: string;
  deployment?: string;
  apiVersion?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * AzureOpenAiProvider
 * Communicates with Azure OpenAI Service private deployments
 * using native api-key authentication and structured outputs.
 */
export class AzureOpenAiProvider implements LlmProvider {
  readonly name = 'azure-openai';

  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly deployment: string;
  private readonly apiVersion: string;
  private readonly temperature: number;
  private readonly maxTokens: number;

  constructor(config: AzureOpenAIConfig = {}) {
    this.apiKey = config.apiKey || process.env.AZURE_OPENAI_API_KEY || '';
    this.endpoint = (config.endpoint || process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '');
    this.deployment = config.deployment || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    this.apiVersion = config.apiVersion || process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
    this.temperature = config.temperature ?? 0;
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async complete(
    systemPrompt: string,
    userMessage: string,
    schema: Record<string, unknown>
  ): Promise<LlmResult> {
    if (!this.apiKey || !this.endpoint) {
      return { ok: false, error: 'AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT is not configured' };
    }

    const url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;

    try {
      const payload = {
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

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: `Azure OpenAI error (${response.status}): ${errorText}` };
      }

      const resData = (await response.json()) as any;
      const content = resData.choices?.[0]?.message?.content;
      if (!content) {
        return { ok: false, error: 'Empty response content from Azure OpenAI deployment' };
      }

      const parsed = JSON.parse(content);
      return { ok: true, data: parsed, rawResponse: content };
    } catch (err) {
      return { ok: false, error: `Azure OpenAI network exception: ${(err as Error).message}` };
    }
  }

  async healthCheck(): Promise<HealthResult> {
    if (!this.apiKey || !this.endpoint) {
      return { healthy: false, message: 'Azure OpenAI credentials missing in environment' };
    }

    const testUrl = `${this.endpoint}/openai/models?api-version=${this.apiVersion}`;
    try {
      const response = await fetch(testUrl, {
        headers: { 'api-key': this.apiKey },
      });
      return {
        healthy: response.ok,
        message: response.ok ? 'Azure OpenAI endpoint authenticated' : `Azure returned HTTP ${response.status}`,
      };
    } catch (err) {
      return { healthy: false, message: `Azure OpenAI connection failed: ${(err as Error).message}` };
    }
  }
}
