const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('morgan');

dotenv.config();

const app = express();
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

// Database connection
mongoose.connect(process.env.MONGODB_URI).catch(err => {
  console.error('MongoDB connection failed:', err);
});

mongoose.connection.on('connected', () => {
  // Connected to MongoDB
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  // MongoDB disconnected
});

// Middleware setup - Production CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Allow specific Vercel domain and localhost for testing
        const allowedOrigins = [
          'https://pearlconnect.vercel.app',
          'http://localhost:3000',
          'http://localhost:5173',
          'http://127.0.0.1:5173'
        ];

        if (allowedOrigins.includes(origin) || /^https?:\/\/.+$/.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173'
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

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, '0.0.0.0', () => {
  // Server started on port ${PORT}
  // Environment: ${process.env.NODE_ENV || 'development'}
  // REST API messaging system active
});
