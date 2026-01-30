const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

// All player routes require authentication
router.use(authenticate);

// Get all players
router.get('/', (req, res) => {
  const db = getDb();
  const { status, search, team_id } = req.query;
  
  let query = 'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id';
  const params = [];
  const conditions = [];
  
  if (status) {
    conditions.push('p.status = ?');
    params.push(status);
  }
  
  if (team_id) {
    conditions.push('p.team_id = ?');
    params.push(team_id);
  }
  
  if (search) {
    conditions.push('(p.name LIKE ? OR p.email LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY p.id';
  
  db.all(query, params, (err, players) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(players);
  });
});

// Create a new player (e.g. manual lot player)
router.post('/', (req, res) => {
  const db = getDb();
  const { name, email, employee_id, category, base_price, is_lot_details } = req.body;

  if (!name || !name.toString().trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const finalName = name.toString().trim();
  const finalEmail = (email != null && email !== '') ? email.toString().trim() : null;
  const finalEmployeeId = (employee_id != null && employee_id !== '') ? employee_id.toString().trim() : null;
  const finalCategory = (category != null && category !== '') ? category.toString().trim() : null;
  const finalBasePrice = (base_price != null && base_price !== '') ? parseInt(base_price) || 0 : 0;
  const lotDetails = is_lot_details === 1 || is_lot_details === true ? 1 : 0;
  const status = lotDetails ? 'unsold' : 'available';

  db.run(
    'INSERT INTO players (name, email, employee_id, category, base_price, status, is_lot_details) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [finalName, finalEmail, finalEmployeeId, finalCategory, finalBasePrice, status, lotDetails],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const id = this.lastID;
      db.get(
        'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = ?',
        [id],
        (err, player) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          const io = req.app.get('io');
          if (io) {
            io.to('auction-room').emit('player-updated', { player });
          }
          res.status(201).json({ message: 'Player created', player });
        }
      );
    }
  );
});

// Mark player as unsold (must be before /:id route to avoid conflicts)
router.post('/:id/unsold', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  // Check if player exists
  db.get('SELECT * FROM players WHERE id = ?', [id], (err, player) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // If player was sold, need to reverse team stats
    // Check if player has team_id (sold players should have team_id, even if sold_price is 0 for lot players)
    if (player.status === 'sold' && player.team_id) {
      const teamId = player.team_id;
      const soldPrice = parseInt(player.sold_price) || 0;
      
      // Get the team first to check current values
      db.get('SELECT * FROM teams WHERE id = ?', [teamId], (err, team) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        if (!team) {
          return res.status(404).json({ error: 'Team not found' });
        }
        
        // Get current values as integers, ensuring they're not negative
        const currentSpent = Math.max(0, parseInt(team.spent) || 0);
        const currentPlayersCount = Math.max(0, parseInt(team.players_count) || 0);
        
        // Calculate new values, ensuring they don't go negative
        // Only subtract if the values are positive and we have something to subtract
        const newSpent = Math.max(0, currentSpent - soldPrice);
        // Only decrement if players_count is greater than 0
        const newPlayersCount = currentPlayersCount > 0 ? currentPlayersCount - 1 : 0;
        
        // Update team: subtract spent amount and decrease players count
        db.run(
          'UPDATE teams SET spent = ?, players_count = ? WHERE id = ?',
          [newSpent, newPlayersCount, teamId],
          (err) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            // Update player status to unsold
            db.run(
              'UPDATE players SET status = "unsold", team_id = NULL, sold_price = NULL WHERE id = ?',
              [id],
              (err) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                
                // Get updated player
                db.get(
                  'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = ?',
                  [id],
                  (err, updatedPlayer) => {
                    if (err) {
                      return res.status(500).json({ error: err.message });
                    }
                    
                    const io = req.app.get('io');
                    if (io) {
                      io.to('auction-room').emit('player-unsold', { player: updatedPlayer });
                    }
                    
                    res.json({ message: 'Player marked as unsold', player: updatedPlayer });
                  }
                );
              }
            );
          }
        );
      });
    } else {
      // Player is already unsold or was never sold, just ensure status is unsold
      db.run(
        'UPDATE players SET status = "unsold", team_id = NULL, sold_price = NULL WHERE id = ?',
        [id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          // Get updated player
          db.get(
            'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = ?',
            [id],
            (err, updatedPlayer) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              const io = req.app.get('io');
              if (io) {
                io.to('auction-room').emit('player-unsold', { player: updatedPlayer });
              }
              
              res.json({ message: 'Player marked as unsold', player: updatedPlayer });
            }
          );
        }
      );
    }
  });
});

