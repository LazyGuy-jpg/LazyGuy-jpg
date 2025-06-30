#!/bin/bash

echo "🚀 Starting Asterisk ARI React Dashboard Demo"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js version 16 or higher."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install React app dependencies
echo "📦 Installing React app dependencies..."
npm install

# Install demo server dependencies
echo "📦 Installing demo server dependencies..."
npm install --prefix . express socket.io cors nodemon

echo "✅ All dependencies installed"

# Start demo server in background
echo "🖥️ Starting demo server..."
node demo-server.js &
DEMO_SERVER_PID=$!

# Wait a moment for server to start
sleep 3

# Start React development server
echo "⚛️ Starting React development server..."
echo "📊 Dashboard will open at http://localhost:3000"
echo "🔧 Demo API running at http://localhost:8080"
echo ""
echo "🔴 Press Ctrl+C to stop both servers"

# Start React app
npm run dev

# Cleanup: kill demo server when React app exits
echo "🛑 Stopping demo server..."
kill $DEMO_SERVER_PID 2>/dev/null

echo "👋 Demo stopped. Thanks for trying the Asterisk ARI Dashboard!"