# 🌟 PearlConnect - Premium Service Marketplace Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20.19.3-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-lightgrey.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-blue.svg)](https://www.mongodb.com/atlas)
[![REST API](https://img.shields.io/badge/Messaging-REST--API-blue.svg)](https://restfulapi.net/)
[![JWT](https://img.shields.io/badge/JWT-Authentication-red.svg)](https://jwt.io/)

PearlConnect is a comprehensive, full-stack service marketplace platform that seamlessly connects customers with professional service providers. Built with modern technologies for scalability, secure messaging, and exceptional user experience.

![PearlConnect Banner](https://via.placeholder.com/800x400/4f46e5/ffffff?text=PearlConnect+-+Service+Marketplace)

## 📋 Table of Contents

- [✨ Features](#-features)
- [🚀 Quick Start](#-quick-start)
- [🏗️ Architecture](#-architecture)
- [🔧 API Endpoints](#-api-endpoints)
- [📊 Database Schema](#-database-schema)
- [🔐 Authentication](#-authentication)
- [🎨 Frontend Overview](#-frontend-overview)
- [🧪 Testing](#-testing)
- [📦 Deployment](#-deployment)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [📞 Support](#-support)

## ✨ Features

### 👥 **Multi-Role User Management**
- **Customer Accounts**: Browse, book, and review services
- **Provider Accounts**: Manage services, availability, and bookings
- **Admin Dashboard**: Full platform oversight and management
- **Secure JWT Authentication**: Industry-standard security practices
- **Profile Management**: Comprehensive user profiles with service-specific data

### 🛠️ **Service Provider Dashboard**
- **Complete Service Management**: Full CRUD operations with image uploads
- **Advanced Availability Scheduling**: Flexible time slot management (Monday-Friday 9AM-5PM)
- **Real-time Analytics**: Booking statistics, review metrics, and performance insights
- **Provider Verification**: Professional account management system

### 🛍️ **Customer Experience**
- **Intelligent Service Discovery**: Browse by category with advanced filtering
- **Real-time Booking System**: Instant time slot availability and reservation
- **Comprehensive Review System**: 5-star ratings and detailed feedback mechanism
- **Booking History**: Complete transaction and appointment management

### 💬 **RESTful Messaging System**
- **HTTP-based Messaging**: Secure message exchange between customers and providers
- **Conversation Management**: Organized conversations with unread count tracking
- **Message History**: Complete conversation history with threading support
- **Read Status Tracking**: Message delivery and read confirmation

### 📊 **Advanced Analytics & Reporting**
- **Provider Performance Metrics**: Comprehensive dashboard analytics
- **Customer Feedback Analysis**: Review aggregation and sentiment insights
- **Availability Optimization**: Smart scheduling recommendations and insights
- **Booking Trends**: Historical data and forecasting capabilities

## 🚀 Quick Start

### 🔧 Prerequisites

- **Node.js** 18.0+ and **npm** 8.0+
- **MongoDB Atlas** account (or local MongoDB 4.4+)
- **Git** for version control
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

### 📦 Installation & Setup

#### 1. **Clone the Repository**
```bash
git clone https://github.com/SayedAliMajed/pearlconnect-back-end.git
cd pearlconnect-back-end
```

#### 2. **Install Backend Dependencies**
```bash
npm install
```

#### 3. **Clone Frontend Repository**
```bash
cd ..
git clone https://github.com/SayedAliMajed/pearlconnect-frontend.git
cd pearlconnect-frontend
npm install
```

#### 4. **Environment Configuration**

**Backend Configuration (.env):**
```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/pearlconnect

# Authentication
JWT_SECRET=your_super_secure_jwt_secret_here_minimum_32_characters

# Server
PORT=3000
NODE_ENV=development

# CORS Origins
FRONTEND_URL=http://localhost:5173
PRODUCTION_URL=https://pearlconnect.netlify.app
```

**Frontend Configuration (.env):**
```env
VITE_API_URL=http://localhost:3000
```

#### 5. **Database Setup**

**Seed Initial Data:**
```bash
cd pearlconnect-back-end
node setup-availability.js    # Sets up provider availability
```

#### 6. **Start Development Servers**

**Terminal 1 - Backend:**
```bash
cd pearlconnect-back-end
npm start
```

**Terminal 2 - Frontend:**
```bash
cd pearlconnect-frontend
npm run dev
```

#### 7. **Access the Application**
- **📱 Frontend**: http://localhost:5173
- **🔗 Backend API**: http://localhost:3000
- **📊 API Documentation**: http://localhost:3000/api/docs (if implemented)

## 🏗️ Architecture

### 🛠️ Tech Stack

#### **Backend Stack:**
- **Runtime**: Node.js 20.19.3
- **Framework**: Express.js 4.x
- **Database**: MongoDB Atlas with Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **File Upload**: Multer with cloud storage
- **Validation**: Custom middleware with express-validator
- **Security**: Helmet, rate limiting, CORS protection

#### **Frontend Stack:**
- **Framework**: React 18.2.0 with Vite
- **Routing**: React Router DOM
- **State**: React Context API
- **Styling**: Tailwind CSS with custom components
- **HTTP Client**: Fetch API with custom service layer
- **Time/Date**: Custom utilities with Bahraini timezone support

### 📁 Project Structure

```
pearlconnect/
├── pearlconnect-back-end/
│   ├── controllers/          # 📡 API route handlers
│   │   ├── auth.js          # Authentication & authorization
│   │   ├── availability.js  # Provider scheduling
│   │   ├── booking.js       # Appointment management
│   │   ├── reviews.js       # Rating & feedback system
│   │   └── services.js      # Service CRUD operations
│   ├── middleware/          # 🛡️ Security & validation
│   │   ├── verify-token.js  # JWT authentication
│   │   └── checkRole.js     # Role-based access control
│   ├── models/              # 📊 Database schemas
│   │   ├── user.js          # User accounts & profiles
│   │   ├── availability.js  # Provider schedules
│   │   ├── booking.js       # Appointment bookings
│   │   └── reviews.js       # Customer feedback
│   ├── routes/              # 🛣️ API endpoints
│   ├── uploads/             # 📁 File storage
│   ├── server.js            # 🚀 Main application entry
│   └── package.json
├── pearlconnect-frontend/
│   ├── src/
│   │   ├── components/      # 🧩 Reusable UI components
│   │   ├── contexts/        # 🔄 State management
│   │   ├── pages/          # 📄 Application routes
│   │   ├── services/        # 🌐 API communication layer
│   │   └── utils/          # 🛠️ Helper functions
│   ├── public/             # 📦 Static assets
│   └── package.json
└── README.md
```

## 🔧 API Endpoints

### 🔐 Authentication Endpoints
```http
POST /auth/sign-up   # User registration
POST /auth/sign-in   # User login (returns JWT)
POST /auth/sign-out  # User logout
GET  /auth/verify    # Token verification
```

### 👤 User Management
```http
GET    /users            # List users (admin only)
GET    /users/:id        # Get user profile
PUT    /users/:id        # Update user profile
DELETE /users/:id        # Delete user account (admin only)
```

### 🛠️ Service Operations
```http
GET    /services                    # List all services
GET    /services/:id               # Get service details
POST   /services                   # Create new service (providers)
PUT    /services/:id               # Update service (owners)
DELETE /services/:id               # Delete service (owners)
GET    /services?provider=:id      # Get provider's services
```

### 📅 Booking & Availability
```http
GET    /availability/provider/:providerId                    # Get provider schedule
POST   /availability/provider/:providerId                    # Set provider availability
PUT    /availability/provider/:providerId                    # Update availability
DELETE /availability/provider/:providerId                    # Remove availability
GET    /availability/provider/:providerId/slots?date=YYYY-MM-DD  # Get time slots

GET    /bookings                     # User's bookings
GET    /bookings/:id                # Booking details
POST   /bookings                    # Create booking
PATCH  /bookings/:id                # Update booking status
DELETE /bookings/:id                # Cancel booking
```

### ⭐ Reviews System
```http
GET    /reviews                      # All reviews
GET    /reviews?serviceId=:id        # Service reviews
GET    /reviews?providerId=:id       # Provider reviews
GET    /reviews/:id                  # Review details
POST   /reviews                      # Submit review
PUT    /reviews/:id                  # Update review (owner only)
DELETE /reviews/:id                  # Delete review (admin)
```

### 📂 Categories & Messaging
```http
GET    /categories                   # Service categories
GET    /message/conversations/:userId  # User conversations
POST   /message                      # Send message
```

## 📊 Database Schema

### 🧑‍💻 User Schema
```javascript
{
  _id: ObjectId,
  username: String (unique),
  email: String (unique),
  password: String (hashed),
  role: ['customer' | 'provider' | 'admin'],
  profile: {
    firstName: String,
    lastName: String,
    phone: String (optional),
    address: String (optional)
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 🔧 Service Schema
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  price: Number,
  currency: String (default: 'BD'),
  category: ObjectId (ref: Category),
  provider: ObjectId (ref: User),
  images: [{
    url: String,
    alt: String,
    _id: ObjectId
  }],
  duration: Number, // in minutes
  status: ['active' | 'inactive'],
  createdAt: Date,
  updatedAt: Date
}
```

### 📅 Availability Schema
```javascript
{
  _id: ObjectId,
  providerId: ObjectId (ref: User),
  schedules: [{
    dayOfWeek: Number (0-6), // Sunday = 0
    startTime: String,       // "09:00 AM"
    endTime: String,         // "05:00 PM"
    slotDuration: Number,    // minutes (60)
    bufferTime: Number,      // minutes (15)
    breakTimes: [{}],        // lunch breaks
    isEnabled: Boolean
  }],
  exceptions: [{             // special dates
    date: Date,
    customStartTime: String,
    customEndTime: String,
    isAvailable: Boolean,
    reason: String
  }],
  timezone: String (default: 'Asia/Bahrain'),
  advanceBookingDays: Number (default: 30)
}
```

### 🎫 Booking Schema
```javascript
{
  _id: ObjectId,
  serviceId: ObjectId (ref: Service),
  customerId: ObjectId (ref: User),
  providerId: ObjectId (ref: User),
  date: Date,
  timeSlot: String,           // "9:00 AM"
  notes: String (optional),
  status: ['pending' | 'confirmed' | 'completed' | 'cancelled'],
  bookingId: String (unique),
  createdAt: Date,
  updatedAt: Date
}
```

### ⭐ Reviews Schema
```javascript
{
  _id: ObjectId,
  customerId: ObjectId (ref: User),
  providerId: ObjectId (ref: User),
  serviceId: ObjectId (ref: Service),
  rating: Number (1-5),
  comment: String,
  bookingId: ObjectId (ref: Booking, optional),
  createdAt: Date,
  updatedAt: Date
}
```

## 🔐 Authentication & Security

### 🔑 JWT Authentication Flow
1. **Registration**: User submits credentials → Server validates → JWT token issued
2. **Login**: Credentials verified → User data returned with JWT
3. **Protected Routes**: JWT required in Authorization header
4. **Token Verification**: Middleware validates JWT on each request

### 🛡️ Security Features
- **Password Hashing**: bcrypt with salt rounds
- **CORS Protection**: Restricted origins for API access
- **Input Validation**: Sanitization and type checking
- **Rate Limiting**: Prevents brute force attacks
- **SQL Injection Protection**: Mongoose ODM prevents NoSQL injection

## 🎨 Frontend Overview

The frontend is built with modern React patterns and includes:

- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Component Architecture**: Reusable UI components library
- **Context Management**: Global state for authentication and user data
- **Form Validation**: Client-side validation with error handling
- **Loading States**: User feedback during API calls and transitions

## 🧪 Testing

### Running Tests
```bash
# Backend tests
cd pearlconnect-back-end
npm test

# Frontend tests
cd pearlconnect-frontend
npm test
```

### Manual Testing Checklist
- [ ] User registration and authentication
- [ ] Provider dashboard and service creation
- [ ] Service browsing and filtering
- [ ] Booking system and availability
- [ ] Review submission and display
- [ ] REST API messaging system

## 📦 Deployment

### 🚀 Production Deployment

#### Frontend (Netlify)
```bash
# Build for production
npm run build

# Deploy to Netlify
netlify deploy --prod
```

#### Backend (Heroku/Railway)
```bash
# Environment setup
NODE_ENV=production
MONGO_URI=your_production_mongo_uri
JWT_SECRET=your_production_jwt_secret

# Build and deploy
npm run build
# Deploy to your chosen platform
```

### 🔄 CI/CD Pipeline
- **Automated Testing**: GitHub Actions for unit tests
- **Staging Deployment**: Automatic deployment to staging on PR
- **Production Deployment**: Manual approval required for production

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### 📋 Contribution Guidelines
- Follow existing code style and patterns
- Write comprehensive tests for new features
- Update documentation for API changes
- Ensure backward compatibility
- Test across different browsers/devices

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```text
MIT License

Copyright (c) 2025 PearlConnect Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

## 📞 Support

### 🐛 Bug Reports & Issues
- **GitHub Issues**: [Create an issue](https://github.com/SayedAliMajed/pearlconnect-back-end/issues)
- **Bug Template**: Use the bug report template
- **Screenshots**: Include screenshots for UI-related issues

### 💬 Feature Requests
- **GitHub Issues**: [Create a feature request](https://github.com/SayedAliMajed/pearlconnect-back-end/issues)
- **Feature Template**: Use the feature request template
- **Discussion**: Start a discussion for big changes

### 📧 Contact Information
- **Project Owner**: [Sayed Ali Majed]
// - **Email**: contact@pearlconnect.com
- **LinkedIn**: [Project Team](https://linkedin.com/company/pearlconnect)
- **Twitter**: [@PearlConnect](https://twitter.com/PearlConnect)

## � Contributors

### Core Team
- [Sayed Ali Majed](https://github.com/SayedAliMajed) - Project Lead & Full-Stack Developer
- Mohammed AlHamar - Classmate & Team Contributor
- Yaseen Alzeiny - Classmate & Team Contributor

### Acknowledgments

- **React Team** for the amazing frontend framework
- **Express.js Community** for the robust backend framework
- **MongoDB Atlas** for reliable database services

- **Vite Team** for lightning-fast development experience

---

## 🌐 Live Demo

Experience PearlConnect live:
- **🌍 Production**: [https://pearlconnect.netlify.app](https://pearlconnect.netlify.app)
- **📊 API**: [https://api.pearlconnect.com](https://api.pearlconnect.com)

## 🚀 Future Roadmap

- [ ] **Mobile App**: React Native implementation
- [ ] **Payment Integration**: Stripe/PayPal integration
- [ ] **Advanced Analytics**: ML-powered insights
- [ ] **Video Calls**: Built-in consultation feature
- [ ] **Multi-language**: Internationalization support
- [ ] **Premium Features**: Subscription model for providers

---

<div align="center">

**Made with ❤️ by the PearlConnect Team**

⭐ **Star us on GitHub** | 🐛 **Report Issues** | 💡 **Request Features**
