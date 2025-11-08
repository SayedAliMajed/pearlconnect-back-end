# Socket.IO Real-Time Messaging API Documentation

## Overview
This backend provides comprehensive real-time messaging functionality through Socket.IO. The backend runs on the same server as the REST API, using the same port and authentication system.

## Connection Setup

### Connection URL
```
ws://your-backend-domain:3000
```

### Authentication
All Socket.IO connections require JWT authentication. Pass the token in the connection options:

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token-here'
  },
  transports: ['websocket', 'polling']
});
```

## Events Reference

### Connection Events

#### `connection`
**Direction:** Server → Client
**Description:** Fired when client successfully connects
**Payload:**
```javascript
{
  success: true,
  user: {
    _id: "userId",
    name: "User Name",
    username: "username"
  }
}
```

#### `online_users`
**Direction:** Server → Client
**Description:** List of currently online users
**Payload:**
```javascript
[
  {
    userId: "user1Id",
    _id: "user1Id",
    name: "User 1 Name",
    username: "user1",
    email: "user1@example.com",
    role: "customer",
    lastSeen: "2023-12-01T10:30:00Z"
  }
]
```

#### `user_online`
**Direction:** Server → Client
**Description:** Notification when a user comes online
**Payload:**
```javascript
{
  userId: "userId",
  name: "User Name",
  username: "username"
}
```

#### `user_offline`
**Direction:** Server → Client
**Description:** Notification when a user goes offline
**Payload:**
```javascript
{
  userId: "userId",
  lastSeen: "2023-12-01T10:30:00Z"
}
```

### Message Events

#### `send_message`
**Direction:** Client → Server
**Description:** Send a new message
**Payload:**
```javascript
{
  receiverId: "receiverUserId",
  content: "Hello, this is a message!"
}
```

#### `message_sent`
**Direction:** Server → Client
**Description:** Confirmation that message was sent
**Payload:**
```javascript
{
  success: true,
  message: {
    _id: "messageId",
    content: "Hello, this is a message!",
    sentAt: "2023-12-01T10:30:00Z",
    read: false,
    senderId: "senderId",
    senderName: "Sender Name",
    receiverId: "receiverId",
    receiverName: "Receiver Name"
  }
}
```

#### `receive_message`
**Direction:** Server → Client
**Description:** New message received (real-time)
**Payload:**
```javascript
{
  _id: "messageId",
  content: "Hello, this is a message!",
  sentAt: "2023-12-01T10:30:00Z",
  read: false,
  senderId: "senderId",
  senderName: "Sender Name",
  receiverId: "receiverId",
  receiverName: "Receiver Name"
}
```

### Message Read Events

#### `mark_message_read`
**Direction:** Client → Server
**Description:** Mark a message as read
**Payload:**
```javascript
{
  messageId: "messageId"
}
```

#### `message_read`
**Direction:** Server → Client
**Description:** Notification that a message was read
**Payload:**
```javascript
{
  messageId: "messageId",
  readBy: {
    _id: "userId",
    name: "Reader Name"
  },
  readAt: "2023-12-01T10:30:00Z"
}
```

#### `message_read_confirmed`
**Direction:** Server → Client
**Description:** Confirmation that message was marked as read
**Payload:**
```javascript
{
  success: true,
  message: {
    _id: "messageId",
    // ... complete message object
  }
}
```

### Typing Indicators

#### `typing_start`
**Direction:** Client → Server
**Description:** Start typing indicator
**Payload:**
```javascript
{
  receiverId: "receiverUserId"
}
```

#### `typing_stop`
**Direction:** Client → Server
**Description:** Stop typing indicator
**Payload:**
```javascript
{
  receiverId: "receiverUserId"
}
```

#### `typing_indicator`
**Direction:** Server → Client
**Description:** Show/hide typing indicator
**Payload:**
```javascript
{
  userId: "userId",
  userName: "Typing User",
  isTyping: true
}
```

### Message History

#### `get_message_history`
**Direction:** Client → Server
**Description:** Get message history with a specific user
**Payload:**
```javascript
{
  otherUserId: "otherUserId",
  page: 1,
  limit: 50
}
```

#### `message_history`
**Direction:** Server → Client
**Description:** Message history response
**Payload:**
```javascript
{
  messages: [
    {
      _id: "messageId",
      content: "Message content",
      sentAt: "2023-12-01T10:30:00Z",
      read: false,
      senderId: "senderId",
      senderName: "Sender Name",
      receiverId: "receiverId",
      receiverName: "Receiver Name"
    }
  ],
  otherUser: {
    _id: "otherUserId",
    name: "Other User Name"
  },
  pagination: {
    page: 1,
    hasMore: true
  }
}
```

### Unread Messages

#### `get_unread_count`
**Direction:** Client → Server
**Description:** Get total unread message count
**Payload:** (empty)

#### `unread_count`
**Direction:** Server → Client
**Description:** Unread message count
**Payload:**
```javascript
{
  count: 5
}
```

### Notifications

#### `message_notification`
**Direction:** Server → Client
**Description:** New message notification
**Payload:**
```javascript
{
  type: "new_message",
  from: {
    _id: "senderId",
    name: "Sender Name"
  },
  message: "Preview of the message...",
  timestamp: "2023-12-01T10:30:00Z"
}
```

### Error Handling

#### `error`
**Direction:** Server → Client
**Description:** Error message
**Payload:**
```javascript
{
  message: "Error description"
}
```

## Frontend Integration Example (React)

```javascript
import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const MessagingComponent = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typing, setTyping] = useState(null);

  useEffect(() => {
    // Initialize Socket.IO connection
    const newSocket = io('http://localhost:3000', {
      auth: {
        token: localStorage.getItem('token') // Your JWT token
      }
    });

    // Connection event
    newSocket.on('connect', () => {
      console.log('Connected to server');
      newSocket.emit('get_unread_count');
    });

    // Online users
    newSocket.on('online_users', (users) => {
      setOnlineUsers(users);
    });

    // New message
    newSocket.on('receive_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    // Typing indicator
    newSocket.on('typing_indicator', (data) => {
      setTyping(data.isTyping ? data.userName : null);
    });

    // Message sent confirmation
    newSocket.on('message_sent', (response) => {
      if (response.success) {
        setMessages(prev => [...prev, response.message]);
      }
    });

    // Error handling
    newSocket.on('error', (error) => {
      console.error('Socket error:', error.message);
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  const sendMessage = (receiverId, content) => {
    if (socket) {
      socket.emit('send_message', { receiverId, content });
    }
  };

  const startTyping = (receiverId) => {
    if (socket) {
      socket.emit('typing_start', { receiverId });
    }
  };

  const stopTyping = (receiverId) => {
    if (socket) {
      socket.emit('typing_stop', { receiverId });
    }
  };

  const markAsRead = (messageId) => {
    if (socket) {
      socket.emit('mark_message_read', { messageId });
    }
  };

  return (
    <div>
      {/* Your UI components */}
    </div>
  );
};

export default MessagingComponent;
```

## Authentication Requirements

1. **JWT Token:** All connections require a valid JWT token
2. **Token Format:** Bearer token from your authentication system
3. **Validation:** Server validates token on every connection
4. **Expiry:** Tokens should be refreshed before expiry

## Error Codes

- `Authentication error: No token provided` - No JWT token provided
- `Authentication error: User not found` - Invalid user ID in token
- `Authentication error: Invalid token` - Expired or invalid JWT token
- `Receiver not found` - Specified receiver user doesn't exist
- `Access denied` - User doesn't have permission for the action
- `Failed to send message` - Database or server error

## Best Practices

1. **Token Management:** Store JWT token securely (localStorage, sessionStorage, or secure cookies)
2. **Reconnection:** Implement automatic reconnection on disconnect
3. **Error Handling:** Always handle error events
4. **Typing Indicators:** Use debouncing for typing events
5. **Message Ordering:** Sort messages by timestamp for display
6. **Online Status:** Update UI based on online/offline events

## Scaling Considerations

- The current implementation uses in-memory storage for online users
- For production scaling, consider using Redis for session management
- Implement horizontal scaling with socket.io-redis adapter
- Add rate limiting for message sending
- Consider message persistence strategies for high-volume applications
