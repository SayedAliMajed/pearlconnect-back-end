const jwt = require('jsonwebtoken');
const User = require('../models/user');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch full user details from database
    const user = await User.findById(payload._id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      profile: user.profile
    };

    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = verifyToken;
