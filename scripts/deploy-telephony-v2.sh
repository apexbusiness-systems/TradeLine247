#!/usr/bin/env bash
# Telephony Stack V2 Enterprise - Deployment Script
# Usage: ./deploy-telephony-v2.sh

set -e

echo "🚀 Deploying Telephony Stack V2 Enterprise..."
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found. Please install it first."
    echo "   npm install -g supabase"
    exit 1
fi

# Verify we're in the right directory
if [ ! -d "supabase/functions" ]; then
    echo "❌ Error: Not in project root. Please run from TradeLine247 directory."
    exit 1
fi

echo "📋 Pre-deployment Checklist:"
echo ""

# Check for required environment variables
echo "Checking environment variables..."
REQUIRED_VARS=("TWILIO_AUTH_TOKEN" "OPENAI_API_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! supabase secrets list | grep -q "$var"; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "⚠️  Warning: Missing environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Set them with: supabase secrets set $var=value"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ All required environment variables found"
fi

echo ""
echo "📦 Deploying functions..."
echo ""

# Deploy voice-frontdoor
echo "1/3 Deploying voice-frontdoor..."
if supabase functions deploy voice-frontdoor --no-verify-jwt; then
    echo "✅ voice-frontdoor deployed successfully"
else
    echo "❌ voice-frontdoor deployment failed"
    exit 1
fi

echo ""

# Deploy voice-stream
echo "2/3 Deploying voice-stream..."
if supabase functions deploy voice-stream --no-verify-jwt; then
    echo "✅ voice-stream deployed successfully"
else
    echo "❌ voice-stream deployment failed"
    exit 1
fi

echo ""

# Deploy voice-action
echo "3/3 Deploying voice-action..."
if supabase functions deploy voice-action --no-verify-jwt; then
    echo "✅ voice-action deployed successfully"
else
    echo "❌ voice-action deployment failed"
    exit 1
fi

echo ""
echo "🎉 All functions deployed successfully!"
echo ""

# Get project reference
PROJECT_REF=$(supabase status | grep "API URL" | awk '{print $3}' | sed 's/https:\/\///' | sed 's/.supabase.co//')

echo "📝 Next Steps:"
echo ""
echo "1. Configure Twilio Webhook URLs:"
echo "   Voice URL: https://${PROJECT_REF}.supabase.co/functions/v1/voice-frontdoor"
echo "   Status Callback: https://${PROJECT_REF}.supabase.co/functions/v1/voice-action"
echo ""
echo "2. Test with a phone call"
echo ""
echo "3. Monitor logs:"
echo "   supabase functions logs voice-frontdoor --tail"
echo "   supabase functions logs voice-stream --tail"
echo "   supabase functions logs voice-action --tail"
echo ""
echo "✨ Deployment complete!"
