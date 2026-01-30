const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;
const USERNAME_MIN_LEN = 2;
const USERNAME_MAX_LEN = 50;
const PASSWORD_MIN_LEN = 6;

// Test endpoint to check if auth is working
router.get('/test', (req, res) => {
  const db = getDb();
  if (!db) {
    return res.json({ status: 'error', message: 'Database not initialized' });
  }
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
    if (err) {
      return res.json({ status: 'error', message: 'Database error: ' + err.message });
    }
    if (!row) {
      return res.json({ status: 'error', message: 'Users table does not exist. Please restart the server.' });
    }
    return res.json({ status: 'ok', message: 'Auth system is ready. Sign up to create an account.' });
  });
});

// Sign up endpoint
router.post('/signup', (req, res) => {
  const { username, password } = req.body;

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < USERNAME_MIN_LEN) {
    return res.status(400).json({ error: `Username must be at least ${USERNAME_MIN_LEN} characters` });
  }
  if (trimmed.length > USERNAME_MAX_LEN) {
    return res.status(400).json({ error: `Username must be at most ${USERNAME_MAX_LEN} characters` });
  }
  if (password.length < PASSWORD_MIN_LEN) {
    return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LEN} characters` });
  }

  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: 'Database not available. Please restart the server.' });
  }

  // Check if any user exists (first user becomes admin)
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
      console.error('Signup count error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    const isFirstUser = row && row.count === 0;
    const role = isFirstUser ? 'admin' : 'user';

    bcrypt.hash(password, SALT_ROUNDS, (hashErr, passwordHash) => {
      if (hashErr) {
        console.error('bcrypt hash error:', hashErr);
        return res.status(500).json({ error: 'Could not create account' });
      }
      db.run(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [trimmed, passwordHash, role],
        function (insertErr) {
          if (insertErr) {
            if (insertErr.message && insertErr.message.includes('UNIQUE')) {
              return res.status(409).json({ error: 'Username already taken' });
            }
            console.error('Signup insert error:', insertErr);
            return res.status(500).json({ error: 'Could not create account' });
          }
          // Signup successful (username/role not logged for security)
          res.status(201).json({
            success: true,
            message: 'Account created. You can now log in.',
            username: trimmed,
            role
          });
        }
      );
    });
  });
});

// Login endpoint
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const trimmed = username.trim().toLowerCase();
  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: 'Database not available. Please restart the server.' });
  }

  db.get('SELECT id, username, password_hash, role FROM users WHERE username = ?', [trimmed], (err, user) => {
    if (err) {
      console.error('Login lookup error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    bcrypt.compare(password, user.password_hash, (compareErr, match) => {
      if (compareErr) {
        console.error('bcrypt compare error:', compareErr);
        return res.status(500).json({ error: 'Authentication error' });
      }
      if (!match) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const sessionId = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      db.run(
        'INSERT INTO sessions (id, username, role, expires_at) VALUES (?, ?, ?, ?)',
        [sessionId, user.username, user.role, expiresAt.toISOString()],
        function (sessionErr) {
          if (sessionErr) {
            console.error('Session creation error:', sessionErr);
            return res.status(500).json({ error: 'Failed to create session' });
          }
          res.json({
            success: true,
            sessionId,
            username: user.username,
            role: user.role,
            expiresAt: expiresAt.toISOString()
          });
        }
      );
    });
  });
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
  const sessionId = req.headers.authorization?.replace('Bearer ', '');

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
