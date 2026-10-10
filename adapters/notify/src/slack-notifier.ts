import type { Notifier, NotifyEvent, NotifyResult, HealthResult } from './notifier.js';

export interface SlackNotifierConfig {
  webhookUrl?: string;
}

/**
 * SlackNotifier
 * Posts Block Kit messages to Slack channels for lifecycle updates.
 */
export class SlackNotifier implements Notifier {
  readonly name = 'slack';

  private readonly webhookUrl: string;

  constructor(config: SlackNotifierConfig = {}) {
    this.webhookUrl = config.webhookUrl || process.env.SLACK_WEBHOOK_URL || '';
  }

  async send(event: NotifyEvent): Promise<NotifyResult> {
    if (!this.webhookUrl) {
      return { ok: false, error: 'SLACK_WEBHOOK_URL is not configured' };
    }

    const payload = {
      text: `[${event.type}] Environment ${event.environmentName}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `DevAIPortal: ${event.type}`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Environment:*\n\`${event.environmentName}\`` },
            { type: 'mrkdwn', text: `*Owner:*\n${event.owner}` },
            { type: 'mrkdwn', text: `*Team:*\n${event.team || 'N/A'}` },
            { type: 'mrkdwn', text: `*Request ID:*\n\`${event.requestId}\`` },
            ...(event.expiresAt ? [{ type: 'mrkdwn', text: `*Expires UTC:*\n${event.expiresAt}` }] : []),
          ],
        },
        ...(event.prUrl
          ? [
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: 'View Pull Request' },
                    url: event.prUrl,
                  },
                ],
              },
            ]
          : []),
      ],
    };

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return { ok: false, error: `Slack webhook responded with status ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Slack network error: ${(err as Error).message}` };
    }
  }

  async healthCheck(): Promise<HealthResult> {
    if (!this.webhookUrl) {
      return { healthy: false, message: 'SLACK_WEBHOOK_URL is not configured' };
    }
    return { healthy: true, message: 'Slack webhook endpoint is configured' };
  }
}
