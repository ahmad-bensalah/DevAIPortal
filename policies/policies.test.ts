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
    expect(content.resources).toContain('require-run-as-non-root.yaml');
    expect(content.resources).toContain('require-resource-requests-limits.yaml');
    expect(content.resources).toContain('require-mandatory-labels.yaml');
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

  it('validates require-run-as-non-root policy definition', () => {
    const policyPath = resolve(POLICIES_DIR, 'require-run-as-non-root.yaml');
    const policy = yaml.load(readFileSync(policyPath, 'utf-8')) as any;
    expect(policy.kind).toBe('ClusterPolicy');
    expect(policy.spec.validationFailureAction).toBe('Enforce');
    const rule = policy.spec.rules[0];
    expect(rule.name).toBe('check-run-as-non-root');
    const spec = rule.validate.pattern.spec;
    expect(spec['=(securityContext)'].runAsNonRoot).toBe(true);
  });

  it('validates require-resource-requests-limits policy definition', () => {
    const policyPath = resolve(POLICIES_DIR, 'require-resource-requests-limits.yaml');
    const policy = yaml.load(readFileSync(policyPath, 'utf-8')) as any;
    expect(policy.kind).toBe('ClusterPolicy');
    expect(policy.spec.validationFailureAction).toBe('Enforce');
    const rule = policy.spec.rules[0];
    expect(rule.name).toBe('check-resources');
    const requests = rule.validate.pattern.spec.containers[0].resources.requests;
    expect(requests.cpu).toBe('?*');
    expect(requests.memory).toBe('?*');
  });

  it('validates require-mandatory-labels policy definition', () => {
    const policyPath = resolve(POLICIES_DIR, 'require-mandatory-labels.yaml');
    const policy = yaml.load(readFileSync(policyPath, 'utf-8')) as any;
    expect(policy.kind).toBe('ClusterPolicy');
    expect(policy.spec.validationFailureAction).toBe('Enforce');
    const rule = policy.spec.rules[0];
    expect(rule.name).toBe('check-namespace-labels');
    expect(rule.validate.pattern.metadata.labels['devaiportal.io/owner']).toBe('?*');
  });

  it('validates cleanup-expired-environments TTL policy definition', () => {
    const policyPath = resolve(POLICIES_DIR, 'cleanup-expired-environments.yaml');
    const policy = yaml.load(readFileSync(policyPath, 'utf-8')) as any;
    expect(policy.kind).toBe('ClusterCleanupPolicy');
    expect(policy.spec.match.any[0].resources.kinds).toContain('Namespace');
    expect(policy.spec.conditions.all[0].key).toContain('devaiportal.io/expires-at');
  });

  it('provides kyverno cli test suites for policy verification', () => {
    const tests = [
      'tests/disallow-latest-tag/kyverno-test.yaml',
      'tests/check-image-registry/kyverno-test.yaml',
      'tests/require-run-as-non-root/kyverno-test.yaml',
      'tests/require-resource-requests-limits/kyverno-test.yaml',
      'tests/require-mandatory-labels/kyverno-test.yaml',
    ];
    for (const testPath of tests) {
      expect(existsSync(resolve(POLICIES_DIR, testPath))).toBe(true);
    }
  });
});
