#!/bin/bash
set -e

echo "🔒 Running security scans..."

# Dependency vulnerabilities
echo "📦 Checking dependencies..."
npm audit --audit-level=moderate

# Check for leaked secrets (requires git-secrets or similar)
if command -v git-secrets &> /dev/null; then
    echo "🔐 Scanning for secrets..."
    git secrets --scan
fi

echo "✅ Security scan complete"
