const dotenv = require('dotenv');

dotenv.config();
const express = require('express');

const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('morgan');

const PORT = process.env.PORT || 3000;

// Controllers
const authCtrl = require('./controllers/auth');
const usersCtrl = require('./controllers/users');

// MiddleWare
const verifyToken = require('./middleware/verify-token');

mongoose.connect(process.env.MONGODB_URI);

mongoose.connection.on('connected', () => {
  console.log(`Connected to MongoDB ${mongoose.connection.name}.`);
});

app.use(cors());
app.use(express.json());
app.use(logger('dev'));

// Public
app.use('/auth', authCtrl);

// Protected Routes
app.use(verifyToken);
app.use('/users', usersCtrl);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
