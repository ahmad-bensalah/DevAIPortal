import { loadConfig, ConfigError } from '../config/index.js';

const root = process.argv[2] || process.cwd();

try {
  const config = loadConfig(root);
  console.log('✓ Config is valid');
  console.log(`  Adapters: llm=${config.adapters.llm} git=${config.adapters.git} notifier=${config.adapters.notifier} identity=${config.adapters.identity}`);
  console.log(`  Cluster:  ${config.cluster.context} (${config.cluster.baseDomain || 'no base domain'})`);
  console.log(`  TTL:      ${config.ttl.defaultDays}d default, ${config.ttl.maxDays}d max`);
  process.exit(0);
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`✗ ${err.message}`);
  } else {
    console.error(`✗ Unexpected error: ${(err as Error).message}`);
  }
  process.exit(1);
}
