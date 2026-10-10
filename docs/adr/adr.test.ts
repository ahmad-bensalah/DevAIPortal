import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { lintAdrs } from '../../scripts/lint-adrs.js';

const ADR_DIR = import.meta.dirname;

describe('ADR Quality & Governance Suite', () => {
  it('all ADRs in docs/adr satisfy the Staff-Engineer standard', () => {
    const errors = lintAdrs(ADR_DIR);
    if (errors.length > 0) {
      const formatted = errors.map(e => `[${e.file}] ${e.error}`).join('\n');
      expect.unreachable(`ADR linting failed:\n${formatted}`);
    }
    expect(errors).toEqual([]);
  });
});
