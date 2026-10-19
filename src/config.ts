/** Public GitHub repository of Agent Canvas (support tickets, releases, auto-updates). */
export const GITHUB_OWNER = 'Triplex78654';
export const GITHUB_REPO = 'agent-canvas';
export const REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

/** Prefilled "new issue" link (GitHub limits URL length, so the body is trimmed). */
export function buildIssueUrl(title: string, body: string): string {
  const params = new URLSearchParams({ title: title.slice(0, 200), body: body.slice(0, 6000) });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}
