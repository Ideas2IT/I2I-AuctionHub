const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

// All bundle routes require authentication
router.use(authenticate);

// Get all bundle ranges
router.get('/ranges', (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM bundle_ranges ORDER BY range_value DESC', (err, ranges) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(ranges);
  });
});

// Create bundle range
router.post('/ranges', (req, res) => {
  const db = getDb();
  const { range_value, range_letter, min_value, max_value } = req.body;
  
  if (!range_value || parseInt(range_value) <= 0) {
    return res.status(400).json({ error: 'Range value must be a positive number' });
  }
  
  if (!range_letter || !range_letter.trim()) {
    return res.status(400).json({ error: 'Range letter is required' });
  }
  
  db.run(
    'INSERT INTO bundle_ranges (range_value, range_letter, min_value, max_value) VALUES (?, ?, ?, ?)',
    [parseInt(range_value), range_letter.trim().toUpperCase(), parseInt(min_value) || 0, parseInt(max_value) || 0],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'Range value already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ 
        id: this.lastID, 
        range_value: parseInt(range_value), 
        range_letter: range_letter.trim().toUpperCase(),
        min_value: parseInt(min_value) || 0, 
        max_value: parseInt(max_value) || 0 
      });
    }
  );
});

// Update bundle range
router.put('/ranges/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { range_value, range_letter, min_value, max_value } = req.body;
  
  if (!range_value || parseInt(range_value) <= 0) {
    return res.status(400).json({ error: 'Range value must be a positive number' });
  }
  
  if (!range_letter || !range_letter.trim()) {
    return res.status(400).json({ error: 'Range letter is required' });
  }
  
  db.run(
    'UPDATE bundle_ranges SET range_value = ?, range_letter = ?, min_value = ?, max_value = ? WHERE id = ?',
    [parseInt(range_value), range_letter.trim().toUpperCase(), parseInt(min_value) || 0, parseInt(max_value) || 0, id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'Range value already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Range updated', changes: this.changes });
    }
  );
});

// Delete bundle range
router.delete('/ranges/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  
  db.run('DELETE FROM bundle_ranges WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Range deleted', changes: this.changes });
  });
});

// Get all team participations (for admin view) - MUST come before /participation/:teamId/:rangeId
router.get('/participation/team/:teamId', (req, res) => {
  const db = getDb();
  const { teamId } = req.params;
  
  // First check if there are any participations at all
  db.all(
    `SELECT * FROM bundle_participations WHERE team_id = ?`,
    [teamId],
    (err, rawParticipations) => {
      if (err) {
        console.error(`Error fetching raw participations for team ${teamId}:`, err);
        return res.status(500).json({ error: err.message });
      }
      // Now get participations with range details via JOIN
      db.all(
        `SELECT bp.*, br.range_value, br.range_letter 
         FROM bundle_participations bp 
         LEFT JOIN bundle_ranges br ON bp.range_id = br.id 
         WHERE bp.team_id = ? 
         ORDER BY bp.created_at DESC`,
        [teamId],
        (err, participations) => {
          if (err) {
            console.error(`Error fetching participations with JOIN for team ${teamId}:`, err);
            return res.status(500).json({ error: err.message });
          }
          
          // If JOIN didn't return range_letter, try to get it from bundle_ranges
          const enrichedParticipations = participations.map(p => {
            if (!p.range_letter && p.range_id) {
              // This will be handled by a separate query if needed, but for now return as is
              return p;
            }
            return p;
          });
          
          res.json(enrichedParticipations || []);
        }
      );
    }
  );
});

// Get team participation status for a specific range - MUST come after /participation/team/:teamId
router.get('/participation/:teamId/:rangeId', (req, res) => {
  const db = getDb();
  const { teamId, rangeId } = req.params;
  
  db.all(
    'SELECT * FROM bundle_participations WHERE team_id = ? AND range_id = ? ORDER BY created_at DESC',
    [teamId, rangeId],
    (err, participations) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Check if team has won in this range
      const hasWon = participations.some(p => p.result === 'won');
      
      // Get total wins across all ranges
      db.all(
        'SELECT COUNT(*) as total_wins FROM bundle_participations WHERE team_id = ? AND result = "won"',
        [teamId],
        (err, result) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          const totalWins = result[0]?.total_wins || 0;
          
          res.json({
            canParticipate: !hasWon && totalWins < 3,
            hasWonInRange: hasWon,
            totalWins: totalWins,
            participations: participations
          });
        }
      );
    }
  );
});

// Record bundle participation (win or loss)
router.post('/participation', (req, res) => {
  const db = getDb();
  const { team_id, range_id, bid_amount, result } = req.body;
  
  if (!team_id || !range_id || !bid_amount || !result) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (result !== 'won' && result !== 'lost') {
    return res.status(400).json({ error: 'Result must be "won" or "lost"' });
  }
  
  db.run(
    'INSERT INTO bundle_participations (team_id, range_id, bid_amount, result) VALUES (?, ?, ?, ?)',
    [parseInt(team_id), parseInt(range_id), parseInt(bid_amount), result],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, message: 'Participation recorded' });
    }
  );
});

module.exports = router;
