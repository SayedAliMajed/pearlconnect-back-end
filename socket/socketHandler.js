const { Server } = require('socket.io');
const authenticateSocket = require('./auth.js');
const { handleUserConnect, handleUserDisconnect, broadcastOnlineUsers } = require('./users.js');
const { sendMessage, markMessageAsRead, handleTyping, getMessageHistory, getUnreadCount } = require('./messages.js');

// Initialize Socket.IO server
const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Apply authentication middleware
  io.use(authenticateSocket);

  // Handle socket connections
  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`Socket.IO connection established for user: ${user.name} (${user._id})`);

    // Handle user connection
    handleUserConnect(socket, user);

    // Handle message events
    socket.on('send_message', (data) => {
      sendMessage(io, socket, data);
    });

    socket.on('mark_message_read', (data) => {
      markMessageAsRead(io, socket, data);
    });

    socket.on('typing_start', (data) => {
      handleTyping(io, socket, { ...data, isTyping: true });
    });

    socket.on('typing_stop', (data) => {
      handleTyping(io, socket, { ...data, isTyping: false });
    });

    socket.on('get_message_history', (data) => {
      getMessageHistory(socket, data);
    });

    socket.on('get_unread_count', () => {
      getUnreadCount(socket);
    });

    socket.on('get_online_users', () => {
      const onlineUsers = io.sockets.adapter.sids.size > 0 ? 
        Array.from(io.sockets.sockets.values()).map(s => s.user).filter(Boolean) : 
        [];
      socket.emit('online_users', onlineUsers);
    });

    // Handle typing indicators with auto-stop
    socket.on('typing_indicator', (data) => {
      const { receiverId, isTyping } = data;
      if (isTyping) {
        // Auto-stop typing after 3 seconds
        setTimeout(() => {
          handleTyping(io, socket, { receiverId, isTyping: false });
        }, 3000);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`User ${user.name} disconnected: ${reason}`);
      handleUserDisconnect(socket);
      
      // Broadcast updated online users list
      setTimeout(() => {
        broadcastOnlineUsers(io);
      }, 1000);
    });
  });

  return io;
};

module.exports = { initializeSocket };
