/**
 * Notifier — interface for sending lifecycle notifications.
 *
 * Events: environment created, expiry reminder (24h before),
 * environment deleted, provisioning error, approval needed.
 */
export interface Notifier {
  readonly name: string;

  /**
   * Send a notification.
   * @param event — structured event with all the context the template needs
   */
  send(event: NotifyEvent): Promise<NotifyResult>;

  /** Verify connectivity (send a test message or ping webhook). */
  healthCheck(): Promise<HealthResult>;
}

export type NotifyEventType =
  | 'environment.created'
  | 'environment.expiry_warning'
  | 'environment.deleted'
  | 'environment.error'
  | 'environment.approval_needed'
  | 'environment.extended';

export interface NotifyEvent {
  type: NotifyEventType;
  environmentName: string;
  owner: string;
  team?: string;
  /** PR URL for created events */
  prUrl?: string;
  /** RFC3339 UTC */
  expiresAt?: string;
  /** Free-form detail (error message, etc.) */
  detail?: string;
  requestId: string;
}

export type NotifyResult =
  | { ok: true }
  | { ok: false; error: string };

export interface HealthResult {
  healthy: boolean;
  message: string;
}
