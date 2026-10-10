import { describe, it, expect } from 'vitest';
import { runEval } from './eval-runner.js';

describe('Agent Extraction Evaluation Suite', () => {
  it('achieves > 85% extraction accuracy and adversarial resilience across test dataset', async () => {
    const stats = await runEval();
    expect(stats.total).toBeGreaterThanOrEqual(20);
    expect(stats.accuracy).toBeGreaterThanOrEqual(85);
  });
});
