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

    it('matches golden rendered snapshot for web blueprint', () => {
      const output = execSync(
        `helm template test-web ${CHART_PATH} -f ${VALID_DIR}/web.yaml`,
        { encoding: 'utf-8' }
      );
      const fs = require('node:fs');
      const expected = fs.readFileSync(resolve(CHART_PATH, 'snapshots/web.golden.yaml'), 'utf-8');
      expect(output.trim()).toBe(expected.trim());
    });

    it('matches golden rendered snapshot for internal-service blueprint', () => {
      const output = execSync(
        `helm template test-internal ${CHART_PATH} -f ${VALID_DIR}/internal-service.yaml`,
        { encoding: 'utf-8' }
      );
      const fs = require('node:fs');
      const expected = fs.readFileSync(resolve(CHART_PATH, 'snapshots/internal-service.golden.yaml'), 'utf-8');
      expect(output.trim()).toBe(expected.trim());
    });

    it('matches golden rendered snapshot for batch blueprint', () => {
      const output = execSync(
        `helm template test-batch ${CHART_PATH} -f ${VALID_DIR}/batch.yaml`,
        { encoding: 'utf-8' }
      );
      const fs = require('node:fs');
      const expected = fs.readFileSync(resolve(CHART_PATH, 'snapshots/batch.golden.yaml'), 'utf-8');
      expect(output.trim()).toBe(expected.trim());
    });
  });

  describe('Invalid fixtures fail Helm validation', () => {
    it('rejects privileged port < 1024', () => {
      expect(() => {
        execSync(`helm template test-bad ${CHART_PATH} -f ${INVALID_DIR}/bad-port.yaml`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }).toThrow(/(?:minimum: got 80, want 1,024|Must be greater than or equal to 1024)/);
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
      }).toThrow(/(?:missing properties 'schedule', 'command'|schedule is required)/);
    });

    it('rejects image with forbidden :latest tag', () => {
      expect(() => {
        execSync(
          `helm template test-bad ${CHART_PATH} -f ${INVALID_DIR}/latest-tag.yaml`,
          {
            encoding: 'utf-8',
            stdio: 'pipe',
          }
        );
      }).toThrow(/uses forbidden ':latest' tag/);
    });

    it('rejects image outside allowed registries', () => {
      expect(() => {
        execSync(
          `helm template test-bad ${CHART_PATH} -f ${INVALID_DIR}/bad-registry.yaml`,
          {
            encoding: 'utf-8',
            stdio: 'pipe',
          }
        );
      }).toThrow(/is not from an allowed registry/);
    });

    it('rejects ingress on internal-service blueprint', () => {
      expect(() => {
        execSync(
          `helm template test-bad ${CHART_PATH} -f ${INVALID_DIR}/ingress-on-internal.yaml`,
          {
            encoding: 'utf-8',
            stdio: 'pipe',
          }
        );
      }).toThrow(/(?:'allOf' failed|'not' failed|Must not validate the schema \(not\))/);
    });

    it('rejects unknown fields via schema additionalProperties:false', () => {
      expect(() => {
        execSync(
          `helm template test-bad ${CHART_PATH} -f ${INVALID_DIR}/unknown-field.yaml`,
          {
            encoding: 'utf-8',
            stdio: 'pipe',
          }
        );
      }).toThrow(/(?:additional properties 'unauthorizedBackdoorField' not allowed|Additional property unauthorizedBackdoorField is not allowed)/);
    });

    it('rejects environment name longer than 40 chars', () => {
      expect(() => {
        execSync(
          `helm template test-bad ${CHART_PATH} -f ${INVALID_DIR}/name-too-long.yaml`,
          {
            encoding: 'utf-8',
            stdio: 'pipe',
          }
        );
      }).toThrow(/pattern/);
    });
  });
});
