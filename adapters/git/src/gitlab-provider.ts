import type { GitProvider, OpenPrParams, PrResult, HealthResult } from './git-provider.js';

export interface GitLabConfig {
  token?: string;
  projectId?: string;
  baseUrl?: string;
}

export class GitLabProvider implements GitProvider {
  readonly name = 'gitlab';

  private readonly token: string;
  private readonly projectId: string;
  private readonly baseUrl: string;

  constructor(config: GitLabConfig = {}) {
    this.token = config.token || process.env.GIT_TOKEN || '';
    this.projectId = config.projectId || process.env.GITLAB_PROJECT_ID || 'enterprise-org/devaiportal-gitops';
    this.baseUrl = config.baseUrl || process.env.GITLAB_BASE_URL || 'https://gitlab.com';
  }

  async openPullRequest(params: OpenPrParams): Promise<PrResult> {
    if (!this.token) {
      return { ok: false, error: 'GIT_TOKEN is not configured for GitLab provider' };
    }

    try {
      const encodedProject = encodeURIComponent(this.projectId);
      const headers = {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
      };

      // 1. Create branch
      const branchRes = await fetch(`${this.baseUrl}/api/v4/projects/${encodedProject}/repository/branches`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          branch: params.branch,
          ref: params.baseBranch,
        }),
      });

      if (!branchRes.ok && branchRes.status !== 400) {
        return { ok: false, error: `Failed to create GitLab branch: HTTP ${branchRes.status}` };
      }

      // 2. Commit file
      const commitRes = await fetch(`${this.baseUrl}/api/v4/projects/${encodedProject}/repository/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          branch: params.branch,
          commit_message: params.title,
          actions: [
            {
              action: 'create',
              file_path: params.filePath,
              content: params.fileContent,
            },
          ],
        }),
      });

      if (!commitRes.ok) {
        return { ok: false, error: `Failed to commit to GitLab branch: HTTP ${commitRes.status}` };
      }

      // 3. Create Merge Request
      const mrRes = await fetch(`${this.baseUrl}/api/v4/projects/${encodedProject}/merge_requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          source_branch: params.branch,
          target_branch: params.baseBranch,
          title: params.title,
          description: params.body,
          labels: params.labels?.join(','),
        }),
      });

      if (!mrRes.ok) {
        return { ok: false, error: `Failed to create GitLab MR: HTTP ${mrRes.status}` };
      }

      const mrData = (await mrRes.json()) as any;
      return {
        ok: true,
        prUrl: mrData.web_url,
        prNumber: mrData.iid,
      };
    } catch (err) {
      return { ok: false, error: `GitLab provider error: ${(err as Error).message}` };
    }
  }

  async healthCheck(): Promise<HealthResult> {
    if (!this.token) {
      return { healthy: false, message: 'GIT_TOKEN environment variable is missing' };
    }

    try {
      const encodedProject = encodeURIComponent(this.projectId);
      const res = await fetch(`${this.baseUrl}/api/v4/projects/${encodedProject}`, {
        headers: { 'PRIVATE-TOKEN': this.token },
      });
      if (res.ok) {
        return { healthy: true, message: `Connected to GitLab project ${this.projectId}` };
      }
      return { healthy: false, message: `GitLab API responded with HTTP ${res.status}` };
    } catch (err) {
      return { healthy: false, message: `GitLab connectivity failed: ${(err as Error).message}` };
    }
  }
}
