const onlineUsers = new Map(); // Store online users: userId -> socketId
const userSockets = new Map(); // Store user sockets: socketId -> userId

// Add user to online list
const addOnlineUser = (userId, socketId, userInfo) => {
  onlineUsers.set(userId, {
    socketId,
    userInfo,
    lastSeen: new Date()
  });
  userSockets.set(socketId, userId);
};

// Remove user from online list
const removeOnlineUser = (socketId) => {
  const userId = userSockets.get(socketId);
  if (userId) {
    onlineUsers.delete(userId);
    userSockets.delete(socketId);
  }
  return userId;
};

// Get all online users
const getOnlineUsers = () => {
  const users = [];
  for (const [userId, data] of onlineUsers.entries()) {
    users.push({
      userId,
      ...data.userInfo,
      lastSeen: data.lastSeen
    });
  }
  return users;
};

// Check if user is online
const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

// Get user socket ID
const getUserSocketId = (userId) => {
  const userData = onlineUsers.get(userId);
  return userData ? userData.socketId : null;
};

// Get all socket IDs for a user (handles multiple connections)
const getUserSocketIds = (userId) => {
  const socketIds = [];
  for (const [id, data] of onlineUsers.entries()) {
    if (id === userId) {
      socketIds.push(data.socketId);
    }
  }
  return socketIds;
};

// Update user last seen
const updateUserLastSeen = (userId) => {
  const userData = onlineUsers.get(userId);
  if (userData) {
    userData.lastSeen = new Date();
  }
};

// Broadcast online users to all connected clients
const broadcastOnlineUsers = (io) => {
  const onlineUsersList = getOnlineUsers();
  io.emit('online_users', onlineUsersList);
};

// Handle user connection
const handleUserConnect = (socket, userInfo) => {
  const userId = userInfo._id;
  
  // Add to online users
  addOnlineUser(userId, socket.id, userInfo);
  
  // Join user to their personal room
  socket.join(`user_${userId}`);
  
  // Broadcast to all users that this user is online
  socket.broadcast.emit('user_online', {
    userId,
    name: userInfo.name,
    username: userInfo.username
  });
  
  // Send current online users list to the newly connected user
  socket.emit('online_users', getOnlineUsers());
  
  console.log(`User ${userInfo.name} (${userId}) connected`);
};

// Handle user disconnection
const handleUserDisconnect = (socket) => {
  const userId = removeOnlineUser(socket.id);
  
  if (userId) {
    // Broadcast to all users that this user is offline
    socket.broadcast.emit('user_offline', {
      userId,
      lastSeen: new Date()
    });
    
    console.log(`User ${userId} disconnected`);
  }
};

// Send notification to specific user
const sendToUser = (io, userId, event, data) => {
  io.to(`user_${userId}`).emit(event, data);
};

// Send notification to multiple users
const sendToUsers = (io, userIds, event, data) => {
  userIds.forEach(userId => {
    sendToUser(io, userId, event, data);
  });
};

module.exports = {
  handleUserConnect,
  handleUserDisconnect,
  getOnlineUsers,
  isUserOnline,
  getUserSocketId,
  getUserSocketIds,
  updateUserLastSeen,
  broadcastOnlineUsers,
  sendToUser,
  sendToUsers
};
