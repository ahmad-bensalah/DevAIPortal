import type { GitProvider, OpenPrParams, PrResult, HealthResult } from './git-provider.js';

export interface GiteaConfig {
  token?: string;
  repo?: string;
  baseUrl?: string;
}

export class GiteaProvider implements GitProvider {
  readonly name = 'gitea';

  private readonly token: string;
  private readonly repo: string;
  private readonly baseUrl: string;

  constructor(config: GiteaConfig = {}) {
    this.token = config.token || process.env.GIT_TOKEN || '';
    this.repo = config.repo || 'enterprise-org/devaiportal-gitops';
    this.baseUrl = config.baseUrl || process.env.GITEA_BASE_URL || 'http://localhost:3000';
  }

  async openPullRequest(params: OpenPrParams): Promise<PrResult> {
    if (!this.token) {
      return { ok: false, error: 'GIT_TOKEN is not configured for Gitea provider' };
    }

    try {
      const [owner, repoName] = this.repo.split('/');
      const headers = {
        Authorization: `token ${this.token}`,
        'Content-Type': 'application/json',
      };

      // 1. Create branch from base branch
      const branchRes = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repoName}/branches`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          new_branch_name: params.branch,
          old_branch_name: params.baseBranch,
        }),
      });

      if (!branchRes.ok && branchRes.status !== 409) {
        return { ok: false, error: `Failed to create Gitea branch: HTTP ${branchRes.status}` };
      }

      // 2. Create or update file
      const fileRes = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repoName}/contents/${params.filePath}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          branch: params.branch,
          content: Buffer.from(params.fileContent).toString('base64'),
          message: params.title,
        }),
      });

      if (!fileRes.ok) {
        return { ok: false, error: `Failed to write file on Gitea: HTTP ${fileRes.status}` };
      }

      // 3. Open Pull Request
      const prRes = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repoName}/pulls`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          head: params.branch,
          base: params.baseBranch,
          title: params.title,
          body: params.body,
        }),
      });

      if (!prRes.ok) {
        return { ok: false, error: `Failed to open Gitea PR: HTTP ${prRes.status}` };
      }

      const prData = (await prRes.json()) as any;
      return {
        ok: true,
        prUrl: prData.html_url,
        prNumber: prData.number,
      };
    } catch (err) {
      return { ok: false, error: `Gitea provider error: ${(err as Error).message}` };
    }
  }

  async healthCheck(): Promise<HealthResult> {
    if (!this.token) {
      return { healthy: false, message: 'GIT_TOKEN environment variable is missing' };
    }

    try {
      const [owner, repoName] = this.repo.split('/');
      const res = await fetch(`${this.baseUrl}/api/v1/repos/${owner}/${repoName}`, {
        headers: { Authorization: `token ${this.token}` },
      });
      if (res.ok) {
        return { healthy: true, message: `Connected to Gitea repo ${this.repo}` };
      }
      return { healthy: false, message: `Gitea API returned HTTP ${res.status}` };
    } catch (err) {
      return { healthy: false, message: `Gitea connectivity failed: ${(err as Error).message}` };
    }
  }
}
