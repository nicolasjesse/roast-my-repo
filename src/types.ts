export interface RoastRequest {
  repo_url: string;
}

export interface RoastResponse {
  roast: string;
  files_analyzed: string[];
  repo: string;
}

export interface GitHubFile {
  path: string;
  content: string;
}
