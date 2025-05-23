#!/bin/bash

echo "🎓 Setting up FYP Analysis System (React App)"
echo "============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "Download from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "🔧 Creating .env file..."
    cat > .env << EOL
# Optional: Add your Gemini API key for AI-powered categorization
# Get your free API key from: https://makersuite.google.com/app/apikey
# REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
EOL
    echo "✅ .env file created"
fi

echo ""
echo "🚀 Setup complete!"
echo ""
echo "Available commands:"
echo "  npm start     - Start development server"
echo "  npm run build - Build for production"
echo "  npm test      - Run tests"
echo ""
echo "To get started:"
echo "  1. (Optional) Add your Gemini API key to .env file"
echo "  2. Run: npm start"
echo "  3. Open http://localhost:3000 in your browser"
echo ""
echo "Happy coding! 🎉" 