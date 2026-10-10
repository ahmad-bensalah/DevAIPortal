/**
 * GitProvider — interface for opening pull requests against the GitOps repo.
 *
 * The provider creates a branch, commits the values file, and opens a PR.
 * It does NOT merge; that requires review or auto-merge policy.
 */
export interface GitProvider {
  readonly name: string;

  /**
   * Create a pull request that adds or updates a file.
   * @param params.branch — new branch name (caller generates it)
   * @param params.baseBranch — target branch for the PR
   * @param params.filePath — path within the repo (e.g. environments/my-env/values.yaml)
   * @param params.fileContent — full file content (UTF-8)
   * @param params.title — PR title
   * @param params.body — PR description (markdown)
   * @param params.labels — labels to apply
   * @returns the PR URL and number
   */
  openPullRequest(params: OpenPrParams): Promise<PrResult>;

  /** Verify auth and repo write access. */
  healthCheck(): Promise<HealthResult>;
}

export interface OpenPrParams {
  branch: string;
  baseBranch: string;
  filePath: string;
  fileContent: string;
  title: string;
  body: string;
  labels?: string[];
}

export type PrResult =
  | { ok: true; prUrl: string; prNumber: number }
  | { ok: false; error: string };

export interface HealthResult {
  healthy: boolean;
  message: string;
}
