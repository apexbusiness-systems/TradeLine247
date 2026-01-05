#!/bin/bash
set -e

echo "🔍 Running quality checks..."
echo ""

echo "📝 TypeScript compilation..."
npm run typecheck || exit 1

echo "✨ Linting..."
npm run lint || exit 1

echo "🧪 Running tests..."
npm run test || exit 1

echo "🔒 Security audit..."
npm audit --audit-level=high || exit 1

echo ""
echo "✅ ALL QUALITY CHECKS PASSED!"
