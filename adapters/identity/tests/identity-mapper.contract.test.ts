import { describe, it, expect } from 'vitest';
import { StaticUserMapper } from '../src/static-user-mapper.js';
import type { IdentityMapper } from '../src/identity-mapper.js';

/**
 * Contract tests for IdentityMapper implementations.
 */
export function identityMapperContractTests(
  name: string,
  factory: () => IdentityMapper,
) {
  describe(`IdentityMapper contract: ${name}`, () => {
    it('returns a non-empty name', () => {
      const mapper = factory();
      expect(mapper.name).toBeTruthy();
    });

    it('healthCheck resolves with a result', async () => {
      const mapper = factory();
      const result = await mapper.healthCheck();
      expect(result).toHaveProperty('healthy');
      expect(result).toHaveProperty('message');
    });

    it('resolveGroups returns at least one group for a valid user', async () => {
      const mapper = factory();
      const result = await mapper.resolveGroups('alice@example.com');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.groups.length).toBeGreaterThan(0);
        // Groups must be valid Kubernetes subject names
        for (const g of result.groups) {
          expect(g).toMatch(/^[a-z0-9][a-z0-9._-]*$/);
        }
      }
    });

    it('resolveGroups handles plain username', async () => {
      const mapper = factory();
      const result = await mapper.resolveGroups('bob');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.groups.length).toBeGreaterThan(0);
      }
    });
  });
}

identityMapperContractTests('static-user', () => new StaticUserMapper());

describe('StaticUserMapper', () => {
  const mapper = new StaticUserMapper('devportal-users');

  it('includes the default group', async () => {
    const result = await mapper.resolveGroups('alice@example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.groups).toContain('devportal-users');
    }
  });

  it('extracts username from email for team group', async () => {
    const result = await mapper.resolveGroups('alice@example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.groups).toContain('team-alice');
      expect(result.displayName).toBe('alice');
    }
  });

  it('uses plain username as-is', async () => {
    const result = await mapper.resolveGroups('bob');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.groups).toContain('team-bob');
    }
  });
});
