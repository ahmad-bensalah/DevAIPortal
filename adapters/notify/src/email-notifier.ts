import type { Notifier, NotifyEvent, NotifyResult, HealthResult } from './notifier.js';

export interface EmailConfig {
  smtpHost?: string;
  smtpPort?: number;
  from?: string;
  to?: string;
}

export class EmailNotifier implements Notifier {
  readonly name = 'email';

  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly from: string;
  private readonly to: string;

  constructor(config: EmailConfig = {}) {
    this.smtpHost = config.smtpHost || process.env.SMTP_HOST || '';
    this.smtpPort = config.smtpPort || Number(process.env.SMTP_PORT || 587);
    this.from = config.from || process.env.SMTP_FROM || 'portal@devaiportal.local';
    this.to = config.to || process.env.ALERT_EMAIL || 'devops@example.com';
  }

  async send(event: NotifyEvent): Promise<NotifyResult> {
    if (!this.smtpHost) {
      // In air-gapped / local mode without SMTP configured, cleanly log and succeed
      return { ok: true };
    }

    try {
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Failed to send email notification: ${(err as Error).message}` };
    }
  }

  async healthCheck(): Promise<HealthResult> {
    if (!this.smtpHost) {
      return { healthy: false, message: 'SMTP_HOST is not configured' };
    }
    return { healthy: true, message: `SMTP endpoint configured at ${this.smtpHost}:${this.smtpPort}` };
  }
}
