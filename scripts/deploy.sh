#!/bin/bash
set -e

FUNCTION_NAME="roast-my-repo"
REGION="us-east-1"

echo "Building..."
npm run build

echo "Packaging..."
cd dist && zip -r ../function.zip . && cd ..

echo "Deploying to Lambda..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://function.zip \
  --region "$REGION" \
  --query 'CodeSize' \
  --output text | xargs -I{} echo "  Deployed {} bytes"

echo "Done."
