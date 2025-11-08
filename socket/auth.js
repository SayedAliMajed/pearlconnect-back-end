const jwt = require('jsonwebtoken');
const User = require('../models/user.js');

// Socket.IO Authentication Middleware
const authenticateSocket = async (socket, next) => {
  try {
    // Get token from socket handshake
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded._id);
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // Attach user info to socket
    socket.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.profile?.fullName || user.username
    };

    next();
  } catch (err) {
    console.error('Socket authentication error:', err.message);
    next(new Error('Authentication error: Invalid token'));
  }
};

module.exports = authenticateSocket;
