const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

router.post('/register', async (req, res) => {
  const { username, password, avatar_url } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ error: 'Username already taken' });

    const password_hash = await bcrypt.hash(password, 10);
    await db.run(
      'INSERT INTO users (username, password_hash, role, avatar_url, is_approved) VALUES (?, ?, ?, ?, ?)',
      [username, password_hash, 'user', avatar_url || null, false]
    );

    res.json({ success: true, message: 'Registration successful. Waiting for admin approval.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  try {
    // Check if any users exist
    let user = await db.get('SELECT * FROM users LIMIT 1');

    // If no users exist, create default admin from env
    if (!user) {
      console.log('No users found in database. Creating default admin...');
      const adminHash = process.env.ADMIN_PASSWORD_HASH;
      if (!adminHash) {
        return res.status(500).json({ error: 'Server configuration error: ADMIN_PASSWORD_HASH not set' });
      }
      
      const { id } = await db.run(
        'INSERT INTO users (username, password_hash, role, is_approved) VALUES (?, ?, ?, ?)',
        ['admin', adminHash, 'admin', true]
      );
      user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    }

    // If username provided, find that specific user
    if (username) {
      user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    } else if (user && user.username !== 'admin') {
      // If no username provided but users exist, we don't know who to log in as
      // except if there's only one user and it's admin (legacy behavior)
      return res.status(400).json({ error: 'Username required' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.is_approved) {
      return res.status(403).json({ error: 'Pending Approval' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (isMatch) {
      const token = jwt.sign(
        { 
          id: user.id,
          username: user.username,
          role: user.role,
          avatar_url: user.avatar_url
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ 
        token, 
        user: { 
          id: user.id,
          username: user.username, 
          role: user.role,
          avatar_url: user.avatar_url
        } 
      });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
