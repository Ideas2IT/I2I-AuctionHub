const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Try to load xlsx, but don't fail if it's not installed
let xlsx;
try {
  xlsx = require('xlsx');
} catch (err) {
  console.warn('Warning: xlsx package not found. Excel file support will be limited.');
  console.warn('Install it with: npm install xlsx');
  xlsx = null;
}

const DB_PATH = path.join(__dirname, 'auction.db');
let db;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');

      // Create tables
      db.serialize(() => {
        // Players table
        db.run(`CREATE TABLE IF NOT EXISTS players (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          employee_id TEXT,
          category TEXT,
          base_price INTEGER,
          status TEXT DEFAULT 'available',
          team_id INTEGER,
          sold_price INTEGER,
          sale_method TEXT DEFAULT NULL,
          is_lot_details INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Teams table
        db.run(`CREATE TABLE IF NOT EXISTS teams (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          budget INTEGER DEFAULT 100000,
          spent INTEGER DEFAULT 0,
          players_count INTEGER DEFAULT 0,
          min_players INTEGER DEFAULT 0,
          captain TEXT,
          wise_captain TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Bids table
        db.run(`CREATE TABLE IF NOT EXISTS bids (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player_id INTEGER NOT NULL,
          team_id INTEGER NOT NULL,
          amount INTEGER NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (player_id) REFERENCES players(id),
          FOREIGN KEY (team_id) REFERENCES teams(id)
        )`);

        // Migration: Add min_players column if it doesn't exist
        db.run('ALTER TABLE teams ADD COLUMN min_players INTEGER DEFAULT 0', (err) => {
          // Ignore error if column already exists
          if (err && !err.message.includes('duplicate column')) {
            console.warn('Warning: Could not add min_players column:', err.message);
          }
        });

        // Migration: Add captain column if it doesn't exist
        db.run('ALTER TABLE teams ADD COLUMN captain TEXT', (err) => {
          // Ignore error if column already exists
          if (err && !err.message.includes('duplicate column')) {
            console.warn('Warning: Could not add captain column:', err.message);
          }
        });

        // Migration: Add wise_captain column if it doesn't exist
        db.run('ALTER TABLE teams ADD COLUMN wise_captain TEXT', (err) => {
          // Ignore error if column already exists
          if (err && !err.message.includes('duplicate column')) {
            console.warn('Warning: Could not add wise_captain column:', err.message);
          }
        });

        // Auction state table
        db.run(`CREATE TABLE IF NOT EXISTS auction_state (
          id INTEGER PRIMARY KEY,
          is_active INTEGER DEFAULT 0,
          current_player_id INTEGER,
          current_bid INTEGER DEFAULT 0,
          current_team_id INTEGER,
          timer_seconds INTEGER DEFAULT 60,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Sessions table for authentication
        db.run(`CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          role TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL
        )`);

        // Users table (username + hashed password; no hardcoded credentials)
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err && !err.message.includes('already exists')) {
            console.warn('Warning: Could not create users table:', err.message);
          }
        });

        // Bundle ranges table
        db.run(`CREATE TABLE IF NOT EXISTS bundle_ranges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          range_value INTEGER NOT NULL UNIQUE,
          range_letter TEXT,
          min_value INTEGER DEFAULT 0,
          max_value INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Bundle participations table (tracks wins/losses per team per range)
        db.run(`CREATE TABLE IF NOT EXISTS bundle_participations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          team_id INTEGER NOT NULL,
          range_id INTEGER NOT NULL,
          bid_amount INTEGER NOT NULL,
          result TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (team_id) REFERENCES teams(id),
          FOREIGN KEY (range_id) REFERENCES bundle_ranges(id)
        )`);

        // Add employee_id, category, and base_price columns if they don't exist (migration)
        db.run(`ALTER TABLE players ADD COLUMN employee_id TEXT`, () => {});
        db.run(`ALTER TABLE players ADD COLUMN category TEXT`, () => {});
        db.run(`ALTER TABLE players ADD COLUMN base_price INTEGER`, () => {});
        db.run(`ALTER TABLE players ADD COLUMN sale_method TEXT DEFAULT NULL`, () => {});
        // Add is_lot_details column if it doesn't exist (migration)
        db.run(`ALTER TABLE players ADD COLUMN is_lot_details INTEGER DEFAULT 0`, () => {});
        // Add range column if it doesn't exist (migration)
        db.run(`ALTER TABLE players ADD COLUMN range TEXT`, () => {});

        // Add min_value and max_value columns if they don't exist (migration)
        db.run(`ALTER TABLE bundle_ranges ADD COLUMN min_value INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE bundle_ranges ADD COLUMN max_value INTEGER DEFAULT 0`, () => {});
        // Add range_letter column if it doesn't exist (migration)
        db.run(`ALTER TABLE bundle_ranges ADD COLUMN range_letter TEXT`, () => {});

        // Initialize default bundle ranges if they don't exist
        db.run(`INSERT OR IGNORE INTO bundle_ranges (range_value, range_letter, min_value, max_value) VALUES (300, 'A', 280, 350)`, () => {});
        db.run(`INSERT OR IGNORE INTO bundle_ranges (range_value, range_letter, min_value, max_value) VALUES (150, 'B', 120, 180)`, () => {});
        db.run(`INSERT OR IGNORE INTO bundle_ranges (range_value, range_letter, min_value, max_value) VALUES (75, 'C', 50, 120)`, () => {});

        // Initialize auction state
        db.run(`INSERT OR IGNORE INTO auction_state (id, is_active) VALUES (1, 0)`, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  });
}

function getDb() {
  return db;
}

// Excel/CSV file loading functions
function loadTeamsFromFile() {
  return new Promise((resolve, reject) => {
    // Try to find CSV or Excel file
    const csvPath = path.join(__dirname, '..', 'ICL Auction List.csv');
    const excelPath = path.join(__dirname, '..', 'ICL Auction List.xlsx');
    const excelPath2 = path.join(__dirname, '..', 'ICL Auction List.xls');
    const oldCsvPath = path.join(__dirname, '..', 'Player List ICL.csv');
    const oldExcelPath = path.join(__dirname, '..', 'Player List ICL.xlsx');
    const oldExcelPath2 = path.join(__dirname, '..', 'Player List ICL.xls');
    
    let filePath = null;
    let fileType = null;
    
    // Check for new file name first, then fall back to old name
    if (fs.existsSync(excelPath)) {
      filePath = excelPath;
      fileType = 'xlsx';
    } else if (fs.existsSync(excelPath2)) {
      filePath = excelPath2;
      fileType = 'xls';
    } else if (fs.existsSync(csvPath)) {
      filePath = csvPath;
      fileType = 'csv';
    } else if (fs.existsSync(oldExcelPath)) {
      filePath = oldExcelPath;
      fileType = 'xlsx';
    } else if (fs.existsSync(oldExcelPath2)) {
      filePath = oldExcelPath2;
      fileType = 'xls';
    } else if (fs.existsSync(oldCsvPath)) {
      filePath = oldCsvPath;
      fileType = 'csv';
    } else {
      console.warn('No data file found (CSV or Excel). Teams will need to be added manually.');
      resolve();
      return;
    }

    const teams = [];
    
    if (fileType === 'csv') {
      // Handle CSV file
      let isFirstRow = true;
      let teamNameColumn = null;
      let minPlayersColumn = null;
      let captainColumn = null;
      let wiseCaptainColumn = null;
      let budgetColumn = null;
      
      fs.createReadStream(filePath)
        .on('error', (err) => {
          console.error('Error reading CSV file:', err);
          reject(err);
        })
        .pipe(csv())
        .on('data', (row) => {
          if (isFirstRow) {
            // Find Team Name, Min Players, Captain, Wise Captain, and Total Budget columns
            const columns = Object.keys(row);
            teamNameColumn = columns.find(key => 
              key.toLowerCase().includes('team') && key.toLowerCase().includes('name')
            ) || columns[0];
            minPlayersColumn = columns.find(key => {
              const lowerKey = key.toLowerCase().replace(/\s+/g, '');
              return lowerKey.includes('min') && lowerKey.includes('player');
            });
            captainColumn = columns.find(key => {
              const lowerKey = key.toLowerCase().replace(/\s+/g, '');
              return lowerKey === 'captain';
            });
            wiseCaptainColumn = columns.find(key => {
              const lowerKey = key.toLowerCase().replace(/\s+/g, '');
              return lowerKey.includes('wise') && lowerKey.includes('captain');
            });
            budgetColumn = columns.find(key => {
              const lowerKey = key.toLowerCase().replace(/\s+/g, '');
              return (lowerKey.includes('total') && lowerKey.includes('budget')) || lowerKey === 'budget';
            });
            isFirstRow = false;
          }
          
          const teamName = teamNameColumn ? (row[teamNameColumn] || '').toString().trim() : '';
          const minPlayers = minPlayersColumn ? (row[minPlayersColumn] || 0) : 0;
          const captain = captainColumn ? (row[captainColumn] || '').toString().trim() : '';
          const wiseCaptain = wiseCaptainColumn ? (row[wiseCaptainColumn] || '').toString().trim() : '';
          const budget = budgetColumn ? (row[budgetColumn] || '').toString().trim() : '';
          
          if (teamName && teamName !== 'Team Name' && teamName !== 'Player Name' && teamName !== '' && !teamName.includes('@')) {
            // Parse budget: use exactly what's in the file, default to 0 only if empty/invalid
            let budgetValue = 0;
            if (budget && budget.toString().trim() !== '') {
              const parsed = parseInt(budget.toString().trim());
              budgetValue = isNaN(parsed) ? 0 : parsed;
            }
            
            teams.push({
              name: teamName,
              min_players: parseInt(minPlayers) || 0,
              captain: captain || null,
              wise_captain: wiseCaptain || null,
              budget: budgetValue
            });
          }
        })
        .on('end', () => {
          processTeams(teams, resolve, reject);
        })
        .on('error', reject);
    } else {
      // Handle Excel file
      if (!xlsx) {
        console.error('Excel support not available. Please install xlsx package: npm install xlsx');
        reject(new Error('Excel support not available. Install xlsx package.'));
        return;
      }
      
      try {
        const workbook = xlsx.readFile(filePath);
        
        // Try to find "Team Name" sheet first, then fall back to first sheet
        let sheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('team') || name.toLowerCase() === 'team name'
        ) || workbook.SheetNames[0];
        
        // Reading teams from sheet
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);
        
        // Find column names
        const firstRow = data[0];
        let teamNameColumn = null;
        let minPlayersColumn = null;
        let captainColumn = null;
        let wiseCaptainColumn = null;
        let budgetColumn = null;
        
        if (firstRow) {
          const allColumns = Object.keys(firstRow);
          // Find Team Name column
          teamNameColumn = allColumns.find(key => 
            key.toLowerCase().includes('team') && key.toLowerCase().includes('name')
          ) || allColumns[0];
          
          // Find Min Players column (case-insensitive, handles spaces)
          minPlayersColumn = allColumns.find(key => {
            const lowerKey = key.toLowerCase().replace(/\s+/g, '');
            return lowerKey.includes('min') && lowerKey.includes('player');
          });
          
          // Find Captain column
          captainColumn = allColumns.find(key => {
            const lowerKey = key.toLowerCase().replace(/\s+/g, '');
            return lowerKey === 'captain';
          });
          
          // Find Wise Captain column
          wiseCaptainColumn = allColumns.find(key => {
            const lowerKey = key.toLowerCase().replace(/\s+/g, '');
            return lowerKey.includes('wise') && lowerKey.includes('captain');
          });
          
          // Find Total Budget column (or just "Budget")
          budgetColumn = allColumns.find(key => {
            const lowerKey = key.toLowerCase().replace(/\s+/g, '');
            return (lowerKey.includes('total') && lowerKey.includes('budget')) || lowerKey === 'budget';
          });
          
        }
        
        data.forEach((row, index) => {
          const teamName = teamNameColumn ? (row[teamNameColumn] || '').toString().trim() : '';
          const minPlayers = minPlayersColumn ? (row[minPlayersColumn] || 0) : 0;
          const captain = captainColumn ? (row[captainColumn] || '').toString().trim() : '';
          const wiseCaptain = wiseCaptainColumn ? (row[wiseCaptainColumn] || '').toString().trim() : '';
          const budget = budgetColumn ? (row[budgetColumn] || '').toString().trim() : '';
          
          // Skip header row
          if (index === 0 && (teamName === 'Team Name' || teamName === 'Player Name')) {
            return;
          }
          
          if (teamName && teamName !== 'Team Name' && teamName !== 'Player Name' && !teamName.includes('@')) {
            // Parse budget: use exactly what's in the file, default to 0 only if empty/invalid
            let budgetValue = 0;
            if (budget && budget.toString().trim() !== '') {
              const parsed = parseInt(budget.toString().trim());
              budgetValue = isNaN(parsed) ? 0 : parsed;
            }
            
            teams.push({
              name: teamName,
              min_players: parseInt(minPlayers) || 0,
              captain: captain || null,
              wise_captain: wiseCaptain || null,
              budget: budgetValue
            });
          }
        });
        
        processTeams(teams, resolve, reject);
      } catch (err) {
        console.error('Error reading Excel file:', err);
        reject(err);
      }
    }
  });
}

