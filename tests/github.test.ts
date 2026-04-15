import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseRepoUrl, fetchRepoFiles } from '../src/github';

describe('parseRepoUrl', () => {
  it('parses a standard GitHub URL', () => {
    const result = parseRepoUrl('https://github.com/expressjs/express');
    expect(result).toEqual({ owner: 'expressjs', repo: 'express' });
  });

  it('strips .git suffix', () => {
    const result = parseRepoUrl('https://github.com/expressjs/express.git');
    expect(result).toEqual({ owner: 'expressjs', repo: 'express' });
  });

  it('throws on invalid URL', () => {
    expect(() => parseRepoUrl('https://gitlab.com/foo/bar')).toThrow('Invalid GitHub URL');
  });
});

describe('fetchRepoFiles', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns relevant source files from a repo', async () => {
    const mockTree = {
      tree: [
        { type: 'blob', path: 'src/index.ts' },
        { type: 'blob', path: 'src/utils.ts' },
        { type: 'blob', path: 'README.md' },
        { type: 'blob', path: 'node_modules/foo/bar.ts' },
        { type: 'tree', path: 'src' },
      ],
    };

    const mockContent = { content: Buffer.from('const x = 1;').toString('base64') };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockTree } as any)
      .mockResolvedValue({ ok: true, json: async () => mockContent } as any);

    const files = await fetchRepoFiles('expressjs', 'express');

    expect(files).toHaveLength(2);
    expect(files[0].path).toBe('src/index.ts');
    expect(files[0].content).toBe('const x = 1;');
  });

  it('returns empty array when GitHub API fails', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 } as any);

    await expect(fetchRepoFiles('foo', 'nonexistent')).rejects.toThrow('GitHub API error: 404');
  });

  it('skips files that fail to fetch individually', async () => {
    const mockTree = {
      tree: [
        { type: 'blob', path: 'src/index.ts' },
        { type: 'blob', path: 'src/broken.ts' },
      ],
    };

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockTree } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: Buffer.from('good file').toString('base64') }) } as any)
      .mockResolvedValueOnce({ ok: false, status: 403 } as any);

    const files = await fetchRepoFiles('foo', 'bar');
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('src/index.ts');
  });
});
