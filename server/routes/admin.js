const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// Get all users
router.get('/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await db.all('SELECT id, username, role, avatar_url, is_approved, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending users
router.get('/admin/pending', authenticateToken, isAdmin, async (req, res) => {
  try {
    const pending = await db.all('SELECT id, username, role, avatar_url, created_at FROM users WHERE is_approved = FALSE ORDER BY created_at DESC');
    res.json(pending);
  } catch (err) {
    console.error('Error fetching pending users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve user
router.post('/admin/approve', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'User ID required' });

  try {
    const result = await db.run('UPDATE users SET is_approved = TRUE WHERE id = ?', [id]);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'User approved' });
  } catch (err) {
    console.error('Error approving user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user role
router.post('/admin/role', authenticateToken, isAdmin, async (req, res) => {
  const { id, role } = req.body;
  if (!id || !role) return res.status(400).json({ error: 'User ID and role required' });
  if (role !== 'admin' && role !== 'user') return res.status(400).json({ error: 'Invalid role' });

  // Prevent admin from changing their own role (safety)
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }

  try {
    const result = await db.run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: `User role updated to ${role}` });
  } catch (err) {
    console.error('Error updating role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
router.post('/admin/delete', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'User ID required' });

  // Prevent admin from deleting themselves
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    const result = await db.run('DELETE FROM users WHERE id = ?', [id]);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'User removed' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deny user (legacy, same as delete but for pending)
router.post('/admin/deny', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'User ID required' });

  try {
    const result = await db.run('DELETE FROM users WHERE id = ? AND is_approved = FALSE', [id]);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found or already approved' });
    res.json({ success: true, message: 'User registration denied and removed' });
  } catch (err) {
    console.error('Error denying user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