function processTeams(teams, resolve, reject) {
  if (teams.length === 0) {
    console.log('No teams found in file');
    resolve();
    return;
  }

  const db = getDb();
  
  // First, ensure min_players, captain, and wise_captain columns exist (migration)
  db.run('ALTER TABLE teams ADD COLUMN min_players INTEGER DEFAULT 0', (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column')) {
      console.warn('Warning: Could not add min_players column:', err.message);
    }
  });
  db.run('ALTER TABLE teams ADD COLUMN captain TEXT', (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column')) {
      console.warn('Warning: Could not add captain column:', err.message);
    }
  });
  db.run('ALTER TABLE teams ADD COLUMN wise_captain TEXT', (err) => {
    // Ignore error if column already exists
    if (err && !err.message.includes('duplicate column')) {
      console.warn('Warning: Could not add wise_captain column:', err.message);
    }
  });
  
  const stmt = db.prepare('INSERT OR IGNORE INTO teams (name, budget, min_players, captain, wise_captain) VALUES (?, ?, ?, ?, ?)');
  const updateStmt = db.prepare('UPDATE teams SET budget = ?, min_players = ?, captain = ?, wise_captain = ? WHERE name = ?');
  let processed = 0;
  const totalTeams = teams.length;

  teams.forEach((team) => {
    const teamName = typeof team === 'string' ? team : team.name;
    const minPlayers = typeof team === 'object' && team.min_players !== undefined ? team.min_players : 0;
    const captain = typeof team === 'object' && team.captain !== undefined ? (team.captain || null) : null;
    const wiseCaptain = typeof team === 'object' && team.wise_captain !== undefined ? (team.wise_captain || null) : null;
    // Budget from file: if not provided, default to 0
    const budget = typeof team === 'object' && team.budget !== undefined ? team.budget : 0;
    
    stmt.run(teamName, budget, minPlayers, captain, wiseCaptain, function(err) {
      if (err) {
        console.error(`Error inserting team ${teamName}:`, err.message);
        processed++;
        checkComplete();
      } else if (this.changes === 0) {
        // Team already exists, update budget, min_players, captain, and wise_captain
        updateStmt.run(budget, minPlayers, captain, wiseCaptain, teamName, (updateErr) => {
          if (updateErr) {
            console.error(`Error updating team ${teamName}:`, updateErr.message);
          } else {
          }
          processed++;
          checkComplete();
        });
      } else {
        // New team inserted
        processed++;
        checkComplete();
      }
    });
  });
  
  function checkComplete() {
    if (processed === totalTeams) {
      stmt.finalize((err) => {
        if (err) {
          reject(err);
          return;
        }
        updateStmt.finalize((err) => {
          if (err) {
            reject(err);
            return;
          }
          console.log(`Synced ${totalTeams} teams from file (including min_players)`);
          resolve();
        });
      });
    }
  }
}

