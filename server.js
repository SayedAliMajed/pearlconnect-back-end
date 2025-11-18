/**
 * @fileoverview PearlConnect Backend Server
 * Main Express.js server file for the service marketplace API.
 */

// Environment variable configuration
const dotenv = require('dotenv');
const http = require('http');

dotenv.config();

// Core dependencies
const express = require('express');
const app = express();
const server = http.createServer(app); // HTTP server for Express and Socket.IO
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('morgan');

// Server configuration
const PORT = process.env.PORT || 3000;

// =============================================================================
// CONTROLLERS - Route handlers for different API endpoints
// =============================================================================

/**
 * Controller modules that handle HTTP requests for specific resources.
 * Each controller contains middleware functions for various CRUD operations.
 */
const authCtrl = require('./controllers/auth');          // User authentication (login/logout/signup)
const usersCtrl = require('./controllers/users');        // User management (profile updates)
const servicesCtrl = require('./controllers/services');  // Service CRUD operations
const messageCtrl = require('./controllers/message');    // Chat messaging system
const categoriesCtrl = require('./controllers/categories'); // Service categories
const reviewsCtrl = require('./controllers/reviews');    // Customer reviews for services
const bookingsCtrl = require('./controllers/booking');   // Customer bookings and appointments
const providersCtrl = require('./controllers/providers'); // Provider-specific operations
const availabilityCtrl = require('./controllers/availability'); // Provider availability schedules

// =============================================================================
// MIDDLEWARE - Request processing pipeline components
// =============================================================================

/**
 * Custom middleware for request authentication and authorization.
 * verifyToken - Validates JWT tokens and attaches user data to request object
 */
const verifyToken = require('./middleware/verify-token');

// =============================================================================
// SOCKET.IO - Real-time communication setup
// =============================================================================

/**
 * Socket.IO initialization for real-time messaging and notifications.
 * Handles WebSocket connections for live chat, booking updates, etc.
 */
const { initializeSocket } = require('./socket/socketHandler.js');

// =============================================================================
// DATABASE CONNECTION - MongoDB setup
// =============================================================================

/**
 * Establish connection to MongoDB database using Mongoose ODM.
 * Uses connection string from environment variables for security.
 */
mongoose.connect(process.env.MONGODB_URI);

/**
 * Database connection event listeners for monitoring connection status.
 */
mongoose.connection.on('connected', () => {
  console.log(`Connected to MongoDB ${mongoose.connection.name}.`);
});

// =============================================================================
// EXPRESS MIDDLEWARE SETUP - Request processing pipeline
// =============================================================================

/**
 * Global middleware applied to all routes in order.
 * - cors: Enables cross-origin requests from frontend
 * - express.json: Parses JSON request bodies
 * - logger: Logs HTTP requests for debugging (Morgan)
 */
app.use(cors());                    // Enable CORS for frontend requests
app.use(express.json());            // Parse incoming JSON payloads
app.use(logger('dev'));             // HTTP request logging

// =============================================================================
// API ROUTES - URL endpoint definitions
// =============================================================================

/**
 * Basic health check endpoint for monitoring and load balancer probes.
 * Returns JSON status to verify server is running properly.
 */
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'PearlConnect API is running' });
});

/**
 * Public routes - no authentication required
 */
app.use('/auth', authCtrl);  // Authentication endpoints (login, signup, logout)

/**
 * Private routes - authentication required
 */
app.use('/users', verifyToken, usersCtrl);           // User profile management
app.use('/message', verifyToken, messageCtrl);       // Real-time messaging
app.use('/reviews', verifyToken, reviewsCtrl);       // Customer reviews
app.use('/bookings', verifyToken, bookingsCtrl);     // Booking operations
app.use('/providers', verifyToken, providersCtrl);   // Provider dashboard functions
app.use('/availability', verifyToken, availabilityCtrl); // Provider availability schedules
app.use('/services', verifyToken, servicesCtrl);      // Service listings and management
app.use('/categories', verifyToken, categoriesCtrl);  // Service categories


// =============================================================================
// CORS CONFIGURATION - Frontend communication setup
// =============================================================================

/**
 * Cross-Origin Resource Sharing (CORS) configuration for secure frontend communication.
 * Allows requests from specified origins and enables credentials (cookies/JWT).
 *
 * Origins:
 * - Production frontend on Netlify
 * - Local development environments
 */
app.use(cors({
  origin: [
    'https://pearlconnect.netlify.app/',           // Production frontend on Netlify
    'http://localhost:3000',                        // Local API proxy
    'http://localhost:5173'                         // Vite dev server
  ],
  credentials: true                                // Allow cookies/auth headers
}));

// =============================================================================
// SOCKET.IO INITIALIZATION - Real-time communication setup
// =============================================================================

/**
 * Initialize Socket.IO for real-time bidirectional communication.
 * Enables features like:
 * - Live chat messaging between customers and providers
 * - Real-time booking status updates
 * - Notification system
 * - Live availability updates
 */
const io = initializeSocket(server);

// =============================================================================
// SERVER STARTUP - Application bootstrap
// =============================================================================

/**
 * Start the HTTP server with Socket.IO support.
 * Listens on all network interfaces (0.0.0.0) for Docker/container compatibility.
 * Uses environment variable PORT or defaults to 3000.
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PearlConnect server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Socket.IO enabled for real-time features`);
});
