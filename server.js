const dotenv = require('dotenv');
const http = require('http');

dotenv.config();
const express = require('express');

const app = express();
const server = http.createServer(app); // Create HTTP server
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('morgan');

const PORT = process.env.PORT || 3000;

// Controllers
const authCtrl = require('./controllers/auth');
const usersCtrl = require('./controllers/users');
const servicesCtrl = require('./controllers/services');

// MiddleWare
const verifyToken = require('./middleware/verify-token.js');

// Socket.IO
const { initializeSocket } = require('./socket/socketHandler.js');

mongoose.connect(process.env.MONGODB_URI);

mongoose.connection.on('connected', () => {
  console.log(`Connected to MongoDB ${mongoose.connection.name}.`);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger('dev'));

// Routes
// Public
app.use('/auth', authCtrl);
app.use('/services', servicesCtrl);

// Protected Routes
app.use(verifyToken);
app.use('/users', usersCtrl);
app.use('/message', messageCtrl);
app.use('/categories', categoriesCtrl);
app.use('/reviews', reviewsCtrl);
app.use('/bookings', bookingsCtrl);


// Initialize Socket.IO
const io = initializeSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO is ready for real-time connections`);
});
