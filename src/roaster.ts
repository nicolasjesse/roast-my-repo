import { GitHubFile } from './types';

export function buildPrompt(files: GitHubFile[], repo: string): string {
  const fileContents = files
    .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  return `You are a senior software engineer doing a brutal but educational code review of the GitHub repository "${repo}".

Be specific, be honest, be a little funny. Point out actual code quality issues, bad patterns, missing tests, or questionable decisions. Reference specific files and line numbers where possible. Don't be generic.

Structure your response with these exact sections:
**The Good** — 1-2 things done well (be genuine, not patronizing)
**The Bad** — the main issues (at least 3 specific ones)
**The Ugly** — the single most egregious thing you found
**Verdict** — one brutal sentence summary

Here are the key source files:

${fileContents}`;
}

export async function getRoast(files: GitHubFile[], repo: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let response: Response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: buildPrompt(files, repo) }],
        max_tokens: 1024,
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new Error(`Groq API error: ${response.status}`);

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}
