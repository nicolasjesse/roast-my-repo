import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { parseRepoUrl, fetchRepoFiles } from './github';
import { getRoast } from './roaster';
import type { RoastRequest, RoastResponse } from './types';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = JSON.parse(event.body ?? '{}') as RoastRequest;

    if (!body.repo_url) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'repo_url is required' }),
      };
    }

    const { owner, repo } = parseRepoUrl(body.repo_url);
    const files = await fetchRepoFiles(owner, repo);

    if (files.length === 0) {
      return {
        statusCode: 422,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No readable source files found in this repository' }),
      };
    }

    const roast = await getRoast(files, `${owner}/${repo}`);

    const response: RoastResponse = {
      roast,
      files_analyzed: files.map(f => f.path),
      repo: `${owner}/${repo}`,
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message }),
    };
  }
}
