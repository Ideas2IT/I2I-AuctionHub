# ICL Tournament 2026 - Auction Application

A real-time auction application for the ICL Tournament 2026 player auction. This application allows teams to bid on players in real-time with live updates, timers, and comprehensive team management.

## Features

- 🎯 **Real-time Bidding**: Live auction with WebSocket support for instant updates
- ⏱️ **Auction Timer**: Countdown timer for each player
- 👥 **Team Management**: Create and manage teams with budget tracking
- 📊 **Player Management**: View all players, their status (sold/unsold), and team assignments
- 💰 **Budget Tracking**: Track team budgets, spending, and remaining balance
- 🎨 **Modern UI**: Beautiful, responsive interface built with React

## Tech Stack

- **Backend**: Node.js, Express.js, Socket.io
- **Frontend**: React.js
- **Database**: SQLite
- **Real-time**: WebSocket (Socket.io)

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

Players are automatically loaded from `Player List ICL.csv` on first startup.

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
├── Player List ICL.csv
├── package.json
└── README.md
```

## Development

- Backend runs on port 5000
- Frontend runs on port 3000
- Socket.io handles real-time communication
- Database is automatically initialized on first run

## Notes

- The auction timer counts down from 60 seconds
- Minimum bid increment is ₹1,000
- Teams cannot bid more than their remaining budget
- Players are automatically loaded from the CSV file
- All bids are recorded in the database

## License

ISC

