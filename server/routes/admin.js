const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Clear all data endpoint
router.post('/clear-all', (req, res) => {
  const db = getDb();
  
  db.serialize(() => {
    // Delete all bids
    db.run('DELETE FROM bids', (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to clear bids: ' + err.message });
      }
      
      // Reset all players to unsold
      db.run('UPDATE players SET status = "unsold", team_id = NULL, sold_price = NULL', (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to reset players: ' + err.message });
        }
        
        // Reset all teams
        db.run('UPDATE teams SET spent = 0, players_count = 0', (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to reset teams: ' + err.message });
          }
          
          // Reset auction state
          db.run('UPDATE auction_state SET is_active = 0, current_player_id = NULL, current_bid = 0, current_team_id = NULL, timer_seconds = 60 WHERE id = 1', (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to reset auction state: ' + err.message });
            }
            
            const io = req.app.get('io');
            io.to('auction-room').emit('data-cleared');
            
            res.json({ 
              success: true, 
              message: 'All data cleared successfully' 
            });
          });
        });
      });
    });
  });
});

// Reset all team budgets to 100000
router.post('/reset-budgets', (req, res) => {
  const db = getDb();
  
  db.run('UPDATE teams SET budget = 100000', function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to reset budgets: ' + err.message });
    }
    
    const io = req.app.get('io');
    if (io) {
      io.to('auction-room').emit('teams-updated');
    }
    
    res.json({ 
      success: true, 
      message: `All team budgets reset to 100000 (displays as 1000)`,
      changes: this.changes
    });
  });
});

module.exports = router;

