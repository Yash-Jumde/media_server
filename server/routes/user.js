const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Get current user profile
router.get('/user/profile', authenticateToken, async (req, res) => {
  console.log(`[Backend] GET /user/profile - User ID: ${req.user.id}`);
  try {
    const user = await db.get('SELECT id, username, role, avatar_url, is_approved, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      console.warn(`[Backend] Profile not found for User ID: ${req.user.id}`);
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update profile
router.put('/user/profile', authenticateToken, async (req, res) => {
  const { username, avatar_url } = req.body;
  const userId = req.user.id;

  try {
    // If username is being changed, check if it's already taken
    if (username) {
      const existing = await db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
      if (existing) return res.status(400).json({ error: 'Username already taken' });
    }

    const current = await db.get('SELECT username, avatar_url FROM users WHERE id = ?', [userId]);
    const newUsername = username || current.username;
    const newAvatar = avatar_url !== undefined ? avatar_url : current.avatar_url;

    await db.run(
      'UPDATE users SET username = ?, avatar_url = ? WHERE id = ?',
      [newUsername, newAvatar, userId]
    );

    res.json({ 
      success: true, 
      user: { 
        id: userId, 
        username: newUsername, 
        avatar_url: newAvatar 
      } 
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
