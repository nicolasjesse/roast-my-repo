import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPrompt, getRoast } from '../src/roaster';
import { GitHubFile } from '../src/types';

const sampleFiles: GitHubFile[] = [
  { path: 'src/index.ts', content: 'const x = 1;\nexport default x;' },
  { path: 'src/utils.ts', content: 'export function add(a: number, b: number) { return a + b; }' },
];

describe('buildPrompt', () => {
  it('includes the repo name in the prompt', () => {
    const prompt = buildPrompt(sampleFiles, 'expressjs/express');
    expect(prompt).toContain('expressjs/express');
  });

  it('includes all file paths in the prompt', () => {
    const prompt = buildPrompt(sampleFiles, 'foo/bar');
    expect(prompt).toContain('src/index.ts');
    expect(prompt).toContain('src/utils.ts');
  });

  it('includes file contents in the prompt', () => {
    const prompt = buildPrompt(sampleFiles, 'foo/bar');
    expect(prompt).toContain('const x = 1;');
  });
});

describe('getRoast', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GROQ_API_KEY = 'test-key';
  });

  it('returns the roast string from Groq response', async () => {
    const mockResponse = {
      choices: [{ message: { content: '## The Ugly\nThis code is a crime.' } }],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const roast = await getRoast(sampleFiles, 'foo/bar');
    expect(roast).toBe('## The Ugly\nThis code is a crime.');
  });

  it('sends the correct model and API endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'roast' } }] }),
    } as any);

    await getRoast(sampleFiles, 'foo/bar');

    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');

    const body = JSON.parse(options.body);
    expect(body.model).toBe('llama-3.3-70b-versatile');
  });

  it('throws when Groq API returns an error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 429 } as any);

    await expect(getRoast(sampleFiles, 'foo/bar')).rejects.toThrow('Groq API error: 429');
  });
});
