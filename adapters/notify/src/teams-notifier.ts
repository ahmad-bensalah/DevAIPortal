import type { Notifier, NotifyEvent, NotifyResult, HealthResult } from './notifier.js';

export interface TeamsNotifierConfig {
  webhookUrl?: string;
}

/**
 * TeamsNotifier
 * Posts structured Microsoft Teams Adaptive Cards for environment lifecycle events.
 */
export class TeamsNotifier implements Notifier {
  readonly name = 'teams';

  private readonly webhookUrl: string;

  constructor(config: TeamsNotifierConfig = {}) {
    this.webhookUrl = config.webhookUrl || process.env.TEAMS_WEBHOOK_URL || '';
  }

  async send(event: NotifyEvent): Promise<NotifyResult> {
    if (!this.webhookUrl) {
      return { ok: false, error: 'TEAMS_WEBHOOK_URL is not configured' };
    }

    const titleMap: Record<string, string> = {
      'environment.created': 'Ephemeral Environment Provisioned',
      'environment.expiry_warning': 'Environment Expiration Warning (24h)',
      'environment.deleted': 'Ephemeral Environment Garbage Collected',
      'environment.error': 'Environment Provisioning Failed',
      'environment.approval_needed': 'Environment Approval Required',
      'environment.extended': 'Environment Lifetime Extended',
    };

    const card = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            version: '1.4',
            type: 'AdaptiveCard',
            body: [
              {
                type: 'TextBlock',
                size: 'Medium',
                weight: 'Bolder',
                text: titleMap[event.type] || event.type,
              },
              {
                type: 'FactSet',
                facts: [
                  { title: 'Environment:', value: event.environmentName },
                  { title: 'Owner:', value: event.owner },
                  { title: 'Team:', value: event.team || 'N/A' },
                  { title: 'Request ID:', value: event.requestId },
                  ...(event.expiresAt ? [{ title: 'Expires At (UTC):', value: event.expiresAt }] : []),
                  ...(event.detail ? [{ title: 'Details:', value: event.detail }] : []),
                ],
              },
            ],
            actions: [
              ...(event.prUrl
                ? [
                    {
                      type: 'Action.OpenUrl',
                      title: 'View GitOps Pull Request',
                      url: event.prUrl,
                    },
                  ]
                : []),
            ],
          },
        },
      ],
    };

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      });

      if (!res.ok) {
        return { ok: false, error: `Teams webhook responded with status ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `Teams notification network error: ${(err as Error).message}` };
    }
  }

  async healthCheck(): Promise<HealthResult> {
    if (!this.webhookUrl) {
      return { healthy: false, message: 'TEAMS_WEBHOOK_URL is not set' };
    }
    return { healthy: true, message: 'Teams webhook endpoint is configured' };
  }
}
