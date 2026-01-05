#!/bin/bash

echo "⚡ Performance profiling..."

# Bundle analysis
echo "📊 Analyzing bundle size..."
npm run build -- --analyze

# Lighthouse CI (if configured)
if command -v lhci &> /dev/null; then
    echo "🔍 Running Lighthouse..."
    lhci autorun
fi

echo "✅ Profiling complete"
