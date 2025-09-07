@echo off
echo 🚀 CodeNection AI Extension - Development Testing
echo.

echo 📦 Compiling extension...
call npm run compile
if %errorlevel% neq 0 (
    echo ❌ Compilation failed!
    pause
    exit /b 1
)

echo ✅ Compilation successful!
echo.
echo 🧪 Ready to test! 
echo.
echo 📋 Next steps:
echo 1. Press F5 to launch Extension Development Host
echo 2. In the new window, add a real project folder
echo 3. Test your AI features on real code:
echo    - Click AI Chat button in status bar
echo    - Hover over code for AI insights  
echo    - Right-click selected text → "Ask AI About Selection"
echo    - Use Command Palette → "CodeNection" commands
echo.
echo 💡 Development Tips:
echo - Make changes to extension code
echo - Reload Window (Ctrl+Shift+P → "Developer: Reload Window")
echo - Test again with real project
echo.
echo 🎯 This gives you fast iteration with real project testing!
echo.
pause
