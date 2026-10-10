/**
 * IdentityMapper — resolves a user identifier to Kubernetes RBAC groups.
 *
 * The provisioning flow needs to know which group(s) to bind to the
 * namespace Role. This interface abstracts the identity source.
 */
export interface IdentityMapper {
  readonly name: string;

  /**
   * Resolve a user identifier (email, UPN, username) to a list of
   * Kubernetes-compatible group names for RoleBinding subjects.
   */
  resolveGroups(userId: string): Promise<GroupResult>;

  /** Verify connectivity to the identity backend. */
  healthCheck(): Promise<HealthResult>;
}

export type GroupResult =
  | { ok: true; groups: string[]; displayName?: string }
  | { ok: false; error: string };

export interface HealthResult {
  healthy: boolean;
  message: string;
}
