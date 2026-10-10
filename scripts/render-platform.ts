import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import yaml from 'js-yaml';
import { loadConfig } from '../config/index.js';

export interface RenderPlatformOptions {
  projectRoot?: string;
  configPath?: string;
  checkOnly?: boolean;
}

export function renderPlatform(options: RenderPlatformOptions = {}) {
  const root = options.projectRoot || process.cwd();
  const config = loadConfig(root);

  const platformData = {
    sizes: config.sizes,
    cluster: {
      baseDomain: config.cluster.baseDomain || '',
      ingressClass: config.cluster.ingressClass,
      ingressNamespace: config.cluster.ingressNamespace || 'ingress-nginx',
      clusterIssuer: config.cluster.clusterIssuer || '',
    },
    namespaces: {
      prefix: config.namespaces.prefix,
      allowedRegistries: config.namespaces.allowedRegistries || ['docker.io'],
    },
    ttl: config.ttl,
    approval: config.approval,
  };

  const platformYamlContent =
    `# AUTO-GENERATED from devaiportal.config.yaml by scripts/render-platform.ts\n` +
    `# DO NOT EDIT DIRECTLY. Run 'make render-platform' to update.\n` +
    yaml.dump(platformData, { indent: 2, lineWidth: -1 });

  const platformTarget = resolve(root, 'charts/environment/files/platform.yaml');

  const registries = config.namespaces.allowedRegistries && config.namespaces.allowedRegistries.length > 0
    ? config.namespaces.allowedRegistries
    : ['docker.io'];

  const registryPatterns = registries.map(r => `${r}/*`).join(' | ');

  const kyvernoPolicyData = {
    apiVersion: 'kyverno.io/v1',
    kind: 'ClusterPolicy',
    metadata: {
      name: 'check-image-registry',
      annotations: {
        'policies.kyverno.io/title': 'Allowed Image Registries',
        'policies.kyverno.io/category': 'Supply Chain Security',
        'policies.kyverno.io/severity': 'medium',
        'policies.kyverno.io/description':
          'Validates that all container images come exclusively from platform-approved registries.',
      },
    },
    spec: {
      validationFailureAction: 'Enforce',
      background: true,
      rules: [
        {
          name: 'validate-registries',
          match: {
            any: [
              {
                resources: {
                  kinds: ['Pod'],
                  namespaces: [`${config.namespaces.prefix}-*`],
                },
              },
            ],
          },
          validate: {
            message: `Images must originate from authorized registries (${registries.join(', ')}).`,
            pattern: {
              spec: {
                containers: [
                  {
                    image: registryPatterns,
                  },
                ],
              },
            },
          },
        },
      ],
    },
  };

  const kyvernoYamlContent =
    `# AUTO-GENERATED from devaiportal.config.yaml by scripts/render-platform.ts\n` +
    `# DO NOT EDIT DIRECTLY. Run 'make render-platform' to update.\n` +
    yaml.dump(kyvernoPolicyData, { indent: 2, lineWidth: -1 });

  const kyvernoTarget = resolve(root, 'policies/registry-allowlist.yaml');

  if (options.checkOnly) {
    let hasDrift = false;
    try {
      const currentPlatform = readFileSync(platformTarget, 'utf-8');
      if (currentPlatform !== platformYamlContent) {
        console.error(`✗ Drift detected in ${platformTarget}`);
        hasDrift = true;
      }
    } catch {
      console.error(`✗ Missing target file: ${platformTarget}`);
      hasDrift = true;
    }

    try {
      const currentKyverno = readFileSync(kyvernoTarget, 'utf-8');
      if (currentKyverno !== kyvernoYamlContent) {
        console.error(`✗ Drift detected in ${kyvernoTarget}`);
        hasDrift = true;
      }
    } catch {
      console.error(`✗ Missing target file: ${kyvernoTarget}`);
      hasDrift = true;
    }

    if (hasDrift) {
      throw new Error("Platform configuration drift detected! Run 'make render-platform' and commit the result.");
    }
    return;
  }

  mkdirSync(dirname(platformTarget), { recursive: true });
  writeFileSync(platformTarget, platformYamlContent, 'utf-8');
  console.log(`✓ Rendered: ${platformTarget}`);

  mkdirSync(dirname(kyvernoTarget), { recursive: true });
  writeFileSync(kyvernoTarget, kyvernoYamlContent, 'utf-8');
  console.log(`✓ Rendered: ${kyvernoTarget}`);
}

const isMain = process.argv[1] && process.argv[1].endsWith('render-platform.ts');
if (isMain) {
  const isCheck = process.argv.includes('--check');
  try {
    renderPlatform({ checkOnly: isCheck });
    if (isCheck) {
      console.log('✓ Platform configuration and Kyverno policies are in sync.');
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
