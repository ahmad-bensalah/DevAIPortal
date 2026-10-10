import type {
  Notifier,
  NotifyEvent,
  NotifyResult,
  HealthResult,
} from './notifier.js';

/**
 * Console notifier — prints events to stdout.
 * For local development and demo mode. No credentials needed.
 */
export class ConsoleNotifier implements Notifier {
  readonly name = 'console';

  async send(event: NotifyEvent): Promise<NotifyResult> {
    const prefix = this.eventPrefix(event.type);
    const lines = [
      `${prefix} [${event.type}] ${event.environmentName}`,
      `  Owner: ${event.owner}${event.team ? ` (team: ${event.team})` : ''}`,
      `  Request: ${event.requestId}`,
    ];
    if (event.expiresAt) lines.push(`  Expires: ${event.expiresAt}`);
    if (event.prUrl) lines.push(`  PR: ${event.prUrl}`);
    if (event.detail) lines.push(`  Detail: ${event.detail}`);

    console.log(lines.join('\n'));
    return { ok: true };
  }

  async healthCheck(): Promise<HealthResult> {
    return { healthy: true, message: 'Console notifier is always healthy' };
  }

  private eventPrefix(type: string): string {
    switch (type) {
      case 'environment.created': return '✓';
      case 'environment.expiry_warning': return '⏰';
      case 'environment.deleted': return '🗑';
      case 'environment.error': return '✗';
      case 'environment.approval_needed': return '⏳';
      case 'environment.extended': return '↻';
      default: return '•';
    }
  }
}
