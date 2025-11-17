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
const providersCtrl = require('./controllers/providers');
const availabilityCtrl = require('./controllers/availability');

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
// Health check
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'PearlConnect API is running' });
});

// Public
app.use('/auth', authCtrl);
app.use('/services', servicesCtrl);
app.use('/categories', categoriesCtrl); // Public - anyone can view categories

// Protected Routes - apply verifyToken middleware only to these
app.use('/users', verifyToken, usersCtrl);
app.use('/message', verifyToken, messageCtrl);
app.use('/reviews', verifyToken, reviewsCtrl);
app.use('/bookings', verifyToken, bookingsCtrl);
app.use('/providers', verifyToken, providersCtrl);
app.use('/availability', verifyToken, availabilityCtrl);

// Quick fix for frontend calling /my-bookings instead of /bookings/my-bookings
app.get('/my-bookings', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Only allow customers or admins
    if (!['customer', 'admin'].includes(userRole)) {
      return res.status(403).json({ err: 'Access denied' });
    }

    const Booking = require('./models/booking');
    const bookings = await Booking.find({ customerId: userId })
      .populate('serviceId', 'title price')
      .populate('customerId', 'name email')
      .populate('providerId', 'name email')
      .sort({ createdAt: -1 });

    return res.json(bookings);
  } catch (err) {
    return res.status(500).json({ err: 'Failed to fetch bookings' });
  }
});

// Quick fix for frontend calling /provider-bookings instead of /bookings/provider-bookings
app.get('/provider-bookings', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    console.log(`DEBUG: GET /provider-bookings called by user ${userId} with role '${userRole}'`);

    // Only allow providers or admins
    if (userRole !== 'provider' && userRole !== 'admin') {
      return res.status(403).json({ err: 'Access denied' });
    }

    const Booking = require('./models/booking');
    const bookings = await Booking.find({ providerId: userId })
      .populate('serviceId', 'title price')
      .populate('customerId', 'name email')
      .populate('providerId', 'name email')
      .sort({ createdAt: -1 });

    return res.json(bookings);
  } catch (err) {
    return res.status(500).json({ err: 'Failed to fetch bookings' });
  }
});

// Quick fix for frontend calling /provider-reviews instead of /reviews/provider-reviews
app.get('/provider-reviews', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Only allow providers or admins
    if (userRole !== 'provider' && userRole !== 'admin') {
      return res.status(403).json({ err: 'Access denied' });
    }

    const Review = require('./models/reviews');
    const reviews = await Review.find({ providerId: userId })
      .populate('reviewerId', 'name')
      .populate('serviceId', 'title')
      .populate('bookingId')
      .sort({ createdAt: -1 });

    return res.json(reviews);
  } catch (err) {
    return res.status(500).json({ err: 'Failed to fetch reviews' });
  }
});

app.use(cors({
  origin: [
    'hhttps://pearlconnect-front-end.vercel.app/', 
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true
}));

// Initialize Socket.IO
const io = initializeSocket(server);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PearlConnect server running on port ${PORT}`);
});
