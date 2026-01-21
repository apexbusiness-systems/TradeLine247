#!/bin/bash

# TradeLine 24/7 Deployment Script
# Usage: ./scripts/deploy-all.sh

set -e

echo "🚀 Starting Deployment Pre-flight..."

# 1. Linting
echo "🔍 Running Linter..."
npm run lint

# 2. Type Checking
echo "TypeScript Check..."
npm run type-check

# 3. Security Check (Secrets)
if [ ! -f .env ]; then
    echo "⚠️ .env file missing! Deployment requires secrets."
    exit 1
fi

echo "✅ Pre-flight checks passed."

# 4. Deploy Edge Functions
echo "☁️ Deploying Supabase Edge Functions..."
# Deploy only the active telephony functions to avoid potential issues with others
npx supabase functions deploy voice-frontdoor voice-stream voice-action send-sms --no-verify-jwt

echo "🎉 Deployment Complete!"
