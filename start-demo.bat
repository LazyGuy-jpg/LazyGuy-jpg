@echo off
echo 🚀 Starting Asterisk ARI React Dashboard Demo
echo ==============================================

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js version 16 or higher.
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm is not installed. Please install npm.
    pause
    exit /b 1
)

echo ✅ Node.js and npm are installed

REM Install React app dependencies
echo 📦 Installing React app dependencies...
call npm install

REM Install demo server dependencies
echo 📦 Installing demo server dependencies...
call npm install express socket.io cors nodemon

echo ✅ All dependencies installed

REM Start demo server
echo 🖥️ Starting demo server...
start /b node demo-server.js

REM Wait a moment for server to start
timeout /t 3 /nobreak >nul

REM Start React development server
echo ⚛️ Starting React development server...
echo 📊 Dashboard will open at http://localhost:3000
echo 🔧 Demo API running at http://localhost:8080
echo.
echo 🔴 Press Ctrl+C to stop the React server, then close this window

call npm run dev

echo 👋 Demo stopped. Thanks for trying the Asterisk ARI Dashboard!
pause