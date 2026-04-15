#!/bin/bash
set -e

FUNCTION_NAME="roast-my-repo"
REGION="us-east-1"
ROLE_NAME="roast-my-repo-lambda-role"

echo "=== Roast My Repo — AWS Setup ==="
echo ""

# Validate GROQ_API_KEY is set
if [ -z "$GROQ_API_KEY" ]; then
  echo "ERROR: GROQ_API_KEY environment variable is not set."
  echo "Get a free key at https://console.groq.com"
  exit 1
fi

echo "Step 1/9: Creating IAM role for Lambda..."
ROLE_ARN=$(aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' \
  --query 'Role.Arn' \
  --output text)
echo "  Role ARN: $ROLE_ARN"

echo "Step 2/9: Attaching execution policy..."
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

echo "  Waiting 10s for IAM to propagate..."
sleep 10

echo "Step 3/9: Building project..."
npm run build

echo "Step 4/9: Creating deployment zip..."
cd dist && zip -r ../function.zip . && cd ..
echo "  function.zip size: $(du -sh function.zip | cut -f1)"

echo "Step 5/9: Creating Lambda function..."
# NOTE: GROQ_API_KEY is stored as a plaintext Lambda environment variable.
# Anyone with lambda:GetFunctionConfiguration IAM permission can read it.
# For production systems, use AWS Secrets Manager or SSM Parameter Store instead.
LAMBDA_ARN=$(aws lambda create-function \
  --function-name "$FUNCTION_NAME" \
  --runtime nodejs20.x \
  --role "$ROLE_ARN" \
  --handler handler.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment "Variables={GROQ_API_KEY=$GROQ_API_KEY}" \
  --region "$REGION" \
  --query 'FunctionArn' \
  --output text)
echo "  Lambda ARN: $LAMBDA_ARN"

echo "Step 6/9: Creating API Gateway HTTP API..."
API_ID=$(aws apigatewayv2 create-api \
  --name "$FUNCTION_NAME" \
  --protocol-type HTTP \
  --region "$REGION" \
  --query 'ApiId' \
  --output text)
echo "  API ID: $API_ID"

echo "Step 7/9: Creating Lambda integration..."
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id "$API_ID" \
  --integration-type AWS_PROXY \
  --integration-uri "$LAMBDA_ARN" \
  --payload-format-version 2.0 \
  --region "$REGION" \
  --query 'IntegrationId' \
  --output text)

echo "Step 8/9: Creating POST /roast route and auto-deploy stage..."
aws apigatewayv2 create-route \
  --api-id "$API_ID" \
  --route-key "POST /roast" \
  --target "integrations/$INTEGRATION_ID" \
  --region "$REGION" > /dev/null

aws apigatewayv2 create-stage \
  --api-id "$API_ID" \
  --stage-name '$default' \
  --auto-deploy \
  --region "$REGION" > /dev/null

echo "Step 9/9: Granting API Gateway permission to invoke Lambda..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*" \
  --region "$REGION" > /dev/null

API_URL=$(aws apigatewayv2 get-api --api-id "$API_ID" --query 'ApiEndpoint' --output text --region "$REGION")

echo ""
echo "=== Setup Complete ==="
echo ""
echo "API URL: $API_URL"
echo ""
echo "Test it now:"
echo "  curl -X POST $API_URL/roast \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"repo_url\": \"https://github.com/expressjs/express\"}'"
echo ""
echo "IMPORTANT: Save your API URL as a GitHub Actions secret named API_URL"
echo "Also add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY as GitHub secrets."
