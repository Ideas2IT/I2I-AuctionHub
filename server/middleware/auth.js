const { getDb } = require('../database');

function authenticate(req, res, next) {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
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
      
      req.user = {
        username: session.username,
        role: session.role,
        sessionId: session.id
      };
      next();
    }
  );
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };

