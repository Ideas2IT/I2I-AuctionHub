@echo off
chcp 65001 >nul
echo ========================================
echo ICL Tournament 2026 - Auction Application
echo Stopping Application
echo ========================================
echo.

echo Stopping all application processes...
echo.

REM Function to kill process on a specific port
setlocal enabledelayedexpansion
set PORTS_FOUND=0

REM Check and kill processes on port 3000 (Frontend)
echo Checking port 3000 (Frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    set PID=%%a
    if not "!PID!"=="" (
        echo   Found process: !PID!
        taskkill /F /PID !PID! >nul 2>&1
        if errorlevel 1 (
            echo   Warning: Could not kill process !PID! (may require admin rights)
        ) else (
            echo   Successfully stopped process !PID!
            set PORTS_FOUND=1
        )
    )
)

REM Check and kill processes on port 5000 (Backend)
echo Checking port 5000 (Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do (
    set PID=%%a
    if not "!PID!"=="" (
        echo   Found process: !PID!
        taskkill /F /PID !PID! >nul 2>&1
        if errorlevel 1 (
            echo   Warning: Could not kill process !PID! (may require admin rights)
        ) else (
            echo   Successfully stopped process !PID!
            set PORTS_FOUND=1
        )
    )
)

REM Wait a moment for processes to terminate
timeout /t 1 /nobreak >nul

REM Check for any remaining Node.js processes related to the application
echo.
echo Checking for remaining Node.js processes...
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr "PID:"') do (
    set NODE_PID=%%a
    set NODE_PID=!NODE_PID:PID:=!
    echo   Found Node.js process: !NODE_PID!
    
    REM Check if this process is using our ports
    for /f "tokens=5" %%b in ('netstat -ano ^| findstr "!NODE_PID!" ^| findstr ":3000 :5000"') do (
        echo   Stopping Node.js process !NODE_PID!...
        taskkill /F /PID !NODE_PID! >nul 2>&1
        if errorlevel 1 (
            echo   Warning: Could not kill Node.js process !NODE_PID!
        ) else (
            echo   Successfully stopped Node.js process !NODE_PID!
            set PORTS_FOUND=1
        )
    )
)

echo.

REM Final check
echo Verifying ports are free...
timeout /t 1 /nobreak >nul

set PORT_3000_FREE=1
set PORT_5000_FREE=1

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    set PORT_3000_FREE=0
    echo   WARNING: Port 3000 is still in use
)

netstat -ano | findstr ":5000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    set PORT_5000_FREE=0
    echo   WARNING: Port 5000 is still in use
)

if !PORT_3000_FREE!==1 if !PORT_5000_FREE!==1 (
    echo.
    echo ========================================
    echo Application stopped successfully!
    echo ========================================
    echo.
    echo Ports 3000 and 5000 are now free.
    echo You can now start the application again using 'start.bat'
    echo.
) else (
    echo.
    echo ========================================
    echo Some processes may still be running
    echo ========================================
    echo.
    echo If ports are still in use, you may need to:
    echo   1. Run this script as Administrator
    echo   2. Manually close the processes in Task Manager
    echo   3. Restart your computer if issues persist
    echo.
)

pause