function loadPlayersFromFile() {
  return new Promise((resolve, reject) => {
    const csvPath = path.join(__dirname, '..', 'ICL Auction List.csv');
    const excelPath = path.join(__dirname, '..', 'ICL Auction List.xlsx');
    const excelPath2 = path.join(__dirname, '..', 'ICL Auction List.xls');
    const oldCsvPath = path.join(__dirname, '..', 'Player List ICL.csv');
    const oldExcelPath = path.join(__dirname, '..', 'Player List ICL.xlsx');
    const oldExcelPath2 = path.join(__dirname, '..', 'Player List ICL.xls');
    
    let filePath = null;
    let fileType = null;
    
    // Check for new file name first, then fall back to old name
    if (fs.existsSync(excelPath)) {
      filePath = excelPath;
      fileType = 'xlsx';
    } else if (fs.existsSync(excelPath2)) {
      filePath = excelPath2;
      fileType = 'xls';
    } else if (fs.existsSync(csvPath)) {
      filePath = csvPath;
      fileType = 'csv';
    } else if (fs.existsSync(oldExcelPath)) {
      filePath = oldExcelPath;
      fileType = 'xlsx';
    } else if (fs.existsSync(oldExcelPath2)) {
      filePath = oldExcelPath2;
      fileType = 'xls';
    } else if (fs.existsSync(oldCsvPath)) {
      filePath = oldCsvPath;
      fileType = 'csv';
    } else {
      console.warn('No data file found (CSV or Excel). Players will need to be added manually.');
      resolve();
      return;
    }

    const players = [];
    
    if (fileType === 'csv') {
      fs.createReadStream(filePath)
        .on('error', (err) => {
          console.error('Error reading CSV file:', err);
          reject(err);
        })
        .pipe(csv())
        .on('data', (row) => {
          const playerName = row['Player Name'] || row['player name'] || row['PlayerName'] || row['player Name'] || row['PLAYER NAME'] || Object.values(row)[0];
          if (playerName && playerName.toString().trim() !== 'Player Name' && playerName.toString().trim() !== 'Team Name' && playerName.toString().trim() !== '' && !playerName.toString().match(/^(BLASTERS|DESTROYERS|DYNAMITES|HURRICANES|INVINCIBLES|CHARGERS|CONQUERORS|SMASHERS)$/i)) {
            const trimmedName = playerName.toString().trim();
            
            // Get all possible column name variations with flexible matching
            const getColumnValue = (variations) => {
              for (const variation of variations) {
                if (row[variation] !== undefined && row[variation] !== null && row[variation] !== '') {
                  return row[variation];
                }
              }
              // Try case-insensitive match
              const rowKeys = Object.keys(row);
              for (const key of rowKeys) {
                for (const variation of variations) {
                  if (key.toLowerCase().trim() === variation.toLowerCase().trim()) {
                    return row[key];
                  }
                }
              }
              return null;
            };
            
            // Get Employee ID with flexible matching
            const employeeId = getColumnValue([
              'Employee ID', 'employee id', 'EmployeeID', 'employee ID', 'EMPLOYEE ID', 
              'Emp ID', 'emp id', 'Employee Id', 'EMPLOYEEID'
            ]);
            
            // Get Category with flexible matching
            const category = getColumnValue([
              'Category', 'category', 'CATEGORY', 'Cat', 'cat'
            ]);
            
            // Get Base Price with flexible matching
            const basePrice = getColumnValue([
              'Base Price', 'base price', 'BasePrice', 'base Price', 'BASE PRICE', 
              'Base', 'base', 'Base Pr', 'base pr'
            ]);
            
            players.push({
              name: trimmedName,
              email: trimmedName.includes('@') ? trimmedName : null,
              employee_id: employeeId ? employeeId.toString().trim() : null,
              category: category ? category.toString().trim() : null,
              base_price: basePrice ? parseInt(basePrice) || null : null
            });
          }
        })
        .on('end', () => {
          processPlayers(players, resolve, reject);
        })
        .on('error', reject);
    } else {
      if (!xlsx) {
        console.error('Excel support not available. Please install xlsx package: npm install xlsx');
        reject(new Error('Excel support not available. Install xlsx package.'));
        return;
      }
      
      try {
        const workbook = xlsx.readFile(filePath);
        
        // Try to find "Player List" sheet first, then fall back to first sheet
        let sheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('player') || name.toLowerCase() === 'player list'
        ) || workbook.SheetNames[0];
        
        // Reading players from sheet
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);
        
        const firstRow = data[0];
        const columnName = firstRow ? Object.keys(firstRow)[0] : null;
        
        data.forEach((row, index) => {
          if (index === 0 && (row[columnName] === 'Player Name' || row[columnName] === 'Team Name')) {
            return;
          }
          const playerName = row['Player Name'] || row['player name'] || row['PlayerName'] || row['player Name'] || row['PLAYER NAME'] || row[columnName] || Object.values(row)[0];
          if (playerName && playerName.toString().trim() !== 'Player Name' && playerName.toString().trim() !== 'Team Name' && playerName.toString().trim() !== '' && !playerName.toString().match(/^(BLASTERS|DESTROYERS|DYNAMITES|HURRICANES|INVINCIBLES|CHARGERS|CONQUERORS|SMASHERS)$/i)) {
            const trimmedName = playerName.toString().trim();
            
            // Get all possible column name variations with flexible matching
            const getColumnValue = (variations) => {
              for (const variation of variations) {
                if (row[variation] !== undefined && row[variation] !== null && row[variation] !== '') {
                  return row[variation];
                }
              }
              // Try case-insensitive match
              const rowKeys = Object.keys(row);
              for (const key of rowKeys) {
                for (const variation of variations) {
                  if (key.toLowerCase().trim() === variation.toLowerCase().trim()) {
                    return row[key];
                  }
                }
              }
              return null;
            };
            
            // Get Employee ID with flexible matching
            const employeeId = getColumnValue([
              'Employee ID', 'employee id', 'EmployeeID', 'employee ID', 'EMPLOYEE ID', 
              'Emp ID', 'emp id', 'Employee Id', 'EMPLOYEEID'
            ]);
            
            // Get Category with flexible matching
            const category = getColumnValue([
              'Category', 'category', 'CATEGORY', 'Cat', 'cat'
            ]);
            
            // Get Base Price with flexible matching
            const basePrice = getColumnValue([
              'Base Price', 'base price', 'BasePrice', 'base Price', 'BASE PRICE', 
              'Base', 'base', 'Base Pr', 'base pr'
            ]);
            
            const playerData = {
              name: trimmedName,
              email: trimmedName.includes('@') ? trimmedName : null,
              employee_id: employeeId ? employeeId.toString().trim() : null,
              category: category ? category.toString().trim() : null,
              base_price: basePrice ? parseInt(basePrice) || null : null
            };
            players.push(playerData);
          }
        });
        
        console.log(`Total players extracted from Excel: ${players.length}`);
        processPlayers(players, resolve, reject);
      } catch (err) {
        console.error('Error reading Excel file:', err);
        reject(err);
      }
    }
  });
}