// Get unsold players
router.get('/status/unsold', (req, res) => {
  const db = getDb();
  db.all(
    'SELECT * FROM players WHERE status = "unsold" ORDER BY id',
    (err, players) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(players);
  });
});

// Get lot details players (for lot auction) - includes both lot details players and unsold players
// IMPORTANT: This route must be BEFORE /:id route to avoid being matched as an ID
// Note: Lot details players remain visible even after being assigned to a team (sold status)
router.get('/lot-details', (req, res) => {
  const db = getDb();
  db.all(
    'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.is_lot_details = 1 OR p.status = "unsold" ORDER BY p.is_lot_details DESC, p.id',
    (err, players) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(players);
  });
});

// Get player by ID (must be after specific routes like /lot-details)
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  db.get(
    'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = ?',
    [id],
    (err, player) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }
      res.json(player);
    }
  );
});

// Get player by index (for navigation)
router.get('/navigate/:direction', (req, res) => {
  const db = getDb();
  const { direction } = req.params;
  const { currentId } = req.query;
  
  let query;
  if (direction === 'next') {
    query = 'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id > ? ORDER BY p.id LIMIT 1';
  } else {
    query = 'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id < ? ORDER BY p.id DESC LIMIT 1';
  }
  
  db.get(query, [currentId || 0], (err, player) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!player) {
      return res.status(404).json({ error: `No ${direction} player found` });
    }
    res.json(player);
  });
});

