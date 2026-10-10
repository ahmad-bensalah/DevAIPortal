import { describe, it, expect } from 'vitest';
import { MockLlmProvider } from '../src/providers/mock-llm.js';
import type { LlmProvider } from '../src/providers/llm-provider.js';

/**
 * Contract tests for LlmProvider implementations.
 * Every adapter must pass these; swap the constructor to test a real one.
 */
export function llmProviderContractTests(
  name: string,
  factory: () => LlmProvider,
) {
  describe(`LlmProvider contract: ${name}`, () => {
    it('returns a non-empty name', () => {
      const provider = factory();
      expect(provider.name).toBeTruthy();
      expect(typeof provider.name).toBe('string');
    });

    it('healthCheck resolves with a result', async () => {
      const provider = factory();
      const result = await provider.healthCheck();
      expect(result).toHaveProperty('healthy');
      expect(result).toHaveProperty('message');
      expect(typeof result.healthy).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('complete returns ok:true with a data object for a valid request', async () => {
      const provider = factory();
      const result = await provider.complete(
        'You are a test assistant.',
        'I need a web service called my-api for team payments with a 3-day lifetime',
        { type: 'object' },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.data).toBe('object');
        expect(result.data).not.toBeNull();
      }
    });

    it('complete result data contains expected fields', async () => {
      const provider = factory();
      const result = await provider.complete(
        'Extract environment parameters.',
        'a batch job called nightly-etl for team data-eng with a 5-day lifetime',
        { type: 'object' },
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveProperty('name');
        expect(result.data).toHaveProperty('blueprint');
        expect(result.data).toHaveProperty('size');
      }
    });
  });
}

// Run contract tests against the mock
llmProviderContractTests('mock', () => new MockLlmProvider());

// Additional mock-specific tests
describe('MockLlmProvider', () => {
  const provider = new MockLlmProvider();

  it('detects web blueprint from keyword', async () => {
    const result = await provider.complete('', 'a web service called my-api', {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.blueprint).toBe('web');
  });

  it('detects batch blueprint from keyword', async () => {
    const result = await provider.complete('', 'a cron job for nightly processing', {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.blueprint).toBe('batch');
  });

  it('detects internal-service blueprint from keyword', async () => {
    const result = await provider.complete('', 'an internal backend service', {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.blueprint).toBe('internal-service');
  });

  it('extracts TTL and computes RFC3339 expiresAt timestamp', async () => {
    const result = await provider.complete('', 'a web service with 5 days ttl', {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.expiresAt).toBeDefined();
      expect(typeof result.data.expiresAt).toBe('string');
    }
  });

  it('extracts team name', async () => {
    const result = await provider.complete('', 'web service for team payments', {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.team).toBe('payments');
  });

  it('extracts quoted name', async () => {
    const result = await provider.complete('', 'create "my-cool-app" as a web service', {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe('my-cool-app');
  });

  it('healthCheck is always healthy', async () => {
    const result = await provider.healthCheck();
    expect(result.healthy).toBe(true);
  });
});
