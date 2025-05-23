@echo off
echo 🎓 Setting up FYP Analysis System (React App)
echo =============================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js version:
node --version

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ npm version:
npm --version

REM Install dependencies
echo.
echo 📦 Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully!

REM Create .env file if it doesn't exist
if not exist .env (
    echo.
    echo 🔧 Creating .env file...
    (
        echo # Optional: Add your Gemini API key for AI-powered categorization
        echo # Get your free API key from: https://makersuite.google.com/app/apikey
        echo # REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
    ) > .env
    echo ✅ .env file created
)

echo.
echo 🚀 Setup complete!
echo.
echo Available commands:
echo   npm start     - Start development server
echo   npm run build - Build for production
echo   npm test      - Run tests
echo.
echo To get started:
echo   1. (Optional) Add your Gemini API key to .env file
echo   2. Run: npm start
echo   3. Open http://localhost:3000 in your browser
echo.
echo Happy coding! 🎉
pause 