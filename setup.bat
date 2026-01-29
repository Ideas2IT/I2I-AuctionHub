@echo off
chcp 65001 >nul
echo ========================================
echo ICL Tournament 2026 - Auction Application
echo Setup Script
echo ========================================
echo.

REM Check if Node.js is installed
echo [1/6] Checking Node.js installation...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Node.js is not installed or not in PATH
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Minimum version required: v14.0.0
    echo.
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo Node.js version: %NODE_VERSION%
echo.

REM Check if npm is installed
echo [2/6] Checking npm installation...
where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: npm is not installed or not in PATH
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo npm version: %NPM_VERSION%
echo.

REM Check for Excel/CSV file
echo [3/6] Checking for data file...
set DATA_FILE_FOUND=0

if exist "ICL Auction List.xlsx" (
    echo Found: ICL Auction List.xlsx
    set DATA_FILE_FOUND=1
)

if exist "ICL Auction List.csv" (
    echo Found: ICL Auction List.csv
    set DATA_FILE_FOUND=1
)

if exist "*.xlsx" (
    echo Found Excel file(s) in root directory
    set DATA_FILE_FOUND=1
)

if %DATA_FILE_FOUND%==0 (
    echo.
    echo WARNING: No Excel/CSV data file found in root directory
    echo.
    echo Expected files:
    echo   - ICL Auction List.xlsx
    echo   - ICL Auction List.csv
    echo   - Or any .xlsx file in the root directory
    echo.
    echo The application will still run, but you'll need to:
    echo   1. Place your Excel/CSV file in the root directory
    echo   2. Click "Reload from CSV" in Teams or Players page
    echo.
    timeout /t 3 /nobreak >nul
)

echo.

REM Install backend dependencies
echo [4/6] Installing backend dependencies...
if exist "node_modules" (
    echo Backend dependencies already installed, skipping...
) else (
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to install backend dependencies
        echo.
        pause
        exit /b 1
    )
    echo Backend dependencies installed successfully!
)
echo.

REM Install frontend dependencies
echo [5/6] Installing frontend dependencies...
if exist "client\node_modules" (
    echo Frontend dependencies already installed, skipping...
) else (
    cd client
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to install frontend dependencies
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo Frontend dependencies installed successfully!
)
echo.

REM Check database
echo [6/6] Checking database...
if exist "server\auction.db" (
    echo Database file found: server\auction.db
    echo Database will be initialized automatically on first run
) else (
    echo Database will be created automatically on first run
)
echo.

REM Summary
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Installation Summary:
echo   - Node.js: %NODE_VERSION%
echo   - npm: %NPM_VERSION%
echo   - Backend dependencies: Installed
echo   - Frontend dependencies: Installed
echo.

if %DATA_FILE_FOUND%==1 (
    echo Data file: Found
) else (
    echo Data file: Not found (see warning above)
)
echo.

echo Next Steps:
echo   1. Ensure your Excel/CSV file is in the root directory
echo   2. Run 'start.bat' to start the application
echo   3. Or run 'npm start' to start both servers
echo.
echo Default Login Credentials:
echo   Admin: username='admin', password='admin123'
echo   User:  username='user', password='user123'
echo.
echo Application URLs:
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:5000
echo.
echo ========================================
echo.

REM Ask if user wants to start the application
set /p START_NOW="Do you want to start the application now? (Y/N): "
if /i "%START_NOW%"=="Y" (
    echo.
    echo Starting application...
    echo.
    call npm start
) else (
    echo.
    echo Setup complete! Run 'start.bat' when ready to start the application.
    echo.
    pause
)