function processPlayers(players, resolve, reject) {
  const db = getDb();
  // Delete ALL existing data to reload fresh data
  db.serialize(() => {
    // Delete all bids first (foreign key constraint)
    db.run('DELETE FROM bids', (err) => {
      if (err) {
        console.error('Error clearing bids:', err);
      }
    });

    // Delete bundle participations (foreign key constraint - must be before bundle_ranges)
    db.run('DELETE FROM bundle_participations', (err) => {
      if (err) {
        console.error('Error clearing bundle participations:', err);
      }
      
      // Delete ALL bundle ranges (chained after participations)
      db.run('DELETE FROM bundle_ranges', (err) => {
        if (err) {
          console.error('Error clearing bundle ranges:', err);
        } else {
          console.log('Bundle ranges and participations have been cleared.');
        }
        
        // Continue with player deletion
        if (players.length === 0) {
          console.log('No players found in file (or file contains only teams)');
          // Reset teams and auction state even if no players
          // Note: Lot details players are preserved
          db.run('UPDATE teams SET spent = 0, players_count = 0', (err) => {
            if (err) {
              console.error('Error resetting teams:', err);
            }
            
            db.run('UPDATE auction_state SET is_active = 0, current_player_id = NULL, current_bid = 0, current_team_id = NULL, timer_seconds = 60 WHERE id = 1', (err) => {
              if (err) {
                console.error('Error resetting auction state:', err);
              }
              resolve();
            });
          });
          return;
        }

        // Delete existing regular players (but preserve lot details players)
        db.run('DELETE FROM players WHERE is_lot_details = 0 OR is_lot_details IS NULL', (err) => {
          if (err) {
            console.error('Error clearing players:', err);
            reject(err);
            return;
          }

          // Get lot details players count to renumber them after regular players
          db.get('SELECT COUNT(*) as count FROM players WHERE is_lot_details = 1', (err, lotDetailsInfo) => {
            if (err) {
              console.error('Error checking lot details players:', err);
            }

            const lotDetailsCount = lotDetailsInfo && lotDetailsInfo.count > 0 ? parseInt(lotDetailsInfo.count) : 0;

            // Reset the auto-increment sequence to start from 1 for regular players
            db.run('DELETE FROM sqlite_sequence WHERE name = "players"', (err) => {
              if (err) {
                console.error('Error resetting player ID sequence:', err);
              }

              console.log('All existing players deleted. Resetting teams and auction state...');

              // Reset all teams' spent and players_count
              db.run('UPDATE teams SET spent = 0, players_count = 0', (err) => {
                if (err) {
                  console.error('Error resetting teams:', err);
                }

                // Reset auction state
                db.run('UPDATE auction_state SET is_active = 0, current_player_id = NULL, current_bid = 0, current_team_id = NULL, timer_seconds = 60 WHERE id = 1', (err) => {
                  if (err) {
                    console.error('Error resetting auction state:', err);
                  }

                  console.log('Loading new players from file...');

                  const stmt = db.prepare('INSERT INTO players (name, email, employee_id, category, base_price, status, is_lot_details) VALUES (?, ?, ?, ?, ?, ?, ?)');
                  players.forEach((player) => {
                    stmt.run(player.name, player.email, player.employee_id || null, player.category || null, player.base_price || null, 'available', 0);
                  });
                  stmt.finalize((err) => {
                    if (err) {
                      reject(err);
                      return;
                    }
                    
                    // After inserting regular players, renumber lot details players to come after them
                    if (lotDetailsCount > 0) {
                      db.get('SELECT MAX(id) as maxId FROM players WHERE is_lot_details = 0', (err, result) => {
                        if (!err && result && result.maxId) {
                          const startId = parseInt(result.maxId) + 1;
                          
                          // Get all lot details players and renumber them sequentially
                          db.all('SELECT id FROM players WHERE is_lot_details = 1 ORDER BY id', (err, lotPlayers) => {
                            if (!err && lotPlayers && lotPlayers.length > 0) {
                              let newId = startId;
                              const updateStmt = db.prepare('UPDATE players SET id = ? WHERE id = ?');
                              
                              lotPlayers.forEach((lotPlayer) => {
                                const oldId = lotPlayer.id;
                                if (oldId !== newId) {
                                  updateStmt.run(newId, oldId);
                                }
                                newId++;
                              });
                              
                              updateStmt.finalize((err) => {
                                if (err) {
                                  console.error('Error renumbering lot details players:', err);
                                }
                                
                                // Update sequence to reflect the new max ID
                                db.get('SELECT MAX(id) as maxId FROM players', (err, result) => {
                                  if (!err && result && result.maxId) {
                                    const maxId = parseInt(result.maxId);
                                    db.run(`UPDATE sqlite_sequence SET seq = ? WHERE name = "players"`, [maxId], (err) => {
                                      if (err) {
                                        db.run(`INSERT INTO sqlite_sequence (name, seq) VALUES ("players", ?)`, [maxId], () => {});
                                      }
                                    });
                                  }
                                });
                                
                                console.log(`Loaded ${players.length} players from file with employee_id, category, and base_price fields`);
                                console.log(`Renumbered ${lotDetailsCount} lot details players to start from ID ${startId}`);
                                resolve();
                              });
                            } else {
                              console.log(`Loaded ${players.length} players from file with employee_id, category, and base_price fields`);
                              resolve();
                            }
                          });
                        } else {
                          console.log(`Loaded ${players.length} players from file with employee_id, category, and base_price fields`);
                          resolve();
                        }
                      });
                    } else {
                      // Update sequence to reflect the new max ID
                      db.get('SELECT MAX(id) as maxId FROM players', (err, result) => {
                        if (!err && result && result.maxId) {
                          const maxId = parseInt(result.maxId);
                          db.run(`UPDATE sqlite_sequence SET seq = ? WHERE name = "players"`, [maxId], (err) => {
                            if (err) {
                              db.run(`INSERT INTO sqlite_sequence (name, seq) VALUES ("players", ?)`, [maxId], () => {});
                            }
                          });
                        }
                      });
                      
                      console.log(`Loaded ${players.length} players from file with employee_id, category, and base_price fields`);
                      resolve();
                    }
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

function loadLotDetailsFromFile() {
  return new Promise((resolve, reject) => {
    const csvPath = path.join(__dirname, '..', 'ICL Auction List.csv');
    const excelPath = path.join(__dirname, '..', 'ICL Auction List.xlsx');
    const excelPath2 = path.join(__dirname, '..', 'ICL Auction List.xls');
    const oldCsvPath = path.join(__dirname, '..', 'Player List ICL.csv');
    const oldExcelPath = path.join(__dirname, '..', 'Player List ICL.xlsx');
    const oldExcelPath2 = path.join(__dirname, '..', 'Player List ICL.xls');
    
    let filePath = null;
    let fileType = null;
    
    // Check for new file name first, then fall back to old name
    if (fs.existsSync(excelPath)) {
      filePath = excelPath;
      fileType = 'xlsx';
    } else if (fs.existsSync(excelPath2)) {
      filePath = excelPath2;
      fileType = 'xls';
    } else if (fs.existsSync(oldExcelPath)) {
      filePath = oldExcelPath;
      fileType = 'xlsx';
    } else if (fs.existsSync(oldExcelPath2)) {
      filePath = oldExcelPath2;
      fileType = 'xls';
    } else {
      // CSV doesn't support multiple sheets, so skip lot details for CSV
      console.log('Lot Details sheet only available in Excel format. Skipping...');
      resolve();
      return;
    }

    if (fileType === 'csv') {
      // CSV doesn't support multiple sheets
      console.log('Lot Details sheet only available in Excel format. Skipping...');
      resolve();
      return;
    }

    // Handle Excel file
    if (!xlsx) {
      console.error('Excel support not available. Cannot load Lot Details sheet.');
      resolve(); // Don't reject, just skip
      return;
    }

    try {
      const workbook = xlsx.readFile(filePath);
      
      // Try to find "Lot Details" sheet
      let sheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('lot') && name.toLowerCase().includes('detail')
      );
      
      if (!sheetName) {
        console.log('Lot Details sheet not found in Excel file. Skipping...');
        resolve();
        return;
      }

      console.log(`Reading lot details from sheet: "${sheetName}"`);
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);
      
      // Log column names for debugging
      if (data.length > 0) {
      }

      const lotPlayers = [];
      const firstRow = data[0];
      const columnName = firstRow ? Object.keys(firstRow)[0] : null;

      data.forEach((row, index) => {
        if (index === 0 && (row[columnName] === 'Player Name' || row[columnName] === 'Employee ID')) {
          return; // Skip header row
        }

        const playerName = row['Player Name'] || row['player name'] || row['PlayerName'] || row['player Name'] || row['PLAYER NAME'] || row[columnName] || Object.values(row)[0];
        if (playerName && playerName.toString().trim() !== 'Player Name' && playerName.toString().trim() !== 'Employee ID' && playerName.toString().trim() !== '') {
          const trimmedName = playerName.toString().trim();
          
          // Get all possible column name variations with flexible matching
          const getColumnValue = (variations) => {
            for (const variation of variations) {
              if (row[variation] !== undefined && row[variation] !== null && row[variation] !== '') {
                return row[variation];
              }
            }
            // Try case-insensitive match
            const rowKeys = Object.keys(row);
            for (const key of rowKeys) {
              for (const variation of variations) {
                if (key.toLowerCase().trim() === variation.toLowerCase().trim()) {
                  return row[key];
                }
              }
            }
            return null;
          };
          
          // Get Employee ID with flexible matching
          const employeeId = getColumnValue([
            'Employee ID', 'employee id', 'EmployeeID', 'employee ID', 'EMPLOYEE ID', 
            'Emp ID', 'emp id', 'Employee Id', 'EMPLOYEEID'
          ]);
          
          // Get Category with flexible matching
          const category = getColumnValue([
            'Category', 'category', 'CATEGORY', 'Cat', 'cat'
          ]);
          
          // Get Base Price with flexible matching
          const basePrice = getColumnValue([
            'Base Price', 'base price', 'BasePrice', 'base Price', 'BASE PRICE', 
            'Base', 'base', 'Base Pr', 'base pr'
          ]);
          
          lotPlayers.push({
            name: trimmedName,
            email: trimmedName.includes('@') ? trimmedName : null,
            employee_id: employeeId ? employeeId.toString().trim() : null,
            category: category ? category.toString().trim() : null,
            base_price: basePrice ? parseInt(basePrice) || null : null,
            is_lot_details: 1
          });
        }
      });

      console.log(`Total lot details players extracted: ${lotPlayers.length}`);
      
      if (lotPlayers.length === 0) {
        resolve();
        return;
      }

      // Process lot details players
      const db = getDb();
      db.serialize(() => {
        // Delete existing lot details players first
        db.run('DELETE FROM players WHERE is_lot_details = 1', (err) => {
          if (err) {
            console.error('Error clearing lot details players:', err);
            reject(err);
            return;
          }

          // Insert lot details players
          const stmt = db.prepare('INSERT INTO players (name, email, employee_id, category, base_price, status, is_lot_details) VALUES (?, ?, ?, ?, ?, ?, ?)');
          lotPlayers.forEach((player) => {
            stmt.run(
              player.name, 
              player.email, 
              player.employee_id || null, 
              player.category || null, 
              player.base_price || null, 
              'available',
              1 // is_lot_details = 1
            );
          });
          stmt.finalize((err) => {
            if (err) {
              reject(err);
              return;
            }
            console.log(`Loaded ${lotPlayers.length} lot details players from "${sheetName}" sheet`);
            resolve();
          });
        });
      });
    } catch (err) {
      console.error('Error reading Lot Details sheet:', err);
      // Don't reject, just log and resolve (lot details is optional)
      resolve();
    }
  });
}

function loadDataFromFile() {
  return new Promise(async (resolve, reject) => {
    try {
      await loadTeamsFromFile();
      await loadPlayersFromFile();
      await loadLotDetailsFromFile();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

// Keep old function names for backward compatibility
const loadTeamsFromCSV = loadTeamsFromFile;
const loadPlayersFromCSV = loadPlayersFromFile;
const loadDataFromCSV = loadDataFromFile;

module.exports = {
  initializeDatabase,
  loadPlayersFromFile,
  loadPlayersFromCSV: loadPlayersFromFile, // Keep for backward compatibility
  loadTeamsFromFile,
  loadTeamsFromCSV: loadTeamsFromFile, // Keep for backward compatibility
  loadLotDetailsFromFile,
  loadDataFromCSV: loadDataFromFile, // Keep for backward compatibility
  loadDataFromFile,
  getDb
};

