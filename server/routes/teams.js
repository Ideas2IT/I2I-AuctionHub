const express = require('express');
const router = express.Router();
const { getDb, loadDataFromFile } = require('../database');

// Get all teams
router.get('/', (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM teams ORDER BY id', (err, teams) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Fix any negative values in the database and in the response
    teams.forEach((team) => {
      if (team.spent < 0 || team.players_count < 0) {
        const fixedSpent = Math.max(0, parseInt(team.spent) || 0);
        const fixedPlayersCount = Math.max(0, parseInt(team.players_count) || 0);
        
        // Update in database
        db.run(
          'UPDATE teams SET spent = ?, players_count = ? WHERE id = ?',
          [fixedSpent, fixedPlayersCount, team.id],
          () => {}
        );
        
        // Update in response
        team.spent = fixedSpent;
        team.players_count = fixedPlayersCount;
      }
    });
    
    res.json(teams);
  });
});

// Get team by ID
router.get('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  db.get('SELECT * FROM teams WHERE id = ?', [id], (err, team) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Get team players
    db.all(
      'SELECT * FROM players WHERE team_id = ? ORDER BY sold_price DESC',
      [id],
      (err, players) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ ...team, players });
      }
    );
  });
});

// Create team
router.post('/', (req, res) => {
  const db = getDb();
  const { name, budget, captain, wise_captain } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Team name is required' });
  }
  
  db.run(
    'INSERT INTO teams (name, budget, captain, wise_captain) VALUES (?, ?, ?, ?)',
    [name, budget || 100000, captain || null, wise_captain || null],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'Team name already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, name, budget: budget || 100000, captain: captain || null, wise_captain: wise_captain || null });
    }
  );
});

// Update team
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { name, budget, captain, wise_captain } = req.body;
  
  const updates = [];
  const params = [];
  
  if (name) {
    updates.push('name = ?');
    params.push(name);
  }
  if (budget !== undefined) {
    updates.push('budget = ?');
    params.push(budget);
  }
  if (captain !== undefined) {
    updates.push('captain = ?');
    params.push(captain || null);
  }
  if (wise_captain !== undefined) {
    updates.push('wise_captain = ?');
    params.push(wise_captain || null);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  params.push(id);
  
  db.run(
    `UPDATE teams SET ${updates.join(', ')} WHERE id = ?`,
    params,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Team updated', changes: this.changes });
    }
  );
});

// Delete team
router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  // First, unsell all players from this team
  db.run('UPDATE players SET status = "unsold", team_id = NULL, sold_price = NULL WHERE team_id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Then delete the team
    db.run('DELETE FROM teams WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Team deleted', changes: this.changes });
    });
  });
});

// Recalculate team players_count based on actual sold players
router.post('/sync-counts', (req, res) => {
  const db = getDb();
  
  db.all('SELECT id FROM teams', (err, teams) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    let completed = 0;
    let total = teams.length;
    
    teams.forEach((team) => {
      db.get(
        'SELECT COUNT(*) as count FROM players WHERE team_id = ? AND status = "sold"',
        [team.id],
        (err, result) => {
          if (err) {
            console.error(`Error counting players for team ${team.id}:`, err);
            return;
          }
          
          const actualCount = result.count || 0;
          
          // Update the team's players_count
          db.run(
            'UPDATE teams SET players_count = ? WHERE id = ?',
            [actualCount, team.id],
            (err) => {
              if (err) {
                console.error(`Error updating count for team ${team.id}:`, err);
                return;
              }
              
              completed++;
              if (completed === total) {
                res.json({ message: 'Team counts synced successfully' });
              }
            }
          );
        }
      );
    });
    
    if (teams.length === 0) {
      res.json({ message: 'No teams to sync' });
    }
  });
});

// Reload data from file (CSV or Excel)
router.post('/reload-csv', async (req, res) => {
  try {
    await loadDataFromFile();
    
    // Emit socket event to notify clients to refresh
    const io = req.app.get('io');
    if (io) {
      io.to('auction-room').emit('data-cleared');
    }
    
    res.json({ message: 'Data reloaded successfully from file (CSV or Excel)' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

