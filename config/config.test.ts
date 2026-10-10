import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { loadConfig, ConfigError } from '../config/index.js';
import { renderPlatform } from '../scripts/render-platform.js';

const REPO_ROOT = join(import.meta.dirname, '..');
const TEST_DIR = join(REPO_ROOT, '__test_config_tmp__');
const SCHEMA_SRC = join(REPO_ROOT, 'devaiportal.config.schema.json');

describe('loadConfig', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    copyFileSync(SCHEMA_SRC, join(TEST_DIR, 'devaiportal.config.schema.json'));
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  function writeConfig(obj: Record<string, unknown>) {
    const yamlContent = yaml.dump(obj);
    writeFileSync(join(TEST_DIR, 'devaiportal.config.yaml'), yamlContent);
  }

  const VALID_CONFIG = {
    version: 'v1',
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
    expect(config.version).toBe('v1');
    expect(config.adapters.llm).toBe('mock');
    expect(config.cluster.context).toBe('kind-devaiportal');
    expect(config.sizes.small.cpu).toBe('500m');
  });

  it('validates the committed devaiportal.config.example.yaml against schema', () => {
    const examplePath = join(REPO_ROOT, 'devaiportal.config.example.yaml');
    const rawExample = readFileSync(examplePath, 'utf-8');
    writeFileSync(join(TEST_DIR, 'devaiportal.config.yaml'), rawExample);

    const config = loadConfig(TEST_DIR);
    expect(config.version).toBe('v1');
    expect(config.adapters.llm).toBe('azure-openai');
  });

  it('validates the committed devaiportal.config.yaml against schema', () => {
    const config = loadConfig(REPO_ROOT);
    expect(config.version).toBe('v1');
  });

  it('throws ConfigError when config file is missing', () => {
    rmSync(join(TEST_DIR, 'devaiportal.config.yaml'), { force: true });
    expect(() => loadConfig(TEST_DIR)).toThrow(ConfigError);
    expect(() => loadConfig(TEST_DIR)).toThrow('Config file not found');
  });

  // Negative tests: verify fail-fast error with exact JSON path
  it('rejects missing version field naming JSON path', () => {
    const { version, ...noVersion } = VALID_CONFIG;
    writeConfig(noVersion);
    try {
      loadConfig(TEST_DIR);
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).message).toContain("must have required property 'version'");
    }
  });

  it('rejects unsupported schema version naming JSON path', () => {
    const bad = { ...VALID_CONFIG, version: 'v2' };
    writeConfig(bad);
    try {
      loadConfig(TEST_DIR);
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).message).toContain('/version');
      expect((e as ConfigError).message).toContain('must be equal to one of the allowed values');
    }
  });

  it('rejects unknown adapter value naming JSON path', () => {
    const bad = { ...VALID_CONFIG, adapters: { ...VALID_CONFIG.adapters, llm: 'bedrock' } };
    writeConfig(bad);
    try {
      loadConfig(TEST_DIR);
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).message).toContain('/adapters/llm');
    }
  });

  it('rejects missing required field naming JSON path', () => {
    const { ttl, ...noTtl } = VALID_CONFIG;
    writeConfig(noTtl);
    try {
      loadConfig(TEST_DIR);
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).message).toContain("must have required property 'ttl'");
    }
  });

  it('rejects unknown / additional properties naming exact field', () => {
    const bad = { ...VALID_CONFIG, unexpectedField: 'forbidden' };
    writeConfig(bad);
    try {
      loadConfig(TEST_DIR);
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).message).toContain('must NOT have additional properties');
      expect((e as ConfigError).message).toContain('unexpectedField');
    }
  });

  it('rejects invalid namespace prefix pattern', () => {
    const bad = {
      ...VALID_CONFIG,
      namespaces: { ...VALID_CONFIG.namespaces, prefix: 'UPPERCASE_INVALID' },
    };
    writeConfig(bad);
    try {
      loadConfig(TEST_DIR);
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).message).toContain('/namespaces/prefix');
    }
  });

  it('rejects TTL out of range', () => {
    const bad = {
      ...VALID_CONFIG,
      ttl: { defaultDays: 0, maxDays: 100 },
    };
    writeConfig(bad);
    try {
      loadConfig(TEST_DIR);
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).message).toContain('/ttl/defaultDays');
    }
  });

  it('rejects invalid memory quota format naming JSON path', () => {
    const bad = {
      ...VALID_CONFIG,
      sizes: {
        ...VALID_CONFIG.sizes,
        small: { cpu: '500m', memory: '1024MB', pods: 5 }, // must be Mi or Gi
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

describe('renderPlatform drift detection', () => {
  it('detects no drift on cleanly rendered files in REPO_ROOT', () => {
    expect(() => renderPlatform({ projectRoot: REPO_ROOT, checkOnly: true })).not.toThrow();
  });
});
