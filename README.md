# roast-my-repo

A public REST API that accepts a GitHub repository URL and returns an AI-generated code review.

## Usage

```bash
curl -X POST https://<your-api-url>/roast \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/expressjs/express"}'
```

**Response:**
```json
{
  "roast": "## The Good\n...\n## The Bad\n...",
  "repo": "expressjs/express",
  "files_analyzed": ["src/index.js", "lib/router/index.js"]
}
```

## Stack

- **Runtime:** Node.js 20 + TypeScript
- **Hosting:** AWS Lambda + API Gateway
- **LLM:** Groq API (`llama-3.3-70b-versatile`)
- **CI/CD:** GitHub Actions — lint, test, build, deploy, smoke test

## Development

```bash
npm install
export GROQ_API_KEY=your_key_here
npx ts-node src/local.ts https://github.com/expressjs/express
```

## Tests

```bash
npm test
```
