import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const WORKFLOWS_DIR = resolve(import.meta.dirname, 'workflows');

describe('n8n Workflows Quality & Architecture Linting', () => {
  const files = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.json'));

  it('contains all 10 expected workflows and sub-workflows', () => {
    expect(files.length).toBe(10);
    const expected = [
      'intake.json',
      'validate.json',
      'open-pr.json',
      'notify.json',
      'expiry-reminder.json',
      'error-handler.json',
      'llm.complete.json',
      'git.open_pr.json',
      'notify.send.json',
      'identity.resolve_groups.json',
    ];
    for (const name of expected) {
      expect(files).toContain(name);
    }
  });

  it('validates every workflow file is well-formed JSON with nodes and connections', () => {
    for (const file of files) {
      const filePath = resolve(WORKFLOWS_DIR, file);
      const raw = readFileSync(filePath, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();

      const parsed = JSON.parse(raw);
      expect(parsed).toHaveProperty('nodes');
      expect(Array.isArray(parsed.nodes)).toBe(true);
      expect(parsed).toHaveProperty('connections');
    }
  });

  it('ensures business workflows use generic sub-workflow calls without vendor locks', () => {
    const businessWorkflows = ['intake.json', 'open-pr.json', 'validate.json', 'expiry-reminder.json'];
    const forbiddenVendorStrings = ['azure-openai-key', 'ghp_', 'slack_webhook_secret', 'AKIA'];

    for (const file of businessWorkflows) {
      const raw = readFileSync(resolve(WORKFLOWS_DIR, file), 'utf-8');
      for (const secretToken of forbiddenVendorStrings) {
        expect(raw).not.toContain(secretToken);
      }
    }
  });

  it('ensures no hardcoded credentials or private tokens exist in any workflow', () => {
    for (const file of files) {
      const raw = readFileSync(resolve(WORKFLOWS_DIR, file), 'utf-8');
      expect(raw).not.toMatch(/password\s*[:=]\s*["'][^"']+["']/i);
      expect(raw).not.toMatch(/api[_-]?key\s*[:=]\s*["'][a-zA-Z0-9_\-]{20,}["']/i);
      expect(raw).not.toMatch(/client[_-]?secret\s*[:=]\s*["'][a-zA-Z0-9_\-]{20,}["']/i);
    }
  });
});
