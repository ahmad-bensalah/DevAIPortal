import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import yaml from 'js-yaml';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const GITOPS_DIR = resolve(REPO_ROOT, 'gitops');
const CHART_PATH = resolve(REPO_ROOT, 'charts/environment');
const ENVIRONMENTS_DIR = resolve(GITOPS_DIR, 'environments');

describe('GitOps Structure and Rendering Verification', () => {
  it('validates AppProject configuration restricts destinations and blacklists Secrets', () => {
    const projectPath = resolve(GITOPS_DIR, 'appproject.yaml');
    expect(existsSync(projectPath)).toBe(true);
    const doc = yaml.load(readFileSync(projectPath, 'utf-8')) as any;
    expect(doc.kind).toBe('AppProject');
    expect(doc.spec.destinations[0].namespace).toBe('env-*');
    const secretBlacklist = doc.spec.namespaceResourceBlacklist.find((r: any) => r.kind === 'Secret');
    expect(secretBlacklist).toBeDefined();
  });

  it('validates ApplicationSet configuration uses git generator for environment values', () => {
    const appSetPath = resolve(GITOPS_DIR, 'applicationset.yaml');
    expect(existsSync(appSetPath)).toBe(true);
    const doc = yaml.load(readFileSync(appSetPath, 'utf-8')) as any;
    expect(doc.kind).toBe('ApplicationSet');
    expect(doc.spec.generators[0].git.files[0].path).toBe('gitops/environments/*/values.yaml');
    expect(doc.spec.template.spec.project).toBe('devaiportal-environments');
  });

  it('renders every declared environment through Helm successfully', () => {
    const envDirs = readdirSync(ENVIRONMENTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    expect(envDirs.length).toBeGreaterThanOrEqual(3);

    for (const envName of envDirs) {
      const valuesFile = resolve(ENVIRONMENTS_DIR, envName, 'values.yaml');
      expect(existsSync(valuesFile)).toBe(true);

      const output = execSync(
        `helm template env-${envName} ${CHART_PATH} -f ${valuesFile}`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('apiVersion:');
      expect(output).toContain('devaiportal.io/managed: "true"');
      expect(output).toContain('pod-security.kubernetes.io/enforce: restricted');
    }
  });
});
