#!/bin/bash

echo "🚀 Starting CodeNection AI Development Environment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing extension dependencies..."
    npm install
fi

# Install webview dependencies if needed
if [ ! -d "webview/node_modules" ]; then
    echo "📦 Installing webview dependencies..."
    cd webview
    npm install
    cd ..
fi

# Build the extension
echo "🔨 Building extension..."
npm run compile

# Build the webview
echo "🌐 Building webview..."
npm run webview:build

echo "✅ Development environment ready!"
echo ""
echo "🎯 Next steps:"
echo "1. Press F5 in VS Code to start debugging"
echo "2. Use Ctrl+Shift+A to open the AI chat"
echo "3. Upload documents to test the RAG system"
echo ""
echo "🔄 For webview development with hot reload:"
echo "   cd webview && npm run dev"
echo ""
echo "📦 To package the extension:"
echo "   npm run extension:package" 