const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

const router = express.Router();

// POST /sign-up - User registration
router.post('/sign-up', async (req, res) => {
  try {
    // Validate existing users
    const existingUser = await User.findOne({
      $or: [{ username: req.body.username }, { email: req.body.email }]
    });

    if (existingUser) {
      return res.status(409).json({ err: 'Username or email already exists' });
    }

    // Validate required fields
    const { username, email, password, role, profile } = req.body;
    if (!username || !email || !password || !role || !profile?.firstName || !profile?.lastName) {
      return res.status(400).json({ err: 'All required fields must be provided' });
    }

    if (!['customer', 'provider', 'admin'].includes(role)) {
      return res.status(400).json({ err: 'Invalid role' });
    }

    // Hash password and create user
    const hashedPassword = bcrypt.hashSync(password, 10);
    const userData = { username, email, hashedPassword, role, profile };

    const newUser = await User.create(userData);

    // Generate JWT token
    const payload = { username: newUser.username, _id: newUser._id, role: newUser.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET);

    res.status(201).json({ token, user: newUser });
  } catch (err) {
    console.error('Sign-up error:', err);

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

// POST /sign-in - User authentication
router.post('/sign-in', async (req, res) => {
  try {
    const userInDatabase = await User.findOne({ username: req.body.username });

    if (!userInDatabase) {
      return res.status(401).json({ err: 'Invalid credentials' });
    }

    const validPassword = bcrypt.compareSync(req.body.password, userInDatabase.hashedPassword);
    if (!validPassword) {
      return res.status(401).json({ err: 'Invalid credentials' });
    }

    const payload = { username: userInDatabase.username, _id: userInDatabase._id, role: userInDatabase.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET);

    res.json({ token, user: userInDatabase });
  } catch (err) {
    console.error(err);
    res.status(500).json({ err: 'Login failed' });
  }
});

// GET /users - List all users (admin only)
router.get('/users', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find({}, 'username email role profile createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments();

    const totalPages = Math.ceil(totalUsers / limit);

    res.status(200).json({
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

// GET /:id - Get specific user
router.get('/:id', verifyToken, async (req, res) => {
  try {
    // Users can only access their own data unless they are admin
    if (req.user._id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ err: 'Access denied' });
    }

    const user = await User.findById(req.params.id, 'username email role profile createdAt');
    if (!user) {
      return res.status(404).json({ err: 'User not found' });
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

// PUT/profile - Update user profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const allowedUpdates = ['profile'];
    const updates = {};

    // Only allow specific fields to be updated
    if (req.body.profile) {
      updates.profile = { ...req.body.profile };
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ err: 'Nothing to update' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ err: 'User not found' });
    }

    res.status(200).json({ 
      message: 'Profile updated successfully',
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

// PUT /change-password - Change user password
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        err: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        err: 'New password must be at least 6 characters long' 
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ err: 'User not found' });
    }

    // Verify current password
    const validPassword = bcrypt.compareSync(currentPassword, user.hashedPassword);
    if (!validPassword) {
      return res.status(401).json({ err: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
    
    // Update password
    user.hashedPassword = hashedNewPassword;
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ err: 'Failed to change password' });
  }
});

// DELETE /account - Delete user account
router.delete('/account', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ err: 'Password is required to delete account' });
    }

    // Get user with password
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ err: 'User not found' });
    }

    // Verify password
    const validPassword = bcrypt.compareSync(password, user.hashedPassword);
    if (!validPassword) {
      return res.status(401).json({ err: 'Password is incorrect' });
    }

    // Delete user account
    await User.findByIdAndDelete(req.user._id);

    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ err: 'Failed to delete account' });
  }
});

// GET /refresh-token - Refresh JWT token
router.get('/refresh-token', verifyToken, async (req, res) => {
  try {
    // Get fresh user data
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ err: 'User not found' });
    }

    const payload = {
      username: user.username,
      _id: user._id,
      role: user.role,
    };

    const newToken = jwt.sign(payload, process.env.JWT_SECRET);

    res.status(200).json({ 
      token: newToken,
      user: user 
    });
  } catch (err) {
    res.status(500).json({ err: 'Failed to refresh token' });
  }
});

module.exports = router;
