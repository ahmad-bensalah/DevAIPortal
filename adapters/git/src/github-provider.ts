import type { GitProvider, OpenPrParams, PrResult, HealthResult } from './git-provider.js';

export interface GitHubConfig {
  token?: string;
  repo?: string;
}

export class GitHubProvider implements GitProvider {
  readonly name = 'github';

  private readonly token: string;
  private readonly repo: string;

  constructor(config: GitHubConfig = {}) {
    this.token = config.token || process.env.GIT_TOKEN || '';
    this.repo = config.repo || 'enterprise-org/devaiportal-gitops';
  }

  async openPullRequest(params: OpenPrParams): Promise<PrResult> {
    if (!this.token) {
      return { ok: false, error: 'GIT_TOKEN is not configured for GitHub provider' };
    }

    try {
      // 1. Get default branch commit SHA
      const [owner, repoName] = this.repo.split('/');
      const refRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${params.baseBranch}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'DevAIPortal',
        },
      });

      if (!refRes.ok) {
        return { ok: false, error: `Failed to fetch base branch ref: HTTP ${refRes.status}` };
      }
      const refData = (await refRes.json()) as any;
      const baseSha = refData.object.sha;

      // 2. Create new branch
      const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'DevAIPortal',
        },
        body: JSON.stringify({
          ref: `refs/heads/${params.branch}`,
          sha: baseSha,
        }),
      });

      if (!branchRes.ok && branchRes.status !== 422) {
        return { ok: false, error: `Failed to create branch ${params.branch}: HTTP ${branchRes.status}` };
      }

      // 3. Put file content
      const contentBase64 = Buffer.from(params.fileContent).toString('base64');
      const putRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${params.filePath}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'DevAIPortal',
        },
        body: JSON.stringify({
          message: `chore(env): provision ${params.filePath}`,
          content: contentBase64,
          branch: params.branch,
        }),
      });

      if (!putRes.ok) {
        return { ok: false, error: `Failed to commit file to branch: HTTP ${putRes.status}` };
      }

      // 4. Create Pull Request
      const prRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'DevAIPortal',
        },
        body: JSON.stringify({
          title: params.title,
          body: params.body,
          head: params.branch,
          base: params.baseBranch,
        }),
      });

      if (!prRes.ok) {
        return { ok: false, error: `Failed to create pull request: HTTP ${prRes.status}` };
      }

      const prData = (await prRes.json()) as any;
      return { ok: true, prUrl: prData.html_url, prNumber: prData.number };
    } catch (err) {
      return { ok: false, error: `GitHub API communication error: ${(err as Error).message}` };
    }
  }

  async healthCheck(): Promise<HealthResult> {
    if (!this.token) {
      return { healthy: false, message: 'GIT_TOKEN is not configured for GitHub' };
    }
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'User-Agent': 'DevAIPortal',
        },
      });
      return {
        healthy: res.ok,
        message: res.ok ? 'GitHub token authenticated successfully' : `GitHub returned HTTP ${res.status}`,
      };
    } catch (err) {
      return { healthy: false, message: `GitHub unreachable: ${(err as Error).message}` };
    }
  }
}
