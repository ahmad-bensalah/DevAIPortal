import _Ajv from 'ajv';
import _addFormats from 'ajv-formats';
import type { LlmProvider } from '../providers/llm-provider.js';
import { SYSTEM_PROMPT } from '../prompt/system.js';

const Ajv = (_Ajv as any).default || _Ajv;
const addFormats = (_addFormats as any).default || _addFormats;

export interface ExtractionResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  attempts: number;
}

export class ParameterExtractor {
  private readonly provider: LlmProvider;
  private readonly schema: Record<string, unknown>;
  private readonly ajv: any;

  constructor(provider: LlmProvider, schema: Record<string, unknown>) {
    this.provider = provider;
    this.schema = schema;
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
  }

  async extract(userMessage: string, requestId: string, owner: string): Promise<ExtractionResult> {
    const validate = this.ajv.compile(this.schema);

    // First attempt
    let result = await this.provider.complete(SYSTEM_PROMPT, userMessage, this.schema);
    let attempts = 1;

    if (!result.ok) {
      return { ok: false, error: result.error, attempts };
    }

    let candidate = {
      ...result.data,
      requestId,
      owner,
      expiresAt: (result.data as any).expiresAt || new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
    };

    if (validate(candidate)) {
      return { ok: true, data: candidate, attempts };
    }

    // Auto-repair retry with validation error feedback
    attempts++;
    const errors = (validate.errors || []).map((e: any) => `${e.instancePath || 'root'}: ${e.message}`).join(', ');
    const repairPrompt = `${SYSTEM_PROMPT}\n\nIMPORTANT: Your previous output had schema validation errors:\n${errors}\nFix these issues and return the corrected JSON object.`;

    const retryResult = await this.provider.complete(repairPrompt, userMessage, this.schema);
    if (!retryResult.ok) {
      return { ok: false, error: retryResult.error, attempts };
    }

    candidate = {
      ...retryResult.data,
      requestId,
      owner,
      expiresAt: (retryResult.data as any).expiresAt || new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
    };

    if (validate(candidate)) {
      return { ok: true, data: candidate, attempts };
    }

    return {
      ok: false,
      error: `Validation failed after 2 attempts: ${errors}`,
      attempts,
    };
  }
}
