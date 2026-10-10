import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CHART_PATH = resolve(REPO_ROOT, 'charts/environment');
const VALID_DIR = resolve(CHART_PATH, 'fixtures/valid');
const INVALID_DIR = resolve(CHART_PATH, 'fixtures/invalid');

describe('Helm Environment Blueprint Tests', () => {
  describe('Valid blueprints render successfully', () => {
    it('renders web blueprint with deployment, service, ingress and networkpolicy', () => {
      const output = execSync(
        `helm template test-web ${CHART_PATH} -f ${VALID_DIR}/web.yaml`,
        { encoding: 'utf-8' }
      );
      expect(output).toContain('kind: Deployment');
      expect(output).toContain('kind: Service');
      expect(output).toContain('kind: Ingress');
      expect(output).toContain('kind: NetworkPolicy');
      expect(output).toContain('env-payments-web');
      expect(output).toContain('pod-security.kubernetes.io/enforce: restricted');
    });

    it('renders internal-service blueprint without Ingress', () => {
      const output = execSync(
        `helm template test-internal ${CHART_PATH} -f ${VALID_DIR}/internal-service.yaml`,
        { encoding: 'utf-8' }
      );
      expect(output).toContain('kind: Deployment');
      expect(output).toContain('kind: Service');
      expect(output).not.toContain('kind: Ingress');
      expect(output).toContain('name: allow-team-ingress');
    });

    it('renders batch blueprint with CronJob and emptyDir tmp mount', () => {
      const output = execSync(
        `helm template test-batch ${CHART_PATH} -f ${VALID_DIR}/batch.yaml`,
        { encoding: 'utf-8' }
      );
      expect(output).toContain('kind: CronJob');
      expect(output).toContain('concurrencyPolicy: Forbid');
      expect(output).toContain('schedule: "0 */4 * * *"');
      expect(output).not.toContain('kind: Deployment');
    });
  });

  describe('Invalid fixtures fail Helm validation', () => {
    it('rejects privileged port < 1024', () => {
      expect(() => {
        execSync(`helm template test-bad ${CHART_PATH} -f ${INVALID_DIR}/bad-port.yaml`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }).toThrow(/minimum: got 80, want 1,024/);
    });

    it('rejects batch workload missing schedule and command', () => {
      expect(() => {
        execSync(
          `helm template test-bad ${CHART_PATH} -f ${INVALID_DIR}/missing-schedule.yaml`,
          {
            encoding: 'utf-8',
            stdio: 'pipe',
          }
        );
      }).toThrow(/missing properties 'schedule', 'command'/);
    });
  });
});
