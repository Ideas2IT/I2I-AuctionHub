const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const crypto = require('crypto');

// User credentials
const USERS = {
  admin: { password: 'ICL2026', role: 'admin' },
  user: { password: 'ICL2026', role: 'user' }
};

// Test endpoint to check if auth is working
router.get('/test', (req, res) => {
  const db = getDb();
  if (!db) {
    return res.json({ status: 'error', message: 'Database not initialized' });
  }
  
  // Test if sessions table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'", (err, row) => {
    if (err) {
      return res.json({ status: 'error', message: 'Database error: ' + err.message });
    }
    if (!row) {
      return res.json({ status: 'error', message: 'Sessions table does not exist. Please restart the server.' });
    }
    return res.json({ status: 'ok', message: 'Auth system is ready', users: Object.keys(USERS) });
  });
});

// Login endpoint
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt:', { username, hasPassword: !!password });
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const user = USERS[username.toLowerCase()];
  console.log('User lookup:', { usernameLower: username.toLowerCase(), userFound: !!user });
  
  if (!user) {
    console.log('User not found');
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  
  // Password is case-sensitive - exact match required
  if (user.password !== password) {
    console.log('Password mismatch - case-sensitive check failed');
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  
  // Create session token
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  const db = getDb();
  if (!db) {
    console.error('Database not initialized');
    return res.status(500).json({ error: 'Database not available. Please restart the server.' });
  }
  
  db.run(
    'INSERT INTO sessions (id, username, role, expires_at) VALUES (?, ?, ?, ?)',
    [sessionId, username.toLowerCase(), user.role, expiresAt.toISOString()],
    function(err) {
      if (err) {
        console.error('Session creation error:', err);
        // Check if it's a table doesn't exist error
        if (err.message && err.message.includes('no such table')) {
          return res.status(500).json({ error: 'Database tables not initialized. Please restart the server.' });
        }
        return res.status(500).json({ error: 'Failed to create session: ' + err.message });
      }
      
      console.log('Login successful for:', username.toLowerCase());
      res.json({
        success: true,
        sessionId,
        username: username.toLowerCase(),
        role: user.role,
        expiresAt: expiresAt.toISOString()
      });
    }
  );
});

// Logout endpoint
router.post('/logout', (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }
  
  const db = getDb();
  db.run('DELETE FROM sessions WHERE id = ?', [sessionId], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Verify session endpoint
router.get('/verify', (req, res) => {
  const sessionId = req.headers.authorization?.replace('Bearer ', '') || req.query.sessionId;
  
  if (!sessionId) {
    return res.status(401).json({ error: 'No session provided' });
  }
  
  const db = getDb();
  db.get(
    'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")',
    [sessionId],
    (err, session) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }
      
      res.json({
        valid: true,
        username: session.username,
        role: session.role
      });
    }
  );
});

module.exports = router;

