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
const messageCtrl = require('./controllers/message');
const categoriesCtrl = require('./controllers/categories');
const reviewsCtrl = require('./controllers/reviews');
const bookingsCtrl = require('./controllers/booking');

// MiddleWare
const verifyToken = require('./middleware/verify-token');

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

// Protected Routes - apply verifyToken middleware only to these
app.use('/users', verifyToken, usersCtrl);
app.use('/message', verifyToken, messageCtrl);
app.use('/categories', verifyToken, categoriesCtrl);
app.use('/reviews', verifyToken, reviewsCtrl);
app.use('/bookings', verifyToken, bookingsCtrl);


// Initialize Socket.IO
const io = initializeSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO is ready for real-time connections`);
});
