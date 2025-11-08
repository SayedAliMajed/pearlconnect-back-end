const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/user.js');

const router = express.Router();

router.post('/sign-up', async (req, res) => {
  try {
    // Check if username already exists
    const userInDatabase = await User.findOne({ username: req.body.username });

    if (userInDatabase) {
      return res.status(409).json({
        err: 'Username already exists',
      });
    }

    // Check if email already exists
    const emailInDatabase = await User.findOne({ email: req.body.email });
    if (emailInDatabase) {
      return res.status(409).json({
        err: 'Email already exists',
      });
    }

    // Validate required fields
    if (!req.body.username || !req.body.email || !req.body.password || !req.body.role) {
      return res.status(400).json({
        err: 'Username, email, password, and role are required',
      });
    }

    // Validate role
    if (!['customer', 'provider', 'admin'].includes(req.body.role)) {
      return res.status(400).json({
        err: 'Role must be customer, provider, or admin',
      });
    }

    const hashedPassword = bcrypt.hashSync(req.body.password, 10);
    const userData = {
      username: req.body.username,
      email: req.body.email,
      hashedPassword: hashedPassword,
      role: req.body.role,
      profile: req.body.profile || {}
    };

    const newUser = await User.create(userData);

    const payload = {
      username: newUser.username,
      _id: newUser._id,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET);

    res.status(201).json({ token, user: newUser });
  } catch (err) {
    console.log('Sign-up error:', err);
    
    // Handle specific validation errors
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

router.post('/sign-in', async (req, res) => {
  try {
    const userInDatabase = await User.findOne({ username: req.body.username });

    if (!userInDatabase) {
      return res.status(401).json({ err: 'Username or Password is invalid' });
    }

    const validPassword = bcrypt.compareSync(req.body.password, userInDatabase.hashedPassword);

    if (!validPassword) {
      return res.status(401).json({ err: 'Username or Password is invalid' });
    }

    const payload = {
      username: userInDatabase.username,
      _id: userInDatabase._id,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET);

    res.json({ token, user: userInDatabase });
  } catch (err) {
    console.log(err);
    res.status(500).json({ err: 'Invalid Username or Password' });
  }
});

module.exports = router;
