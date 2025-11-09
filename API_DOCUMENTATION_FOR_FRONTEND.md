# PearlConnect Backend API Documentation
## Complete Guide for Frontend Development

### 📋 **Table of Contents**
1. [Server Configuration](#server-configuration)
2. [Authentication System](#authentication-system)
3. [Database Models](#database-models)
4. [API Endpoints](#api-endpoints)
5. [Real-time Features](#real-time-features)
6. [Missing Controllers](#missing-controllers)
7. [Frontend Integration Guide](#frontend-integration-guide)
8. [Error Handling](#error-handling)

---

## 🚀 **Server Configuration**

### **Base Information**
- **Base URL**: `http://localhost:3000`
- **Database**: MongoDB
- **Authentication**: JWT Token (Bearer)
- **Real-time**: Socket.IO integration
- **CORS**: Enabled for cross-origin requests

### **Server Setup**
```javascript
// Environment Variables Required
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
```

### **Middleware Stack**
- **CORS**: Cross-origin resource sharing enabled
- **Express.json()**: Parse JSON request bodies
- **Logger**: Development request logging
- **verifyToken**: JWT authentication middleware

---

## 🔐 **Authentication System**

### **Authentication Flow**
1. User registers/logs in through `/auth/sign-up` or `/auth/sign-in`
2. Server returns JWT token and user data
3. Frontend stores token for subsequent requests
4. Token is sent in Authorization header: `Bearer <token>`

### **Roles & Permissions**
- **customer**: Regular user, can create bookings, reviews, messages
- **provider**: Service provider, can manage services, receive bookings
- **admin**: Administrator, full access to all endpoints

---

## 💾 **Database Models**

### **User Model** (`models/user.js`)
```javascript
{
  _id: ObjectId,
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  hashedPassword: { type: String, required: true },
  role: { type: String, enum: ["customer", "provider", "admin"], required: true },
  profile: {
    fullName: { type: String },
    phone: { type: String },
    address: { type: String }
  },
  createdAt: Date,
  updatedAt: Date
}
```

### **Category Model** (`models/category.js`)
```javascript
{
  _id: ObjectId,
  name: { 
    type: String, 
    enum: ["Plumbing", "Tutoring", "Cleaning", "Repair", "Landscaping", "Painting", "Electrician"],
    required: true 
  },
  createdAt: Date,
  updatedAt: Date
}
```

### **Service Model** (`models/services.js`)
```javascript
{
  _id: ObjectId,
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: ObjectId, ref: "Category" },
  provider: { type: ObjectId, ref: "User", required: true },
  images: [{
    url: { type: String, required: true },
    alt: { type: String }
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### **Booking Model** (`models/booking.js`)
```javascript
{
  _id: ObjectId,
  serviceId: { type: ObjectId, ref: "Service", required: true },
  customerId: { type: ObjectId, ref: "User", required: true },
  providerId: { type: ObjectId, ref: "User", required: true },
  date: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ["pending", "confirmed", "completed", "cancelled"],
    default: "pending" 
  },
  messages: { type: ObjectId, ref: "Message" },
  createdAt: Date,
  updatedAt: Date
}
```

### **Message Model** (`models/message.js`)
```javascript
{
  _id: ObjectId,
  senderId: { type: ObjectId, ref: "User", required: true },
  receiverId: { type: ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  read: { type: Boolean, default: false },
  sentAt: Date,
  updatedAt: Date
}
```

### **Review Model** (`models/reviews.js`)
```javascript
{
  _id: ObjectId,
  bookingId: { type: ObjectId, ref: "Booking", required: true },
  reviewerId: { type: ObjectId, ref: "User", required: true },
  providerId: { type: ObjectId, ref: "User", required: true },
  serviceId: { type: ObjectId, ref: "Service", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  createdAt: Date,
  updatedAt: Date
}
```

---

## 📡 **API Endpoints**

## **🔓 Public Routes (No Authentication)**

### **Authentication**
| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|-----------|
| POST | `/auth/sign-up` | Register new user | `{username, email, password, role, profile}` | `{token, user}` |
| POST | `/auth/sign-in` | User login | `{username, password}` | `{token, user}` |

---

## **🔒 Protected Routes (Authentication Required)**

### **User Management**
| Method | Endpoint | Description | Access | Request Body | Response |
|--------|----------|-------------|--------|--------------|-----------|
| GET | `/users` | List all users | Admin only | `?page=1&limit=20&role=customer` | `{users, pagination}` |
| GET | `/users/current-user` | Get current user | Authenticated | - | `{user}` |
| GET | `/users/:id` | Get specific user | Owner/Admin | - | `{user}` |
| POST | `/users` | Create new user | Admin only | `{username, email, password, role, profile}` | `{user}` |
| PUT | `/users/:id` | Update user | Owner/Admin | `{username, email, role?, profile?, password?}` | `{user}` |
| DELETE | `/users/:id` | Delete user | Admin only | - | `{message, user}` |

### **Auth Extended**
| Method | Endpoint | Description | Access | Request Body | Response |
|--------|----------|-------------|--------|--------------|-----------|
| GET | `/auth/users` | List all users | Admin only | `?page=1&limit=20` | `{users, pagination}` |
| GET | `/auth/:id` | Get specific user | Owner/Admin | - | `{user}` |
| PUT | `/auth/profile` | Update own profile | Authenticated | `{profile: {fullName, phone, address}}` | `{message, user}` |
| PUT | `/auth/change-password` | Change password | Authenticated | `{currentPassword, newPassword}` | `{message}` |
| DELETE | `/auth/account` | Delete own account | Authenticated | `{password}` | `{message}` |
| GET | `/auth/refresh-token` | Refresh JWT token | Authenticated | - | `{token, user}` |

### **Categories**
| Method | Endpoint | Description | Access | Request Body | Response |
|--------|----------|-------------|--------|--------------|-----------|
| GET | `/categories` | List all categories | Public | - | `[categories]` |
| GET | `/categories/names` | Get category names | Public | - | `[categoryNames]` |
| GET | `/categories/:categoryId` | Get single category | Authenticated | - | `{category}` |
| POST | `/categories` | Create category | Admin only | `{name}` | `{category}` |
| PATCH | `/categories/:categoryId` | Update category | Admin only | `{name}` | `{category}` |
| DELETE | `/categories/:categoryId` | Delete category | Admin only | - | `{message}` |

### **Reviews**
| Method | Endpoint | Description | Access | Request Body | Response |
|--------|----------|-------------|--------|--------------|-----------|
| GET | `/reviews` | List all reviews | Public | - | `[reviews]` |
| GET | `/reviews/:reviewId` | Get single review | Public | - | `{review}` |
| POST | `/reviews` | Create review | Authenticated | `{bookingId, reviewerId, providerId, serviceId, rating, comment}` | `{review}` |
| PATCH | `/reviews/:reviewId` | Update review | Owner/Admin | `{rating?, comment?}` | `{review}` |
| DELETE | `/reviews/:reviewId` | Delete review | Admin only | - | `{message}` |

### **Messages**
| Method | Endpoint | Description | Access | Request Body | Response |
|--------|----------|-------------|--------|--------------|-----------|
| GET | `/message` | List user messages | Authenticated | `?page=1&limit=20` | `{messages, pagination}` |
| GET | `/message/:messageId` | Get single message | Authenticated | - | `{message}` |
| POST | `/message` | Send message | Authenticated | `{receiverId, content}` | `{message}` |
| DELETE | `/message/:messageId` | Delete message | Authenticated | - | `{message}` |
| PUT | `/message/:messageId/read` | Mark as read | Authenticated | - | `{message}` |
| GET | `/message/conversation/:userId` | Get conversation | Authenticated | `?page=1&limit=50` | `{conversation, otherUser, pagination}` |
| GET | `/message/conversations/list` | Get conversation list | Authenticated | - | `{conversations}` |
| GET | `/message/unread/count` | Get unread count | Authenticated | - | `{unreadCount}` |
| PUT | `/message/mark-read/:userId` | Mark all as read | Authenticated | - | `{message, modifiedCount}` |

---

## ⚡ **Real-time Features (Socket.IO)**

### **Socket.IO Configuration**
```javascript
// Connection
const socket = io('http://localhost:3000');

// Authentication
socket.emit('authenticate', { token: 'your-jwt-token' });

// Events to Listen For
socket.on('new_message', (data) => {
  // Handle new message received
});

socket.on('message_read', (data) => {
  // Handle message read status update
});

socket.on('booking_update', (data) => {
  // Handle booking status changes (when implemented)
});

// Events to Emit
socket.emit('send_message', {
  receiverId: 'user-id',
  content: 'message content'
});

socket.emit('mark_message_read', { messageId: 'message-id' });
```

### **Socket Events**
| Event | Direction | Data | Description |
|-------|-----------|------|-------------|
| `authenticate` | Client → Server | `{token}` | Authenticate socket connection |
| `new_message` | Server → Client | `{message}` | New message received |
| `message_read` | Server → Client | `{messageId, read}` | Message read status update |
| `send_message` | Client → Server | `{receiverId, content}` | Send new message |
| `mark_message_read` | Client → Server | `{messageId}` | Mark message as read |
| `disconnect` | Client → Server | - | User disconnected |

---

## 📋 **Missing Controllers**

### **Services Controller (Not Implemented)**
**Status**: Model ready, controller missing
**Required Endpoints**:
- GET `/services` - List all services (Public)
- GET `/services/:id` - Get single service (Public)
- POST `/services` - Create service (Provider/Admin)
- PUT `/services/:id` - Update service (Owner/Admin)
- DELETE `/services/:id` - Delete service (Owner/Admin)
- GET `/services/provider/:providerId` - Get services by provider (Public)

### **Bookings Controller (Not Implemented)**
**Status**: Model ready, controller missing
**Required Endpoints**:
- GET `/bookings` - List user bookings (Authenticated)
- GET `/bookings/:id` - Get single booking (Authenticated)
- POST `/bookings` - Create booking (Customer)
- PUT `/bookings/:id` - Update booking (Owner/Admin)
- DELETE `/bookings/:id` - Cancel booking (Owner/Admin)
- GET `/bookings/provider/:providerId` - Get provider bookings (Provider)

---

## 🎯 **Frontend Integration Guide**

### **Authentication Headers**
```javascript
// Store token after login/signup
localStorage.setItem('token', response.token);

// Add to all protected requests
const headers = {
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
};

// Axios example
axios.get('/users/current-user', { headers })
  .then(response => setUser(response.data))
  .catch(error => handleAuthError(error));
```

### **Role-Based Access Control**
```javascript
// Check user role
const hasAccess = (userRole, requiredRoles) => {
  return requiredRoles.includes(userRole);
};

// Usage examples
if (hasAccess(user.role, ['admin'])) {
  // Show admin controls
}

if (hasAccess(user.role, ['admin', 'provider'])) {
  // Show provider/admin controls
}
```

### **Pagination Handling**
```javascript
// Handle paginated responses
const handlePagination = (response) => {
  const { users, pagination } = response.data;
  setUsers(users);
  setPagination(pagination);
  setCurrentPage(pagination.currentPage);
  setTotalPages(pagination.totalPages);
};

// Load next/previous page
const loadPage = async (page) => {
  const response = await axios.get(`/users?page=${page}&limit=20`, { headers });
  handlePagination(response);
};
```

### **Error Handling Patterns**
```javascript
// Standard error response handling
const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    
    switch (status) {
      case 401:
        // Unauthorized - redirect to login
        localStorage.removeItem('token');
        window.location.href = '/login';
        break;
      case 403:
        // Forbidden - show access denied
        alert(data.err || 'Access denied');
        break;
      case 404:
        // Not found
        alert(data.err || 'Resource not found');
        break;
      case 409:
        // Conflict (e.g., duplicate username)
        alert(data.err || 'Resource already exists');
        break;
      default:
        alert(data.err || 'An error occurred');
    }
  } else if (error.request) {
    // Network error
    alert('Network error. Please check your connection.');
  }
};
```

### **Real-time Integration**
```javascript
// Setup Socket.IO connection
const [socket, setSocket] = useState(null);
const [messages, setMessages] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  const token = localStorage.getItem('token');
  if (token) {
    const newSocket = io('http://localhost:3000');
    
    newSocket.on('connect', () => {
      // Authenticate with token
      newSocket.emit('authenticate', { token });
    });
    
    newSocket.on('new_message', (message) => {
      setMessages(prev => [...prev, message]);
      setUnreadCount(prev => prev + 1);
    });
    
    newSocket.on('message_read', ({ messageId, read }) => {
      setMessages(prev => prev.map(msg => 
        msg._id === messageId ? { ...msg, read } : msg
      ));
    });
    
    setSocket(newSocket);
    
    return () => newSocket.close();
  }
}, []);

// Send message
const sendMessage = (receiverId, content) => {
  if (socket) {
    socket.emit('send_message', { receiverId, content });
  }
};
```

---

## ❌ **Error Handling**

### **Standard Error Response Format**
```json
{
  "err": "Error message describing the issue"
}
```

### **Common Error Codes**
- **400**: Bad Request - Invalid input data
- **401**: Unauthorized - Invalid or missing token
- **403**: Forbidden - Insufficient permissions
- **404**: Not Found - Resource doesn't exist
- **409**: Conflict - Resource already exists (e.g., duplicate username)
- **500**: Internal Server Error - Server-side error

### **Validation Errors**
```json
{
  "err": "Username, email, password, and role are required"
}
```

### **Authentication Errors**
```json
{
  "err": "Invalid token"
}
```

```json
{
  "err": "Access denied"
}
```

---

## 🚀 **Getting Started for Frontend**

### **Required Setup**
1. **Base URL**: `http://localhost:3000`
2. **Token Storage**: Use localStorage for JWT token
3. **Headers**: Always include `Authorization: Bearer <token>` for protected routes
4. **Socket Setup**: Initialize Socket.IO for real-time features

### **Core User Flows**
1. **User Registration/Login** → Store token → Make authenticated requests
2. **Role-based UI** → Check user.role for showing/hiding features
3. **Real-time Messaging** → Setup Socket.IO connection and event listeners
4. **Pagination** → Handle paginated responses for list views

### **Key Features to Implement**
- ✅ User authentication and authorization
- ✅ Role-based access control
- ✅ Real-time messaging
- ✅ Category management
- ✅ Review system
- ❌ Service management (controller missing)
- ❌ Booking system (controller missing)

---

*This documentation covers the complete PearlConnect backend API as of the current implementation. Missing controllers for Services and Bookings will need to be implemented for full functionality.*
