@echo off
chcp 65001 >nul
echo ========================================
echo ICL Tournament 2026 - Auction Application
echo Reload Data from CSV/Excel
echo ========================================
echo.

REM Check if server is running on port 5000
echo Checking if server is running...
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Server is not running on port 5000!
    echo Please start the server first using 'start.bat'
    echo.
    pause
    exit /b 1
)

echo Server is running.
echo.

REM Confirm before proceeding
echo WARNING: This will:
echo   - Remove ALL existing players and teams data
echo   - Load fresh data from the CSV/Excel file
echo   - Reset all team spending and player status
echo   - This action CANNOT be undone!
echo.
set /p confirm="Are you sure you want to continue? (yes/no): "
if /i not "%confirm%"=="yes" (
    echo.
    echo Operation cancelled.
    pause
    exit /b 0
)

echo.
echo Reloading data from CSV/Excel file...
echo.

REM Use PowerShell to make the POST request
powershell -Command "$response = Invoke-RestMethod -Uri 'http://localhost:5000/api/teams/reload-csv' -Method Post -ContentType 'application/json'; Write-Host $response.message"

if errorlevel 1 (
    echo.
    echo ERROR: Failed to reload data from CSV/Excel.
    echo Please check:
    echo   1. Server is running on http://localhost:5000
    echo   2. CSV/Excel file exists in the server directory
    echo   3. File format is correct
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Data reloaded successfully!
echo ========================================
echo.
echo The application will now have fresh data from the CSV/Excel file.
echo You may need to refresh your browser to see the changes.
echo.
pause
