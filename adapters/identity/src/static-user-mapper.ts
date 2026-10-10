import type {
  IdentityMapper,
  GroupResult,
  HealthResult,
} from './identity-mapper.js';

/**
 * Static user identity mapper — returns a fixed group for any user.
 * For local development and demo mode where no IdP is available.
 * Maps every user to a group named after their username portion.
 */
export class StaticUserMapper implements IdentityMapper {
  readonly name = 'static-user';

  private readonly defaultGroup: string;

  constructor(defaultGroup = 'devaiportal-users') {
    this.defaultGroup = defaultGroup;
  }

  async resolveGroups(userId: string): Promise<GroupResult> {
    // Extract username from email or use as-is
    const username = userId.includes('@') ? userId.split('@')[0] : userId;
    return {
      ok: true,
      groups: [this.defaultGroup, `team-${username}`],
      displayName: username,
    };
  }

  async healthCheck(): Promise<HealthResult> {
    return { healthy: true, message: 'Static user mapper is always healthy' };
  }
}
