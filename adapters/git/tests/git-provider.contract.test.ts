import { describe, it, expect } from 'vitest';
import { GitHubProvider } from '../src/github-provider.js';
import { GitLabProvider } from '../src/gitlab-provider.js';
import { GiteaProvider } from '../src/gitea-provider.js';
import type { GitProvider } from '../src/git-provider.js';

export function gitProviderContractTests(name: string, factory: () => GitProvider) {
  describe(`GitProvider contract: ${name}`, () => {
    it('returns a non-empty provider name', () => {
      const provider = factory();
      expect(provider.name).toBeTruthy();
    });

    it('healthCheck resolves with structured diagnosis', async () => {
      const provider = factory();
      const health = await provider.healthCheck();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('message');
    });

    it('openPullRequest fails cleanly when token is unconfigured', async () => {
      const provider = factory();
      const res = await provider.openPullRequest({
        branch: 'env/test-branch',
        baseBranch: 'main',
        filePath: 'gitops/environments/test/values.yaml',
        fileContent: 'name: test\n',
        title: 'feat: add test env',
        body: 'Automated PR',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/GIT_TOKEN/i);
      }
    });
  });
}

gitProviderContractTests('github', () => new GitHubProvider({ token: '' }));
gitProviderContractTests('gitlab', () => new GitLabProvider({ token: '' }));
gitProviderContractTests('gitea', () => new GiteaProvider({ token: '' }));
