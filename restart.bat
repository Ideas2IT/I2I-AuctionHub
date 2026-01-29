@echo off
echo ========================================
echo ICL Tournament 2026 - Restarting Application
echo ========================================
echo.

echo Stopping any running processes...
echo.

REM Kill Node.js processes on ports 3000 and 5000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000"') do (
    echo Killing process on port 3000: %%a
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000"') do (
    echo Killing process on port 5000: %%a
    taskkill /F /PID %%a >nul 2>&1
)

REM Kill any node.exe processes (be careful with this)
timeout /t 2 /nobreak >nul
echo.

echo Checking dependencies...
if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install backend dependencies
        pause
        exit /b 1
    )
)

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
echo Starting application...
echo Backend will run on: http://localhost:5000
echo Frontend will run on: http://localhost:3000
echo.
echo Press Ctrl+C to stop both servers
echo.

call npm start

