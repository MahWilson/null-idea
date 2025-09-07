@echo off
echo 🚀 Starting CodeNection AI Development Environment...

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the project root directory
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing extension dependencies...
    npm install
)

REM Install webview dependencies if needed
if not exist "webview\node_modules" (
    echo 📦 Installing webview dependencies...
    cd webview
    npm install
    cd ..
)

REM Build the extension
echo 🔨 Building extension...
npm run compile

REM Build the webview
echo 🌐 Building webview...
npm run webview:build

echo ✅ Development environment ready!
echo.
echo 🎯 Next steps:
echo 1. Press F5 in VS Code to start debugging
echo 2. Use Ctrl+Shift+A to open the AI chat
echo 3. Upload documents to test the RAG system
echo.
echo 🔄 For webview development with hot reload:
echo    cd webview ^&^& npm run dev
echo.
echo 📦 To package the extension:
echo    npm run extension:package
pause 