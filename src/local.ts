import { handler } from './handler';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

const repoUrl = process.argv[2] ?? 'https://github.com/expressjs/express';

console.log(`Roasting: ${repoUrl}\n`);

const mockEvent: APIGatewayProxyEventV2 = {
  body: JSON.stringify({ repo_url: repoUrl }),
} as unknown as APIGatewayProxyEventV2;

handler(mockEvent).then(result => {
  if (typeof result === 'string') {
    console.error('Unexpected string response:', result);
    return;
  }
  const body = JSON.parse(result.body as string);
  if (result.statusCode === 200) {
    console.log(`Files analyzed: ${body.files_analyzed.join(', ')}\n`);
    console.log(body.roast);
  } else {
    console.error('Error:', body.error);
  }
}).catch(console.error);
