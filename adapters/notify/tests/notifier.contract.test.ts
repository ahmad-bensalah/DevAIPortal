import { describe, it, expect } from 'vitest';
import { ConsoleNotifier } from '../src/console-notifier.js';
import type { Notifier, NotifyEvent } from '../src/notifier.js';

/**
 * Contract tests for Notifier implementations.
 */
export function notifierContractTests(
  name: string,
  factory: () => Notifier,
) {
  describe(`Notifier contract: ${name}`, () => {
    it('returns a non-empty name', () => {
      const notifier = factory();
      expect(notifier.name).toBeTruthy();
    });

    it('healthCheck resolves with a result', async () => {
      const notifier = factory();
      const result = await notifier.healthCheck();
      expect(result).toHaveProperty('healthy');
      expect(result).toHaveProperty('message');
    });

    it('send returns ok:true for a valid event', async () => {
      const notifier = factory();
      const event: NotifyEvent = {
        type: 'environment.created',
        environmentName: 'env-test-app',
        owner: 'test@example.com',
        team: 'platform',
        prUrl: 'https://github.com/org/repo/pull/1',
        expiresAt: '2026-10-13T00:00:00Z',
        requestId: 'req-test-001',
      };
      const result = await notifier.send(event);
      expect(result.ok).toBe(true);
    });

    it('send handles all event types without error', async () => {
      const notifier = factory();
      const types = [
        'environment.created',
        'environment.expiry_warning',
        'environment.deleted',
        'environment.error',
        'environment.approval_needed',
        'environment.extended',
      ] as const;

      for (const type of types) {
        const result = await notifier.send({
          type,
          environmentName: 'env-test',
          owner: 'user@example.com',
          requestId: `req-${type}`,
          detail: type === 'environment.error' ? 'test error' : undefined,
        });
        expect(result.ok).toBe(true);
      }
    });
  });
}

notifierContractTests('console', () => new ConsoleNotifier());

describe('Remote Notifiers Contract & Fallback', () => {
  it('TeamsNotifier skips cleanly if TEAMS_WEBHOOK_URL is not provided', async () => {
    const { TeamsNotifier } = await import('../src/teams-notifier.js');
    const teams = new TeamsNotifier({ webhookUrl: '' });
    expect(teams.name).toBe('teams');
    const health = await teams.healthCheck();
    expect(health.healthy).toBe(false);
    const result = await teams.send({
      type: 'environment.created',
      environmentName: 'env-test',
      owner: 'user@example.com',
      requestId: 'req-01',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('TEAMS_WEBHOOK_URL is not configured');
    }
  });

  it('SlackNotifier skips cleanly if SLACK_WEBHOOK_URL is not provided', async () => {
    const { SlackNotifier } = await import('../src/slack-notifier.js');
    const slack = new SlackNotifier({ webhookUrl: '' });
    expect(slack.name).toBe('slack');
    const health = await slack.healthCheck();
    expect(health.healthy).toBe(false);
    const result = await slack.send({
      type: 'environment.created',
      environmentName: 'env-test',
      owner: 'user@example.com',
      requestId: 'req-01',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('SLACK_WEBHOOK_URL is not configured');
    }
  });
});
