import type {
  LlmProvider,
  LlmResult,
  HealthResult,
} from './llm-provider.js';

/**
 * Mock LLM that returns canned responses for demo and testing.
 * Parses the user message for keywords to select a blueprint and
 * fills in sensible defaults. Deterministic — no network calls.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';

  async complete(
    _systemPrompt: string,
    userMessage: string,
    _schema: Record<string, unknown>,
  ): Promise<LlmResult> {
    const lower = userMessage.toLowerCase();

    // Guardrail against adversarial requests
    if (
      lower.includes('cluster-admin') ||
      lower.includes('docker.sock') ||
      lower.includes('sys_admin') ||
      lower.includes('system override') ||
      lower.includes('hostpath') ||
      lower.includes('privileged') ||
      lower.includes('untrusted') ||
      lower.includes('system prompt')
    ) {
      return { ok: false, error: 'Request declined: unauthorized privileged or policy-violating operation detected' };
    }

    const data = this.extractParams(lower);
    return { ok: true, data };
  }

  async healthCheck(): Promise<HealthResult> {
    return { healthy: true, message: 'Mock LLM is always healthy' };
  }

  private extractParams(message: string): Record<string, unknown> {
    const blueprint = this.detectBlueprint(message);
    const name = this.extractName(message) || 'demo-app';
    const team = this.extractTeam(message) || 'platform';
    const ttlDays = this.extractTtl(message) || 3;
    const size = this.detectSize(message) || 'small';

    const base: Record<string, unknown> = {
      name,
      blueprint,
      owner: 'demo-user@example.com',
      team,
      size,
      expiresAt: new Date(Date.now() + (ttlDays || 3) * 86400 * 1000).toISOString(),
      image: 'docker.io/library/nginx:1.27',
    };

    if (blueprint === 'web') {
      base.port = 8080;
      base.ingress = true;
    } else if (blueprint === 'internal-service') {
      base.port = 8080;
    } else if (blueprint === 'batch') {
      base.schedule = '0 */6 * * *';
      base.command = ['/bin/sh', '-c', 'echo batch-done'];
    }

    return base;
  }

  private detectBlueprint(msg: string): string {
    if (msg.includes('cron') || msg.includes('batch') || msg.includes('job')) {
      return 'batch';
    }
    if (msg.includes('internal') || msg.includes('backend') || msg.includes('grpc')) {
      return 'internal-service';
    }
    return 'web';
  }

  private detectSize(msg: string): string {
    if (msg.includes('large') || msg.includes('heavy') || msg.includes('big')) {
      return 'large';
    }
    if (msg.includes('medium') || msg.includes('moderate')) {
      return 'medium';
    }
    return 'small';
  }

  private extractName(msg: string): string | null {
    // Look for quoted names or "called X" / "named X" patterns
    const quoted = msg.match(/["']([a-z][a-z0-9-]{2,39})["']/);
    if (quoted) return quoted[1];
    const named = msg.match(/(?:called|named|for)\s+([a-z][a-z0-9-]{2,39})/);
    if (named) return named[1];
    return null;
  }

  private extractTeam(msg: string): string | null {
    const match = msg.match(/(?:team|squad|group)\s+([a-z][a-z0-9-]{1,29})/);
    return match ? match[1] : null;
  }

  private extractTtl(msg: string): number | null {
    const match = msg.match(/(\d+)\s*(?:day|days)/);
    return match ? parseInt(match[1], 10) : null;
  }
}
