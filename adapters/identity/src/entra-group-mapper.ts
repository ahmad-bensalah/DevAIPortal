import type { IdentityMapper, GroupResult, HealthResult } from './identity-mapper.js';

export interface EntraGroupConfig {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * EntraGroupMapper
 * Resolves user email/UPN to security group memberships via Microsoft Graph API.
 */
export class EntraGroupMapper implements IdentityMapper {
  readonly name = 'entra-group';

  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(config: EntraGroupConfig = {}) {
    this.tenantId = config.tenantId || process.env.ENTRA_TENANT_ID || '';
    this.clientId = config.clientId || process.env.ENTRA_CLIENT_ID || '';
    this.clientSecret = config.clientSecret || process.env.ENTRA_CLIENT_SECRET || '';
  }

  async resolveGroups(userId: string): Promise<GroupResult> {
    if (!this.tenantId || !this.clientId || !this.clientSecret) {
      // Deterministic fallback for dev/demo if credentials aren't live
      const username = userId.split('@')[0] || userId;
      return {
        ok: true,
        groups: ['devaiportal-developers', `team-${username}`],
        displayName: username,
      };
    }

    try {
      // 1. Obtain OAuth2 token from Entra ID
      const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
      const tokenBody = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      });

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      if (!tokenRes.ok) {
        return { ok: false, error: `Entra ID OAuth failed: HTTP ${tokenRes.status}` };
      }
      const tokenData = (await tokenRes.json()) as any;
      const accessToken = tokenData.access_token;

      // 2. Query memberOf from Microsoft Graph
      const graphRes = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}/memberOf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!graphRes.ok) {
        return { ok: false, error: `Microsoft Graph user lookup failed: HTTP ${graphRes.status}` };
      }

      const graphData = (await graphRes.json()) as any;
      const groups = (graphData.value || [])
        .map((g: any) => g.displayName || g.id)
        .filter(Boolean);

      return {
        ok: true,
        groups: groups.length > 0 ? groups : ['devaiportal-users'],
        displayName: userId.split('@')[0],
      };
    } catch (err) {
      return { ok: false, error: `Entra ID resolution error: ${(err as Error).message}` };
    }
  }

  async healthCheck(): Promise<HealthResult> {
    if (!this.tenantId || !this.clientId || !this.clientSecret) {
      return { healthy: false, message: 'Entra ID credentials missing (ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET)' };
    }
    return { healthy: true, message: 'Entra ID client credentials configured' };
  }
}
