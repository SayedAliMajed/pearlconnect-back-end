const dotenv = require('dotenv');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('morgan');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Controller imports
const authCtrl = require('./controllers/auth');
const usersCtrl = require('./controllers/users');
const servicesCtrl = require('./controllers/services');
const messageCtrl = require('./controllers/message');
const categoriesCtrl = require('./controllers/categories');
const reviewsCtrl = require('./controllers/reviews');
const bookingsCtrl = require('./controllers/booking');
const providersCtrl = require('./controllers/providers');
const availabilityCtrl = require('./controllers/availability');

// Middleware
const verifyToken = require('./middleware/verify-token');
const { initializeSocket } = require('./socket/socketHandler.js');

// Database connection
mongoose.connect(process.env.MONGODB_URI).catch(err => {
  console.error('MongoDB connection failed:', err);
});

mongoose.connection.on('connected', () => {
  console.log(`Connected to MongoDB ${mongoose.connection.name}.`);
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Middleware setup - Production CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // For production, allow any origin starting with http/https
        // This allows any deployment domain while maintaining security
        const allowed = /^https?:\/\/.+$/.test(origin);
        if (allowed) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    : [
        'http://localhost:3000',
        'http://localhost:5173'
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

app.use(express.json());
app.use(logger('dev'));

app.use('/uploads', express.static('uploads', {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  }
}));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'PearlConnect API is running' });
});

// Routes
app.use('/auth', authCtrl);
app.use('/users', verifyToken, usersCtrl);
app.use('/message', verifyToken, messageCtrl);
app.use('/reviews', verifyToken, reviewsCtrl);
app.use('/bookings', verifyToken, bookingsCtrl);
app.use('/providers', verifyToken, providersCtrl);
app.use('/availability', verifyToken, availabilityCtrl);
app.use('/services', verifyToken, servicesCtrl);
app.use('/categories', verifyToken, categoriesCtrl);

// Socket.IO
const io = initializeSocket(server);

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PearlConnect server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Socket.IO enabled for real-time features`);
});
