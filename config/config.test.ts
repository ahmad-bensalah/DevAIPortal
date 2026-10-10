import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, ConfigError } from '../config/index.js';

const TEST_DIR = join(import.meta.dirname, '..', '__test_config_tmp__');
const SCHEMA_SRC = join(import.meta.dirname, '..', 'devaiportal.config.schema.json');

describe('loadConfig', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    copyFileSync(SCHEMA_SRC, join(TEST_DIR, 'devaiportal.config.schema.json'));
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  function writeConfig(obj: Record<string, unknown>) {
    // Write as YAML-compatible JSON (valid YAML)
    const yaml = JSON.stringify(obj, null, 2);
    writeFileSync(join(TEST_DIR, 'devaiportal.config.yaml'), yaml);
  }

  const VALID_CONFIG = {
    adapters: {
      llm: 'mock',
      git: 'gitea',
      notifier: 'console',
      identity: 'static-user',
      secrets: 'env',
    },
    cluster: {
      context: 'kind-devaiportal',
      baseDomain: 'dev.local',
      ingressClass: 'nginx',
    },
    namespaces: {
      prefix: 'env',
      allowedRegistries: ['docker.io'],
    },
    ttl: { defaultDays: 3, maxDays: 14 },
    sizes: {
      small: { cpu: '500m', memory: '512Mi', pods: 5 },
      medium: { cpu: '2', memory: '2Gi', pods: 15 },
      large: { cpu: '8', memory: '8Gi', pods: 30 },
    },
    approval: { requireAboveSize: 'medium', requireAboveTtlDays: 7 },
  };

  it('loads a valid config without error', () => {
    writeConfig(VALID_CONFIG);
    const config = loadConfig(TEST_DIR);
    expect(config.adapters.llm).toBe('mock');
    expect(config.cluster.context).toBe('kind-devaiportal');
    expect(config.sizes.small.cpu).toBe('500m');
  });

  it('throws ConfigError when config file is missing', () => {
    rmSync(join(TEST_DIR, 'devaiportal.config.yaml'), { force: true });
    expect(() => loadConfig(TEST_DIR)).toThrow(ConfigError);
    expect(() => loadConfig(TEST_DIR)).toThrow('Config file not found');
  });

  it('rejects unknown adapter value', () => {
    const bad = { ...VALID_CONFIG, adapters: { ...VALID_CONFIG.adapters, llm: 'bedrock' } };
    writeConfig(bad);
    expect(() => loadConfig(TEST_DIR)).toThrow(ConfigError);
  });

  it('rejects missing required field', () => {
    const { ttl, ...noTtl } = VALID_CONFIG;
    writeConfig(noTtl);
    expect(() => loadConfig(TEST_DIR)).toThrow(ConfigError);
  });

  it('rejects additional properties', () => {
    const bad = { ...VALID_CONFIG, extraField: 'nope' };
    writeConfig(bad);
    expect(() => loadConfig(TEST_DIR)).toThrow(ConfigError);
  });

  it('rejects invalid namespace prefix', () => {
    const bad = {
      ...VALID_CONFIG,
      namespaces: { ...VALID_CONFIG.namespaces, prefix: 'UPPER' },
    };
    writeConfig(bad);
    expect(() => loadConfig(TEST_DIR)).toThrow(ConfigError);
  });

  it('rejects TTL out of range', () => {
    const bad = {
      ...VALID_CONFIG,
      ttl: { defaultDays: 0, maxDays: 100 },
    };
    writeConfig(bad);
    expect(() => loadConfig(TEST_DIR)).toThrow(ConfigError);
  });

  it('error message names the exact path', () => {
    const bad = {
      ...VALID_CONFIG,
      sizes: {
        ...VALID_CONFIG.sizes,
        small: { cpu: '500m', memory: 'bad', pods: 5 },
      },
    };
    writeConfig(bad);
    try {
      loadConfig(TEST_DIR);
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).message).toContain('/sizes/small/memory');
    }
  });
});