// Update sold player's team and bid
router.put('/:id/update-sold', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { team_id, amount, range } = req.body;
  
  if (!team_id || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'Team ID and amount are required' });
  }
  
  const amountValue = parseInt(amount);
  if (isNaN(amountValue) || amountValue < 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  
  // Check if player exists and is sold
  db.get('SELECT * FROM players WHERE id = ?', [id], (err, player) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    if (player.status !== 'sold') {
      return res.status(400).json({ error: 'Player is not sold' });
    }
    
    // Get old team and new team
    db.get('SELECT * FROM teams WHERE id = ?', [player.team_id], (err, oldTeam) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.get('SELECT * FROM teams WHERE id = ?', [team_id], (err, newTeam) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        if (!newTeam) {
          return res.status(404).json({ error: 'New team not found' });
        }
        
        // Calculate budget check for new team
        const newTeamRemaining = newTeam.budget - newTeam.spent;
        const oldAmount = player.sold_price || 0;
        
        // If changing to a different team, need to check budget
        if (player.team_id !== team_id) {
          // Add back old amount to old team's budget
          if (oldTeam) {
            const oldTeamSpent = Math.max(0, parseInt(oldTeam.spent) || 0);
            const oldTeamPlayersCount = Math.max(0, parseInt(oldTeam.players_count) || 0);
            const oldAmountInt = parseInt(oldAmount) || 0;
            
            // Calculate new values, ensuring they don't go negative
            const newOldTeamSpent = Math.max(0, oldTeamSpent - oldAmountInt);
            // Only decrement if players_count is greater than 0
            const newOldTeamPlayersCount = oldTeamPlayersCount > 0 ? oldTeamPlayersCount - 1 : 0;
            
            db.run(
              'UPDATE teams SET spent = ?, players_count = ? WHERE id = ?',
              [newOldTeamSpent, newOldTeamPlayersCount, player.team_id],
              (err) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
              }
            );
          }
          
          // Check if new team has enough budget
          if (amountValue > newTeamRemaining) {
            // Revert old team changes
            if (oldTeam) {
              db.run(
                'UPDATE teams SET spent = spent + ?, players_count = players_count + 1 WHERE id = ?',
                [oldAmount, player.team_id],
                () => {}
              );
            }
            return res.status(400).json({ error: 'Insufficient budget for new team' });
          }
          
          // Update new team
          db.run(
            'UPDATE teams SET spent = spent + ?, players_count = players_count + 1 WHERE id = ?',
            [amountValue, team_id],
            (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              // Update player
              db.run(
                'UPDATE players SET team_id = ?, sold_price = ?, range = ? WHERE id = ?',
                [team_id, amountValue, range || null, id],
                (err) => {
                  if (err) {
                    return res.status(500).json({ error: err.message });
                  }
                  
                  // Get updated player
                  db.get(
                    'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = ?',
                    [id],
                    (err, updatedPlayer) => {
                      if (err) {
                        return res.status(500).json({ error: err.message });
                      }
                      
                      const io = req.app.get('io');
                      if (io) {
                        io.to('auction-room').emit('player-updated', { player: updatedPlayer });
                      }
                      
                      res.json({ message: 'Player updated successfully', player: updatedPlayer });
                    }
                  );
                }
              );
            }
          );
        } else {
          // Same team, just updating amount
          const amountDiff = amountValue - oldAmount;
          const newRemaining = newTeamRemaining + oldAmount; // Add back old amount
          
          if (amountValue > newRemaining) {
            return res.status(400).json({ error: 'Insufficient budget' });
          }
          
          // Update team spent
          db.run(
            'UPDATE teams SET spent = spent + ? WHERE id = ?',
            [amountDiff, team_id],
            (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              // Update player
              db.run(
                'UPDATE players SET sold_price = ?, range = ? WHERE id = ?',
                [amountValue, range || null, id],
                (err) => {
                  if (err) {
                    return res.status(500).json({ error: err.message });
                  }
                  
                  // Get updated player
                  db.get(
                    'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = ?',
                    [id],
                    (err, updatedPlayer) => {
                      if (err) {
                        return res.status(500).json({ error: err.message });
                      }
                      
                      const io = req.app.get('io');
                      if (io) {
                        io.to('auction-room').emit('player-updated', { player: updatedPlayer });
                      }
                      
                      res.json({ message: 'Player updated successfully', player: updatedPlayer });
                    }
                  );
                }
              );
            }
          );
        }
      });
    });
  });
});

// Add player to lot (set is_lot_details = 1)
router.post('/:id/add-to-lot', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  db.get('SELECT * FROM players WHERE id = ?', [id], (err, player) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    if (player.status === 'sold') {
      return res.status(400).json({ error: 'Cannot add sold player to lot' });
    }
    if (player.is_lot_details === 1) {
      return res.status(400).json({ error: 'Player is already in lot' });
    }

    db.run('UPDATE players SET is_lot_details = 1 WHERE id = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      db.get('SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = ?', [id], (err, updatedPlayer) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        const io = req.app.get('io');
        if (io) {
          io.to('auction-room').emit('player-updated', { player: updatedPlayer });
        }
        res.json({ message: 'Player added to lot', player: updatedPlayer });
      });
    });
  });
});

