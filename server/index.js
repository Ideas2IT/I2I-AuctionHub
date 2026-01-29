const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { initializeDatabase, loadDataFromFile } = require('./database');
const auctionRoutes = require('./routes/auction');
const playerRoutes = require('./routes/players');
const teamRoutes = require('./routes/teams');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const bundleRoutes = require('./routes/bundle');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auction', auctionRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/bundle', bundleRoutes);

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-auction', () => {
    socket.join('auction-room');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    
    // Check if database already has data
    // Wait a moment to ensure database is fully initialized and tables are created
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const { getDb } = require('./database');
    const db = getDb();
    
    // Check if players or teams exist in database
    const hasData = await new Promise((resolve) => {
      // First verify tables exist
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='players'", (err, tableCheck) => {
        if (err) {
          console.error('Error checking for players table:', err);
          resolve(false);
          return;
        }
        
        if (!tableCheck) {
          console.log('Players table does not exist yet.');
          resolve(false);
          return;
        }
        
        // Now check if data exists
        db.get('SELECT (SELECT COUNT(*) FROM players) as player_count, (SELECT COUNT(*) FROM teams) as team_count', (err, row) => {
          if (err) {
            console.error('Error checking database:', err);
            console.error('Error details:', err.message);
            // If there's an error checking, assume database is empty to be safe
            resolve(false);
          } else {
            const playerCount = row ? (row.player_count || 0) : 0;
            const teamCount = row ? (row.team_count || 0) : 0;
            const hasData = playerCount > 0 || teamCount > 0;
            
            console.log(`Database check: ${playerCount} players, ${teamCount} teams found.`);
            
            // Consider database as having data if either players or teams exist
            resolve(hasData);
          }
        });
      });
    });
    
    // Only load from file if database is empty (first time setup)
    if (!hasData) {
      console.log('Database is empty. Loading initial data from file (CSV or Excel)...');
      try {
        await loadDataFromFile();
        console.log('Initial data loaded successfully');
      } catch (fileError) {
        console.warn('Warning: Could not load data from file:', fileError.message);
        console.log('Server will continue without loading file data. You can add teams manually.');
      }
    } else {
      console.log('Database already contains data. Skipping file load to preserve existing data.');
      console.log('All player statuses (sold/unsold) and team data will be preserved.');
      console.log('To reload data from CSV/Excel, use the reload-csv.bat script.');
    }
    
    server.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`Server running on port ${PORT}`);
      console.log(`Frontend: http://localhost:3000`);
      console.log(`Backend API: http://localhost:${PORT}/api`);
      console.log(`========================================\n`);
    });
    
    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please stop the other process or use a different port.`);
        process.exit(1);
      } else {
        console.error('Server error:', err);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    console.error('Error details:', error.stack);
    process.exit(1);
  }
}

startServer();

