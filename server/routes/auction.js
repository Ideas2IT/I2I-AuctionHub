const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// Get auction state
router.get('/state', (req, res) => {
  const db = getDb();
  db.get('SELECT * FROM auction_state WHERE id = 1', (err, state) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(state || { is_active: 0, current_player_id: null, current_bid: 0 });
  });
});

// Start auction
router.post('/start', (req, res) => {
  const db = getDb();
  const io = req.app.get('io');
  
  db.run(
    'UPDATE auction_state SET is_active = 1 WHERE id = 1',
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Get first unsold player
      db.get(
        'SELECT * FROM players WHERE status = "unsold" ORDER BY id LIMIT 1',
        (err, player) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          if (player) {
            db.run(
              'UPDATE auction_state SET current_player_id = ?, current_bid = 0, current_team_id = NULL, timer_seconds = 60 WHERE id = 1',
              [player.id],
              (err) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                
                io.to('auction-room').emit('auction-started', { player });
                res.json({ message: 'Auction started', player });
              }
            );
          } else {
            res.json({ message: 'No players available' });
          }
        }
      );
    }
  );
});

// Stop auction
router.post('/stop', (req, res) => {
  const db = getDb();
  const io = req.app.get('io');
  
  db.run(
    'UPDATE auction_state SET is_active = 0, current_player_id = NULL, current_bid = 0, current_team_id = NULL WHERE id = 1',
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      io.to('auction-room').emit('auction-stopped');
      res.json({ message: 'Auction stopped' });
    }
  );
});

// Place bid
router.post('/bid', (req, res) => {
  const db = getDb();
  const io = req.app.get('io');
  const { team_id, amount } = req.body;
  
  if (!team_id || !amount) {
    return res.status(400).json({ error: 'Team ID and amount are required' });
  }
  
  // Get current auction state
  db.get('SELECT * FROM auction_state WHERE id = 1', (err, state) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!state || !state.is_active) {
      return res.status(400).json({ error: 'Auction is not active' });
    }
    
    if (!state.current_player_id) {
      return res.status(400).json({ error: 'No player is currently on auction' });
    }
    
    // Check if bid is higher than current bid
    if (amount <= state.current_bid) {
      return res.status(400).json({ error: 'Bid must be higher than current bid' });
    }
    
    // Check team budget
    db.get('SELECT * FROM teams WHERE id = ?', [team_id], (err, team) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
      
      const remainingBudget = team.budget - team.spent;
      if (amount > remainingBudget) {
        return res.status(400).json({ error: 'Insufficient budget' });
      }
      
      // Record bid
      db.run(
        'INSERT INTO bids (player_id, team_id, amount) VALUES (?, ?, ?)',
        [state.current_player_id, team_id, amount],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          // Update auction state
          db.run(
            'UPDATE auction_state SET current_bid = ?, current_team_id = ?, timer_seconds = 60 WHERE id = 1',
            [amount, team_id],
            (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              // Emit update to all clients
              db.get(
                'SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON t.id = ? WHERE p.id = ?',
                [team_id, state.current_player_id],
                (err, player) => {
                  io.to('auction-room').emit('bid-update', {
                    player_id: state.current_player_id,
                    team_id,
                    team_name: team.name,
                    amount,
                    player
                  });
                  res.json({ message: 'Bid placed successfully', bid: { team_id, amount } });
                }
              );
            }
          );
        }
      );
    });
  });
});

// Sell player (finalize bid)
router.post('/sell', (req, res) => {
  const db = getDb();
  const io = req.app.get('io');
  
  db.get('SELECT * FROM auction_state WHERE id = 1', (err, state) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!state || !state.current_player_id || !state.current_team_id) {
      return res.status(400).json({ error: 'No active bid to finalize' });
    }
    
    // Update player status
    db.run(
      'UPDATE players SET status = "sold", team_id = ?, sold_price = ? WHERE id = ?',
      [state.current_team_id, state.current_bid, state.current_player_id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Update team spent and players count
        db.run(
          'UPDATE teams SET spent = spent + ?, players_count = players_count + 1 WHERE id = ?',
          [state.current_bid, state.current_team_id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            // Get next unsold player
            db.get(
              'SELECT * FROM players WHERE status = "unsold" ORDER BY id LIMIT 1',
              (err, nextPlayer) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                
                if (nextPlayer) {
                  db.run(
                    'UPDATE auction_state SET current_player_id = ?, current_bid = 0, current_team_id = NULL, timer_seconds = 60 WHERE id = 1',
                    [nextPlayer.id],
                    (err) => {
                      if (err) {
                        return res.status(500).json({ error: err.message });
                      }
                      
                      db.get('SELECT * FROM players WHERE id = ?', [state.current_player_id], (err, soldPlayer) => {
                        db.get('SELECT * FROM teams WHERE id = ?', [state.current_team_id], (err, team) => {
                          io.to('auction-room').emit('player-sold', {
                            player: soldPlayer,
                            team: team,
                            price: state.current_bid,
                            nextPlayer
                          });
                          res.json({ message: 'Player sold', nextPlayer });
                        });
                      });
                    }
                  );
                } else {
                  // No more players
                  db.run(
                    'UPDATE auction_state SET is_active = 0, current_player_id = NULL, current_bid = 0, current_team_id = NULL WHERE id = 1',
                    (err) => {
                      db.get('SELECT * FROM players WHERE id = ?', [state.current_player_id], (err, soldPlayer) => {
                        db.get('SELECT * FROM teams WHERE id = ?', [state.current_team_id], (err, team) => {
                          io.to('auction-room').emit('player-sold', {
                            player: soldPlayer,
                            team: team,
                            price: state.current_bid,
                            nextPlayer: null
                          });
                          io.to('auction-room').emit('auction-completed');
                          res.json({ message: 'Player sold. Auction completed - no more players' });
                        });
                      });
                    }
                  );
                }
              }
            );
          }
        );
      }
    );
  });
});

// Update timer
router.post('/timer', (req, res) => {
  const db = getDb();
  const io = req.app.get('io');
  const { seconds } = req.body;
  
  db.run(
    'UPDATE auction_state SET timer_seconds = ? WHERE id = 1',
    [seconds],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      io.to('auction-room').emit('timer-update', { seconds });
      res.json({ message: 'Timer updated', seconds });
    }
  );
});

module.exports = router;

