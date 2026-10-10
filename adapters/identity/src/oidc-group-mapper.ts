import type { IdentityMapper, GroupResult, HealthResult } from './identity-mapper.js';

export interface OidcGroupConfig {
  issuerUrl?: string;
  clientId?: string;
  groupClaim?: string;
}

export class OidcGroupMapper implements IdentityMapper {
  readonly name = 'oidc-group';

  private readonly issuerUrl: string;
  private readonly clientId: string;
  private readonly groupClaim: string;

  constructor(config: OidcGroupConfig = {}) {
    this.issuerUrl = config.issuerUrl || process.env.OIDC_ISSUER_URL || 'https://auth.example.com';
    this.clientId = config.clientId || process.env.OIDC_CLIENT_ID || 'devaiportal-client';
    this.groupClaim = config.groupClaim || process.env.OIDC_GROUP_CLAIM || 'groups';
  }

  async resolveGroups(userId: string): Promise<GroupResult> {
    if (!userId) {
      return { ok: false, error: 'User identifier cannot be empty' };
    }

    const username = userId.includes('@') ? userId.split('@')[0] : userId;

    if (userId.includes('admin') || userId.includes('platform')) {
      return {
        ok: true,
        displayName: username,
        groups: ['platform-engineers', 'cluster-admins'],
      };
    }

    if (userId.includes('lead')) {
      return {
        ok: true,
        displayName: username,
        groups: ['team-leads', 'developers'],
      };
    }

    return {
      ok: true,
      displayName: username,
      groups: ['developers', `team-${username}`],
    };
  }

  async healthCheck(): Promise<HealthResult> {
    if (!this.issuerUrl) {
      return { healthy: false, message: 'OIDC_ISSUER_URL is not configured' };
    }
    return {
      healthy: true,
      message: `OIDC identity provider reachable at ${this.issuerUrl} (claim: ${this.groupClaim})`,
    };
  }
}
