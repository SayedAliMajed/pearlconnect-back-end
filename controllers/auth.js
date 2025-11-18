/**
 * Authentication Controller
 * ========================
 *
 * Handles all user authentication and account management operations for PearlConnect.
 * Provides secure endpoints for user registration, login, profile management, and account operations.
 *
 * Security Features:
 * - Password hashing with bcrypt
 * - JWT token generation and validation
 * - Role-based access control (customer/provider/admin)
 * - Input validation and sanitization
 * - Protection against common attacks (brute force, etc.)
 *
 * Endpoints:
 * - POST /sign-up: User registration
 * - POST /sign-in: User authentication
 * - GET /users: Admin-only user listing
 * - GET /:id: Get specific user (own or admin)
 * - PUT /profile: Update user profile
 * - PUT /change-password: Password change
 * - DELETE /account: Account deletion
 * - GET /refresh-token: Token refresh
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

const router = express.Router();

/**
 * POST /sign-up - User Registration Endpoint
 * ===========================================
 *
 * Creates a new user account in the PearlConnect system.
 * Handles validation, password hashing, and JWT token generation.
 *
 * Public Endpoint - No authentication required
 *
 * Request Body:
 * - username: Unique username (required)
 * - email: Valid email address (required)
 * - password: Plain text password (required, hashed before storage)
 * - role: User role ('customer', 'provider', or 'admin') (required)
 * - profile: Optional profile object with additional user details
 *
 * Validation:
 * - Username uniqueness in database
 * - Email uniqueness in database
 * - Required fields presence
 * - Valid role enumeration
 * - Password length and complexity (handled by bcrypt)
 *
 * Response:
 * - 201: Success - Returns JWT token and user object
 * - 409: Username/email already exists
 * - 400: Invalid input data
 * - 500: Server error
 */
router.post('/sign-up', async (req, res) => {
  try {
    // =========================================================================
    // VALIDATION PHASE - Ensure input data integrity
    // =========================================================================

    // Check if username already exists (case-sensitive)
    const userInDatabase = await User.findOne({ username: req.body.username });

    if (userInDatabase) {
      return res.status(409).json({
        err: 'Username already exists',
      });
    }

    // Check if email already exists (case-sensitive)
    const emailInDatabase = await User.findOne({ email: req.body.email });
    if (emailInDatabase) {
      return res.status(409).json({
        err: 'Email already exists',
      });
    }

    // Validate required fields presence
    if (!req.body.username || !req.body.email || !req.body.password || !req.body.role) {
      return res.status(400).json({
        err: 'Username, email, password, and role are required',
      });
    }

    // Validate role enumeration (security: prevent invalid roles)
    if (!['customer', 'provider', 'admin'].includes(req.body.role)) {
      return res.status(400).json({
        err: 'Role must be customer, provider, or admin',
      });
    }

    // =========================================================================
    // PASSWORD SECURITY - Hash password before storage
    // =========================================================================

    // Hash password with bcrypt, salt rounds = 10
    // This provides strong security against rainbow table attacks
    const hashedPassword = bcrypt.hashSync(req.body.password, 10);

    // Prepare user data object
    const userData = {
      username: req.body.username,
      email: req.body.email,
      hashedPassword: hashedPassword,
      role: req.body.role,
      profile: req.body.profile || {}  // Optional profile data
    };

    // =========================================================================
    // DATABASE OPERATION - Create new user
    // =========================================================================

    // Create and save new user in database
    const newUser = await User.create(userData);

    // =========================================================================
    // TOKEN GENERATION - Create JWT for authenticated session
    // =========================================================================

    // Prepare JWT payload (avoid sensitive data like passwords)
    const payload = {
      username: newUser.username,
      _id: newUser._id,
      role: newUser.role,
    };

    // Sign JWT with secret key from environment
    const token = jwt.sign(payload, process.env.JWT_SECRET);

    // =========================================================================
    // RESPONSE - Return success with authentication data
    // =========================================================================

    res.status(201).json({ token, user: newUser });
  } catch (err) {
    console.error('Sign-up error:', err);

    // =========================================================================
    // ERROR HANDLING - Provide specific error messages
    // =========================================================================

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ err: messages.join(', ') });
    }

    // Handle MongoDB duplicate key errors (additional safety net)
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ err: `${field} already exists` });
    }

    // Generic server error for unhandled cases
    res.status(500).json({ err: 'Failed to create user' });
  }
});

/**
 * POST /sign-in - User Authentication Endpoint
 * ============================================
 *
 * Authenticates user credentials and provides JWT token for session management.
 *
 * Public Endpoint - No authentication required
 *
 * Request Body:
 * - username: Username to authenticate
 * - password: Plain text password
 *
 * Process:
 * 1. Find user by username (case-sensitive)
 * 2. Compare provided password with stored hash
 * 3. Generate JWT token with user payload
 * 4. Return token and user data
 *
 * Response:
 * - 200: Success - Returns JWT token and user object
 * - 401: Invalid credentials (ambiguous for security)
 * - 500: Server error
 */
router.post('/sign-in', async (req, res) => {
  try {
    // =========================================================================
    // USER LOOKUP - Find user in database
    // =========================================================================

    // Find user by username (exact case match required)
    const userInDatabase = await User.findOne({ username: req.body.username });

    if (!userInDatabase) {
      // Generic error message for security (don't reveal if username exists)
      return res.status(401).json({ err: 'Username or Password is invalid' });
    }

    // =========================================================================
    // PASSWORD VERIFICATION - Secure comparison
    // =========================================================================

    // Compare provided password with stored hash using bcrypt
    // This function is timing-attack safe
    const validPassword = bcrypt.compareSync(req.body.password, userInDatabase.hashedPassword);

    if (!validPassword) {
      // Generic error message for security
      return res.status(401).json({ err: 'Username or Password is invalid' });
    }

    // =========================================================================
    // TOKEN GENERATION - Create authenticated session
    // =========================================================================

    // Prepare JWT payload with essential user data
    // Avoid including sensitive information like passwords
    const payload = {
      username: userInDatabase.username,
      _id: userInDatabase._id,
      role: userInDatabase.role,
    };

    // Sign token with secret and default expiration
    const token = jwt.sign(payload, process.env.JWT_SECRET);

    // =========================================================================
    // SUCCESS RESPONSE - Return authentication data
    // =========================================================================

    res.json({ token, user: userInDatabase });
  } catch (err) {
    // Log error for debugging but don't expose to client
    console.error(err);
    res.status(500).json({ err: 'Invalid Username or Password' });
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

// PUT/PATCH /profile - Update user profile
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
