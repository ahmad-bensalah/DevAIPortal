import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const POLICIES_DIR = resolve(import.meta.dirname);

describe('Kyverno Policy Guardrails Structural Verification', () => {
  it('bundles all policies in kustomization.yaml', () => {
    const kustomizePath = resolve(POLICIES_DIR, 'kustomization.yaml');
    expect(existsSync(kustomizePath)).toBe(true);
    const content = yaml.load(readFileSync(kustomizePath, 'utf-8')) as any;
    expect(content.resources).toContain('registry-allowlist.yaml');
    expect(content.resources).toContain('disallow-latest-tag.yaml');
    expect(content.resources).toContain('cleanup-expired-environments.yaml');
  });

  it('validates disallow-latest-tag policy definition', () => {
    const policyPath = resolve(POLICIES_DIR, 'disallow-latest-tag.yaml');
    const policy = yaml.load(readFileSync(policyPath, 'utf-8')) as any;
    expect(policy.kind).toBe('ClusterPolicy');
    expect(policy.spec.validationFailureAction).toBe('Enforce');
    const rule = policy.spec.rules[0];
    expect(rule.name).toBe('validate-image-tag');
    expect(rule.validate.pattern.spec.containers[0].image).toBe('!*:latest & !*:');
  });

  it('validates registry-allowlist policy definition', () => {
    const policyPath = resolve(POLICIES_DIR, 'registry-allowlist.yaml');
    const policy = yaml.load(readFileSync(policyPath, 'utf-8')) as any;
    expect(policy.kind).toBe('ClusterPolicy');
    expect(policy.spec.validationFailureAction).toBe('Enforce');
    const rule = policy.spec.rules[0];
    expect(rule.name).toBe('validate-registries');
    expect(rule.validate.pattern.spec.containers[0].image).toContain('docker.io/*');
  });

  it('validates cleanup-expired-environments TTL policy definition', () => {
    const policyPath = resolve(POLICIES_DIR, 'cleanup-expired-environments.yaml');
    const policy = yaml.load(readFileSync(policyPath, 'utf-8')) as any;
    expect(policy.kind).toBe('ClusterCleanupPolicy');
    expect(policy.spec.match.any[0].resources.kinds).toContain('Namespace');
    expect(policy.spec.conditions.all[0].key).toContain('devaiportal.io/expires-at');
  });

  it('provides kyverno cli test suites for policy verification', () => {
    const test1 = resolve(POLICIES_DIR, 'tests/disallow-latest-tag/kyverno-test.yaml');
    const test2 = resolve(POLICIES_DIR, 'tests/check-image-registry/kyverno-test.yaml');
    expect(existsSync(test1)).toBe(true);
    expect(existsSync(test2)).toBe(true);
  });
});
