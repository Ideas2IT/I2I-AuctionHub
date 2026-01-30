# ICL Tournament 2026 - Auction Application Setup Guide

Complete setup instructions for the ICL Tournament 2026 Auction Application.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation](#installation)
3. [Data File Setup](#data-file-setup)
4. [Database Configuration](#database-configuration)
5. [User Authentication](#user-authentication)
6. [Running the Application](#running-the-application)
7. [Application Features](#application-features)
8. [Troubleshooting](#troubleshooting)
9. [Project Structure](#project-structure)

---

## System Requirements

### Minimum Requirements:
- **Node.js**: Version 14.0.0 or higher
- **npm**: Version 6.0.0 or higher (comes with Node.js)
- **Operating System**: Windows, macOS, or Linux
- **RAM**: Minimum 4GB
- **Disk Space**: 500MB free space

### Recommended:
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher
- **RAM**: 8GB or more
- **Browser**: Chrome, Firefox, Edge, or Safari (latest version)

### Verify Installation:
```bash
node --version    # Should show v14.0.0 or higher
npm --version     # Should show 6.0.0 or higher
```

---

## Installation

### Quick Setup (Windows - Recommended)

For Windows users, use the automated setup script:

1. **Run the setup script:**
   ```bash
   setup.bat
   ```

   This script will:
   - Check Node.js and npm installation
   - Verify data file (Excel/CSV) presence
   - Install all dependencies automatically
   - Check database status
   - Optionally start the application

2. **Follow the prompts** - The script will guide you through the setup process

### Manual Installation

#### Step 1: Download/Clone the Project

If you have the project files, navigate to the project directory:
```bash
cd ICL
```

#### Step 2: Install Dependencies

##### Option A: Install All Dependencies at Once (Recommended)
```bash
npm run install-all
```

This command will:
- Install backend dependencies (root directory)
- Install frontend dependencies (client directory)

##### Option B: Install Separately

**Backend Dependencies:**
```bash
npm install
```

**Frontend Dependencies:**
```bash
cd client
npm install
cd ..
```

#### Step 3: Verify Installation

Check that all dependencies are installed:
```bash
# Check backend dependencies
ls node_modules

# Check frontend dependencies
ls client/node_modules
```

---

## Data File Setup

### Excel File Setup

The application requires an Excel file (`.xlsx`) with player and team data.

#### File Requirements:
1. **File Name**: `ICL Auction List.xlsx` (or any `.xlsx` file in the root directory)
2. **File Location**: Root directory (same folder as `package.json`)
3. **File Format**: Microsoft Excel (.xlsx)

#### Excel File Structure:

Your Excel file should contain at least two sheets:

**Sheet 1: Team Data**
- Sheet name should contain "team" (case-insensitive)
- Required columns:
  - `Name` or `Team Name`: Team name
  - `Budget`: Total budget for the team (numeric)

**Sheet 2: Player Data**
- Sheet name should contain "player" (case-insensitive)
- Required columns:
  - `Name` or `Email`: Player name/email
  - `Base Price`: Starting bid price (numeric)
  - `Category`: Player category (e.g., Batsman, Bowler, All Rounder)
  - `Employee ID`: Employee identification number (optional)

#### Example Excel Structure:

**Teams Sheet:**
| Name      | Budget  |
|-----------|---------|
| BLASTERS  | 100000  |
| DESTROYERS| 100000  |

**Players Sheet:**
| Name                    | Email                    | Base Price | Category   | Employee ID |
|-------------------------|--------------------------|------------|------------|-------------|
| John Doe                | john@example.com         | 10000      | Batsman    | E001        |
| Jane Smith              | jane@example.com         | 15000      | Bowler     | E002        |

#### File Location:
```
ICL/
├── ICL Auction List.xlsx  ← Place your Excel file here
├── package.json
├── server/
└── client/
```

### CSV File Alternative

If you prefer CSV format:
1. Export your Excel file as CSV
2. Save as `ICL Auction List.csv` in the root directory
3. Note: CSV can only contain one sheet, so you may need separate files

---

## Database Configuration

### Automatic Database Initialization

The database is automatically created and initialized on first run:
- **Database File**: `server/auction.db`
- **Database Type**: SQLite
- **Auto-created**: Yes (on first server start)

### Database Tables

The application creates the following tables automatically:

1. **teams**
   - `id`: Team ID (auto-increment)
   - `name`: Team name
   - `budget`: Total budget
   - `spent`: Amount spent
   - `players_count`: Number of players purchased

2. **players**
   - `id`: Player ID (auto-increment, starts from 1)
   - `name`: Player name/email
   - `base_price`: Base price
   - `category`: Player category
   - `employee_id`: Employee ID
   - `status`: Player status (sold/unsold)
   - `team_id`: Assigned team ID (if sold)
   - `sold_price`: Final bid price (if sold)

3. **bids**
   - `id`: Bid ID
   - `player_id`: Player ID
   - `team_id`: Team ID
   - `amount`: Bid amount
   - `timestamp`: Bid timestamp

### Loading Data from Excel/CSV

Data is automatically loaded from the Excel/CSV file when:
- The server starts for the first time
- You click "Reload from CSV" in the Teams or Players page (Admin only)

**Note**: Reloading data will:
- Clear all existing players and teams
- Reset all team spending and player status
- Load fresh data from the Excel/CSV file

---

## User Authentication

There are **no default usernames or passwords**. All accounts are created via **Sign up** on the login screen. Passwords are stored using secure hashing (bcrypt).

### Sign Up Flow

1. Open the application (e.g. http://localhost:3000).
2. On the login screen, click **Sign up**.
3. Choose a **username** (at least 2 characters) and **password** (at least 6 characters).
4. Confirm your password and submit. The first user to sign up is automatically given **admin** role; all later sign-ups get **user** role.

### Roles

- **Admin**: Full access — create/edit/delete teams, sell players, bundle auction, reload data from CSV, edit sold player details.
- **User**: View-only — view teams, players, and auction dashboard; download CSV; cannot sell, edit, or delete.

### Security

- Passwords are hashed with bcrypt before storage; they are never stored in plain text.
- No credentials are hardcoded in the application.

---

## Running the Application

### Quick Start (Recommended)

#### Windows:
```bash
start.bat
```

#### Linux/macOS:
```bash
chmod +x start.sh
./start.sh
```

#### Using npm:
```bash
npm start
```

This will start:
- **Backend Server**: `http://localhost:5000`
- **Frontend Application**: `http://localhost:3000`
- Browser will automatically open to `http://localhost:3000`

### Stopping the Application

#### Windows:
```bash
stop.bat
```

This will:
- Stop all processes on ports 3000 and 5000
- Kill any related Node.js processes
- Verify ports are free
- Show status messages

**Note**: If `stop.bat` doesn't work, you may need to:
1. Run it as Administrator
2. Or manually close processes in Task Manager
3. Or use `Ctrl+C` in the terminal where the application is running

### Reloading Data from CSV/Excel

#### Windows:
```bash
reload-csv.bat
```

This will:
- Check if the server is running
- Prompt for confirmation (this action cannot be undone)
- Reload all players and teams data from the CSV/Excel file
- Reset all team spending and player status
- Show success/error messages

**Important Notes**:
- ⚠️ **This action will DELETE all existing data** (players, teams, bids, etc.)
- The server must be running before using this script
- Make sure your CSV/Excel file is in the correct format
- You may need to refresh your browser after reloading

### Restarting the Application

#### Windows:
```bash
restart.bat
```

This will:
- Stop all running processes
- Check and install dependencies if needed
- Start the application again
- **Note**: This does NOT reload data - it only restarts the server

### Running Servers Separately

#### Start Backend Only:
```bash
npm run server
```

#### Start Frontend Only:
```bash
npm run client
```

#### Development Mode (with auto-reload):
```bash
npm run dev
```

### Accessing the Application

1. Open your browser
2. Navigate to `http://localhost:3000`
3. Login with admin or user credentials
4. You'll see the auction dashboard

### Port Configuration

If ports 3000 or 5000 are already in use:

**Backend Port** (edit `server/index.js`):
```javascript
const PORT = process.env.PORT || 5000; // Change 5000 to your preferred port
```

**Frontend Port** (edit `client/package.json`):
```json
"scripts": {
  "start": "PORT=3001 react-scripts start"  // Change 3001 to your preferred port
}
```

---

## Application Features

### 1. Auction Dashboard
- View current player being auctioned
- Search players by name or email
- Navigate between players (Prev/Next)
- Sell player to a team
- Bundle auction (multiple teams compete)
- Mark player as unsold
- Edit sold player details (Admin only)
- View team cards with budget, spent, remaining, and purchased players

### 2. Teams Management
- View all teams in a table format
- Add new teams (Admin only)
- Edit team details (Admin only)
- Delete teams (Admin only)
- View team statistics (Total Teams, Total Budget, Total Spent, Remaining Bid, Total Players)
- Download teams data as CSV
- Reload teams from CSV/Excel (Admin only)
- View purchased players for each team

### 3. Players Management
- View all players in a table format
- Filter by status (All/Sold/Unsold)
- Search players by name, email, employee ID, or category
- View player details (Employee ID, Name, Category, Base Price)
- Download players data as CSV
- Reload players from CSV/Excel (Admin only)
- View player status and team assignments

### 4. User Roles

#### Admin Role:
- Full access to all features
- Can perform all actions (sell, edit, delete, reload)
- Can edit sold player details
- Can manage teams and players

#### User Role:
- View-only access
- Can view all pages and data
- Can download CSV files
- Cannot perform any actions

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Port Already in Use

**Error**: `EADDRINUSE: address already in use :::5000`

**Solution**:
- Close other applications using port 5000
- Or change the port in `server/index.js`

#### 2. Module Not Found

**Error**: `Cannot find module 'xyz'`

**Solution**:
```bash
# Delete node_modules and reinstall
rm -rf node_modules client/node_modules
npm run install-all
```

#### 3. Database Locked

**Error**: `SQLITE_BUSY: database is locked`

**Solution**:
- Close all instances of the application
- Delete `server/auction.db` and restart (data will be reloaded from Excel)

#### 4. Excel File Not Found

**Error**: `File not found: ICL Auction List.xlsx`

**Solution**:
- Ensure the Excel file is in the root directory
- Check the file name matches exactly
- Ensure the file has the correct sheets (Team and Player sheets)

#### 5. CORS Error

**Error**: `Access to XMLHttpRequest has been blocked by CORS policy`

**Solution**:
- Ensure backend is running on port 5000
- Check `server/index.js` CORS configuration
- Ensure frontend proxy is set correctly in `client/package.json`

#### 6. Players Not Loading

**Solution**:
- Check Excel file format and column names
- Ensure sheet names contain "team" and "player"
- Click "Reload from CSV" in Teams or Players page
- Check server console for error messages

#### 7. Negative Values in Team Cards

**Solution**:
- This is automatically fixed by the application
- Refresh the page or reload teams data
- The system prevents negative values

#### 8. Search Not Working

**Solution**:
- Clear browser cache
- Ensure backend is running
- Check browser console for errors

### Getting Help

1. Check server console for error messages
2. Check browser console (F12) for frontend errors
3. Verify all dependencies are installed
4. Ensure Excel/CSV file format is correct
5. Restart the application

---

## Project Structure

```
ICL/
├── client/                          # React frontend application
│   ├── public/                      # Public assets
│   ├── src/
│   │   ├── components/             # React components
│   │   │   ├── AuctionDashboard.js # Main auction interface
│   │   │   ├── TeamManagement.js   # Teams management
│   │   │   ├── PlayerList.js       # Players list
│   │   │   ├── SoldPopup.js        # Sell player popup
│   │   │   ├── BundlePopup.js      # Bundle auction popup
│   │   │   ├── PurchasedPlayersPopup.js # Purchased players view
│   │   │   └── Login.js             # Login component
│   │   ├── App.js                   # Main app component
│   │   └── index.js                 # Entry point
│   └── package.json                 # Frontend dependencies
│
├── server/                          # Node.js backend
│   ├── index.js                     # Express server setup
│   ├── database.js                  # Database initialization
│   ├── auction.db                   # SQLite database (auto-generated)
│   ├── middleware/
│   │   └── auth.js                  # Authentication middleware
│   └── routes/
│       ├── auth.js                  # Authentication routes
│       ├── players.js                # Player API routes
│       ├── teams.js                  # Team API routes
│       └── admin.js                 # Admin routes
│
├── ICL Auction List.xlsx            # Excel data file (user-provided)
├── package.json                     # Backend dependencies
├── setup.bat                        # Windows setup script (run first)
├── start.bat                        # Windows startup script
├── stop.bat                         # Windows stop script
├── restart.bat                      # Windows restart script
├── reload-csv.bat                   # Windows script to reload data from CSV/Excel
├── SETUP.md                         # This file
├── README.md                        # Project overview
└── README_EXCEL_SETUP.md            # Excel setup guide
```

---

## Additional Notes

### Data Formatting
- All amounts are displayed as whole numbers (no decimals)
- Numbers use Indian numbering system (e.g., 1,00,000)
- No currency symbols are displayed

### Player Display
- Player names are displayed in Title Case
- Dots in names are replaced with spaces
- Format: "Employee ID - Player Name" (if Employee ID exists)

### Team Sorting
- Teams are sorted by ID (ascending)
- Player IDs start from 1 and reset on reload

### Validation Rules
- Bid amount cannot be below base price
- Bid amount cannot exceed remaining budget
- Teams with zero budget cannot be selected
- Minimum 2 teams required for bundle auction

### Real-time Updates
- Changes are broadcast to all connected clients via Socket.io
- No page refresh needed for updates

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server and browser console logs
3. Verify all setup steps are completed correctly

---

**Last Updated**: 2026
**Version**: 1.0.0
