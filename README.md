# ICL Tournament 2026 - Auction Application

A real-time auction application for the ICL Tournament 2026 player auction. This application allows teams to bid on players in real-time with live updates, timers, and comprehensive team management.

## Features

- 👥 **Team Management**: Create and manage teams with budget tracking
- 📊 **Player Management**: View all players, their status (sold/unsold), and team assignments
- 💰 **Budget Tracking**: Track team budgets, spending, and remaining balance
- 🎨 **Modern UI**: Beautiful, responsive interface built with React

## Tech Stack

- **Backend**: Node.js, Express.js, Socket.io
- **Frontend**: React.js
- **Database**: SQLite
- **Real-time**: WebSocket (Socket.io) for live updates

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Clone or navigate to the project directory:
```bash
cd ICL
```

2. Install backend dependencies:
```bash
npm install
```

3. Install frontend dependencies:
```bash
cd client
npm install
cd ..
```

Or install all dependencies at once:
```bash
npm run install-all
```

## Running the Application

### Quick Start (Recommended)

Simply run one command to start both frontend and backend:

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**Or using npm directly:**
```bash
npm start
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend application on `http://localhost:3000`

The browser will automatically open to `http://localhost:3000`

### Alternative: Run Servers Separately

If you prefer to run them separately:

1. Start the backend server:
```bash
npm run server
```

Or for development with auto-reload:
```bash
npm run dev
```

2. In a new terminal, start the frontend:
```bash
npm run client
```

## Usage

### Setting Up Teams

1. Navigate to the "Teams" tab
2. Click "Add New Team"
3. Enter team name and budget (default: ₹100,000)
4. Create multiple teams as needed

### Starting an Auction

1. Go to the "Auction" tab
2. Click "Start Auction" to begin
3. The first unsold player will be displayed
4. Teams can select their team and place bids
5. Use quick bid buttons or enter custom amounts
6. Click "Sell Player" to finalize the highest bid
7. The next player will automatically appear

### Viewing Players

- Navigate to the "Players" tab
- Filter by All/Sold/Unsold status
- View player details, team assignments, and sold prices

## API Endpoints

### Auction
- `GET /api/auction/state` - Get current auction state
- `POST /api/auction/start` - Start the auction
- `POST /api/auction/stop` - Stop the auction
- `POST /api/auction/bid` - Place a bid
- `POST /api/auction/sell` - Finalize player sale
- `POST /api/auction/timer` - Update timer

### Teams
- `GET /api/teams` - Get all teams
- `GET /api/teams/:id` - Get team details
- `POST /api/teams` - Create a team
- `PUT /api/teams/:id` - Update a team
- `DELETE /api/teams/:id` - Delete a team

### Players
- `GET /api/players` - Get all players
- `GET /api/players/:id` - Get player details
- `GET /api/players?status=sold` - Filter players by status

## Database

The application uses SQLite database (`server/auction.db`) with the following tables:
- `players` - Player information
- `teams` - Team information and budgets
- `bids` - Bid history
- `auction_state` - Current auction state

## ICL Auction Data: Excel (XLSX) File & Reload CSV

### Data File Setup

The application loads player and team data from an **Excel (.xlsx)** file or **CSV** file placed in the project root.

1. **Excel file**: Place your file as **`ICL Auction List.xlsx`** in the root directory (same folder as `package.json`).
2. **CSV alternative**: You can use **`ICL Auction List.csv`** in the root directory. CSV supports one sheet only; use separate files if you have multiple sheets.
3. **Required structure**:  
   - **Teams sheet**: Team names and budgets.  
   - **Players sheet**: Player details (name, email, employee ID, category, base price, etc.).  
   - **Lot Details sheet** (optional): For lot auction players.

### Loading Data

- **First run**: Data is loaded automatically from the Excel/CSV file when the server starts.
- **Reload data**: To refresh data from the file (e.g. after updating the Excel/CSV):
  - **From UI**: Go to **Teams** or **Players** tab and use **Reload from CSV** (Admin only). This reloads from the configured Excel/CSV file.
  - **From command line (Windows)**: Run `reload-csv.bat` to trigger a reload (server must be running).
- **Note**: Reloading clears existing players and teams in the database and loads fresh data from the file. Ensure the file is in the correct format before reloading.

### File Location

```
ICL/
├── ICL Auction List.xlsx   ← Place your Excel file here (or use CSV)
├── package.json
├── server/
├── client/
└── README.md
```

## Project Structure

```
ICL/
├── server/
│   ├── index.js          # Express server and Socket.io setup
│   ├── database.js       # Database initialization and CSV loading
│   └── routes/
│       ├── auction.js    # Auction endpoints
│       ├── players.js    # Player endpoints
│       └── teams.js      # Team endpoints
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuctionDashboard.js
│   │   │   ├── BiddingPanel.js
│   │   │   ├── TeamManagement.js
│   │   │   └── PlayerList.js
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── ICL Auction List.xlsx   # Excel data file (or ICL Auction List.csv)
├── package.json
└── README.md
```

## Development

- Backend runs on port 5000
- Frontend runs on port 3000
- Socket.io handles real-time communication
- Database is automatically initialized on first run

## Notes

- Minimum bid increment is ₹1,000
- Teams cannot bid more than their remaining budget
- Players and teams are loaded from the Excel (XLSX) or CSV file; use Reload from CSV in the app or `reload-csv.bat` to refresh data
- All bids are recorded in the database

## License

ISC

