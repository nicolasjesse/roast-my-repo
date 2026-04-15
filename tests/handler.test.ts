import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../src/handler';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

vi.mock('../src/github', () => ({
  parseRepoUrl: vi.fn().mockReturnValue({ owner: 'foo', repo: 'bar' }),
  fetchRepoFiles: vi.fn().mockResolvedValue([
    { path: 'src/index.ts', content: 'const x = 1;' },
  ]),
}));

vi.mock('../src/roaster', () => ({
  getRoast: vi.fn().mockResolvedValue('## The Ugly\nYour code hurts my eyes.'),
}));

function makeEvent(body: unknown): APIGatewayProxyEventV2 {
  return { body: JSON.stringify(body) } as unknown as APIGatewayProxyEventV2;
}

describe('handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with roast on valid request', async () => {
    const result = await handler(makeEvent({ repo_url: 'https://github.com/foo/bar' }));
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body as string);
    expect(body.roast).toBe('## The Ugly\nYour code hurts my eyes.');
    expect(body.repo).toBe('foo/bar');
    expect(body.files_analyzed).toEqual(['src/index.ts']);
  });

  it('returns 400 when repo_url is missing', async () => {
    const result = await handler(makeEvent({}));
    expect(result.statusCode).toBe(400);

    const body = JSON.parse(result.body as string);
    expect(body.error).toBe('repo_url is required');
  });

  it('returns 400 when body is empty', async () => {
    const event = { body: null } as unknown as APIGatewayProxyEventV2;
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it('returns 422 when no files are found in repo', async () => {
    const { fetchRepoFiles } = await import('../src/github');
    vi.mocked(fetchRepoFiles).mockResolvedValueOnce([]);

    const result = await handler(makeEvent({ repo_url: 'https://github.com/foo/empty' }));
    expect(result.statusCode).toBe(422);

    const body = JSON.parse(result.body as string);
    expect(body.error).toContain('No readable source files');
  });

  it('returns 500 on unexpected error', async () => {
    const { fetchRepoFiles } = await import('../src/github');
    vi.mocked(fetchRepoFiles).mockRejectedValueOnce(new Error('Network failure'));

    const result = await handler(makeEvent({ repo_url: 'https://github.com/foo/bar' }));
    expect(result.statusCode).toBe(500);

    const body = JSON.parse(result.body as string);
    expect(body.error).toBe('Network failure');
  });
});
