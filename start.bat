@echo off
echo ========================================
echo ICL Tournament 2026 - Auction Application
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install backend dependencies
        pause
        exit /b 1
    )
)

REM Check if client/node_modules exists
if not exist "client\node_modules" (
    echo Installing frontend dependencies...
    cd client
    call npm install
    if errorlevel 1 (
        echo Failed to install frontend dependencies
        cd ..
        pause
        exit /b 1
    )
    cd ..
)

echo.
echo Starting both frontend and backend servers...
echo Backend will run on: http://localhost:5000
echo Frontend will run on: http://localhost:3000
echo.
echo Press Ctrl+C to stop both servers
echo.

call npm start
