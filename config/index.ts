import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';

const CONFIG_FILE = 'devaiportal.config.yaml';
const SCHEMA_FILE = 'devaiportal.config.schema.json';

export interface DevAIPortalConfig {
  version: 'v1';
  adapters: {
    llm: 'azure-openai' | 'openai' | 'anthropic' | 'ollama' | 'mock';
    git: 'github' | 'gitlab' | 'gitea';
    notifier: 'teams' | 'slack' | 'email' | 'console';
    identity: 'entra-group' | 'oidc-group' | 'static-user';
    secrets: 'env' | 'kubernetes' | 'external-secrets';
  };
  cluster: {
    context: string;
    baseDomain?: string;
    ingressClass: string;
    ingressNamespace?: string;
    clusterIssuer?: string;
  };
  namespaces: {
    prefix: string;
    allowedRegistries?: string[];
  };
  ttl: {
    defaultDays: number;
    maxDays: number;
  };
  sizes: {
    small: SizeSpec;
    medium: SizeSpec;
    large: SizeSpec;
  };
  approval: {
    requireAboveSize: 'small' | 'medium' | 'large' | 'none';
    requireAboveTtlDays: number;
  };
  llm?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  git?: {
    repo?: string;
    baseBranch?: string;
    url?: string;
  };
}

export interface SizeSpec {
  cpu: string;
  memory: string;
  pods: number;
}

/**
 * Load and validate devaiportal.config.yaml against the JSON Schema.
 * Fails fast with human-readable error naming the exact key.
 */
export function loadConfig(projectRoot?: string): DevAIPortalConfig {
  const root = projectRoot || process.cwd();
  const configPath = resolve(root, CONFIG_FILE);
  const schemaPath = resolve(root, SCHEMA_FILE);

  if (!existsSync(configPath)) {
    throw new ConfigError(
      `Config file not found: ${configPath}\n` +
      `Copy devaiportal.config.example.yaml to ${CONFIG_FILE} and edit it.`,
    );
  }

  if (!existsSync(schemaPath)) {
    throw new ConfigError(
      `Schema file not found: ${schemaPath}\n` +
      'This file should be in the repo root. Re-clone or check .gitignore.',
    );
  }

  const rawYaml = readFileSync(configPath, 'utf-8');
  const rawSchema = readFileSync(schemaPath, 'utf-8');

  let config: unknown;
  try {
    config = yaml.load(rawYaml);
  } catch (err) {
    throw new ConfigError(`Invalid YAML in ${CONFIG_FILE}: ${(err as Error).message}`);
  }

  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(rawSchema);
  } catch (err) {
    throw new ConfigError(`Invalid JSON in ${SCHEMA_FILE}: ${(err as Error).message}`);
  }

  const ajv = new Ajv({ allErrors: true, verbose: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  if (!validate(config)) {
    const messages = (validate.errors || []).map((e) => {
      const path = e.instancePath || '(root)';
      return `  ${path}: ${e.message}${e.params ? ` (${JSON.stringify(e.params)})` : ''}`;
    });
    throw new ConfigError(
      `Invalid config in ${CONFIG_FILE}:\n${messages.join('\n')}`,
    );
  }

  return config as DevAIPortalConfig;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
