const express = require('express');
const User = require('../models/user');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');
const bcrypt = require('bcrypt');

const router = express.Router();

// GET / - Get a list of all users (with auth token)
router.get('/', verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const role = req.query.role; // Filter by role if provided

    // Build query
    let query = {};
    if (role && ['customer', 'provider', 'admin'].includes(role)) {
      query.role = role;
    }

    const users = await User.find(query, 'username email role profile createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

// GET /current-user - Get current authenticated user
router.get('/current-user', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ err: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

// GET /:id - Get specific user
router.get('/:id', verifyToken, async (req, res) => {
  try {
    // Users can only access their own data unless they are admin
    if (req.user._id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ err: 'Access denied' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ err: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

// POST / - Create new user (admin only)
router.post('/', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const { username, email, password, role, profile } = req.body;

    // Validate required fields
    if (!username || !email || !password || !role) {
      return res.status(400).json({
        err: 'Username, email, password, and role are required',
      });
    }

    // Validate role
    if (!['customer', 'provider', 'admin'].includes(role)) {
      return res.status(400).json({
        err: 'Role must be customer, provider, or admin',
      });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ err: 'Username already exists' });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ err: 'Email already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userData = {
      username,
      email,
      hashedPassword,
      role,
      profile: profile || {}
    };

    const newUser = await User.create(userData);

    // Return user data without password
    const userResponse = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      profile: newUser.profile,
      createdAt: newUser.createdAt
    };

    res.status(201).json(userResponse);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ err: messages.join(', ') });
    }
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ err: `${field} already exists` });
    }
    res.status(500).json({ err: 'Failed to create user' });
  }
});

// PUT/PATCH /:id - Update user (admin or owner)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { username, email, role, profile, password } = req.body;

    // Check if user can update (admin or owner)
    if (req.user._id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ err: 'Access denied' });
    }

    // Only admin can change role
    if (role && req.user.role !== 'admin') {
      return res.status(403).json({ err: 'Only admin can change user role' });
    }

    // Validate role if provided
    if (role && !['customer', 'provider', 'admin'].includes(role)) {
      return res.status(400).json({ err: 'Role must be customer, provider, or admin' });
    }

    // Build update object
    const updates = {};
    if (username) updates.username = username;
    if (email) updates.email = email;
    if (role) updates.role = role;
    if (profile) updates.profile = { ...profile };
    if (password) {
      updates.hashedPassword = bcrypt.hashSync(password, 10);
    }

    // Check for unique constraints
    if (username) {
      const existingUsername = await User.findOne({ 
        username, 
        _id: { $ne: req.params.id } 
      });
      if (existingUsername) {
        return res.status(409).json({ err: 'Username already exists' });
      }
    }

    if (email) {
      const existingEmail = await User.findOne({ 
        email, 
        _id: { $ne: req.params.id } 
      });
      if (existingEmail) {
        return res.status(409).json({ err: 'Email already exists' });
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ err: 'Nothing to update' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ err: 'User not found' });
    }

    res.status(200).json({ 
      message: 'User updated successfully',
      user: updatedUser 
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ err: messages.join(', ') });
    }
    res.status(500).json({ err: err.message });
  }
});

// DELETE /:id - Delete user (admin only)
router.delete('/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.user._id === req.params.id) {
      return res.status(400).json({ err: 'Cannot delete your own account' });
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id);
    
    if (!deletedUser) {
      return res.status(404).json({ err: 'User not found' });
    }

    res.status(200).json({ 
      message: 'User deleted successfully',
      user: {
        _id: deletedUser._id,
        username: deletedUser.username,
        email: deletedUser.email,
        role: deletedUser.role
      }
    });
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

module.exports = router;
