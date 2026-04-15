import { GitHubFile } from './types';

const RELEVANT_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.php'];
const EXCLUDED_PATHS = ['node_modules', 'dist', 'build', '.next', 'vendor', '__pycache__'];
const MAX_FILES = 8;
const MAX_CHARS_PER_FILE = 5000;

export function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
  };
}

export async function fetchRepoFiles(owner: string, repo: string): Promise<GitHubFile[]> {
  const treeController = new AbortController();
  const treeTimeout = setTimeout(() => treeController.abort(), 10_000);

  let treeRes: Response;
  try {
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
    treeRes = await fetch(treeUrl, {
      signal: treeController.signal,
      headers: process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {},
    });
  } finally {
    clearTimeout(treeTimeout);
  }

  if (!treeRes.ok) throw new Error(`GitHub API error: ${treeRes.status}`);

  const tree = await treeRes.json() as { tree: Array<{ type: string; path: string }> };

  const relevant = tree.tree
    .filter(f => f.type === 'blob')
    .filter(f => RELEVANT_EXTENSIONS.some(ext => f.path.endsWith(ext)))
    .filter(f => !EXCLUDED_PATHS.some(excluded => f.path.includes(excluded)))
    .filter(f => !f.path.includes('.test.') && !f.path.includes('.spec.'))
    .slice(0, MAX_FILES);

  const files: GitHubFile[] = [];

  for (const file of relevant) {
    const fileController = new AbortController();
    const fileTimeout = setTimeout(() => fileController.abort(), 5_000);

    try {
      const contentUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`;
      const res = await fetch(contentUrl, {
        signal: fileController.signal,
        headers: process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {},
      });
      if (!res.ok) continue;

      const data = await res.json() as { content: string };
      const content = Buffer.from(data.content, 'base64').toString('utf-8').slice(0, MAX_CHARS_PER_FILE);
      files.push({ path: file.path, content });
    } catch {
      // Skip files that time out or fail
      continue;
    } finally {
      clearTimeout(fileTimeout);
    }
  }

  return files;
}