// Delete player (must be before /:id/sell to avoid route conflicts)
router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  // Check if player exists
  db.get('SELECT * FROM players WHERE id = ?', [id], (err, player) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // If player was sold, need to reverse team stats
    // Check if player has team_id (sold players should have team_id, even if sold_price is 0 for lot players)
    if (player.status === 'sold' && player.team_id) {
      const teamId = player.team_id;
      const soldPrice = parseInt(player.sold_price) || 0;
      
      // Get the team first to check current values
      db.get('SELECT * FROM teams WHERE id = ?', [teamId], (err, team) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        if (!team) {
          // Team might have been deleted, just delete the player
          db.run('DELETE FROM players WHERE id = ?', [id], function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            const io = req.app.get('io');
            if (io) {
              io.to('auction-room').emit('player-updated', { player: null, deleted: true });
            }
            res.json({ message: 'Player deleted', changes: this.changes });
          });
          return;
        }
        
        // Get current values as integers, ensuring they're not negative
        const currentSpent = Math.max(0, parseInt(team.spent) || 0);
        const currentPlayersCount = Math.max(0, parseInt(team.players_count) || 0);
        
        // Calculate new values, ensuring they don't go negative
        const newSpent = Math.max(0, currentSpent - soldPrice);
        const newPlayersCount = currentPlayersCount > 0 ? currentPlayersCount - 1 : 0;
        
            // Update team: subtract spent amount and decrease players count
            db.run(
              'UPDATE teams SET spent = ?, players_count = ? WHERE id = ?',
              [newSpent, newPlayersCount, teamId],
              (err) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                
                // Delete player
                db.run('DELETE FROM players WHERE id = ?', [id], function(err) {
                  if (err) {
                    return res.status(500).json({ error: err.message });
                  }
                  
                  const io = req.app.get('io');
                  if (io) {
                    io.to('auction-room').emit('player-updated', { player: null, deleted: true });
                    // Emit team update event to refresh team counts
                    db.get('SELECT * FROM teams WHERE id = ?', [teamId], (err, updatedTeam) => {
                      if (!err && updatedTeam) {
                        io.to('auction-room').emit('team-updated', { team: updatedTeam });
                      }
                    });
                  }
                  
                  res.json({ message: 'Player deleted', changes: this.changes });
                });
              }
            );
      });
    } else {
      // Player is not sold, just delete
      db.run('DELETE FROM players WHERE id = ?', [id], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const io = req.app.get('io');
        if (io) {
          io.to('auction-room').emit('player-updated', { player: null, deleted: true });
        }
        
        res.json({ message: 'Player deleted', changes: this.changes });
      });
    }
  });
});

// Sell player
router.post('/:id/sell', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { team_id, amount, sale_method, range } = req.body;
  
  if (!team_id || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'Team ID and amount are required' });
  }
  
  const amountValue = parseInt(amount);
  if (isNaN(amountValue) || amountValue < 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  
  // Check if player exists
  db.get('SELECT * FROM players WHERE id = ?', [id], (err, player) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    if (player.status === 'sold') {
      return res.status(400).json({ error: 'Player is already sold' });
    }
    
    // Check team budget
    db.get('SELECT * FROM teams WHERE id = ?', [team_id], (err, team) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
      
      // Skip budget check for lot auction (sale_method 'alot') - no points/base_price considered
      if (sale_method !== 'alot') {
        const remainingBudget = team.budget - team.spent;
        if (amountValue > remainingBudget) {
          return res.status(400).json({ error: 'Insufficient budget' });
        }
      }
      
      // Update player status
      db.run(
        'UPDATE players SET status = "sold", team_id = ?, sold_price = ?, sale_method = ?, range = ? WHERE id = ?',
        [team_id, amountValue, sale_method || null, range || null, id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          // Update team spent and players count
          db.run(
            'UPDATE teams SET spent = spent + ?, players_count = players_count + 1 WHERE id = ?',
            [amountValue, team_id],
            (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              // Get updated player with team info
              db.get(
                'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id WHERE p.id = ?',
                [id],
                (err, updatedPlayer) => {
                  if (err) {
                    return res.status(500).json({ error: err.message });
                  }
                  
                  const io = req.app.get('io');
                  if (io) {
                    io.to('auction-room').emit('player-sold', { player: updatedPlayer });
                  }
                  
                  res.json({ message: 'Player sold successfully', player: updatedPlayer });
                }
              );
            }
          );
        }
      );
    });
  });
});

module.exports = router;

