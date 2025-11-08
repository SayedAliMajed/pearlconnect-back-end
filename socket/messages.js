const Message = require('../models/message.js');
const User = require('../models/user.js');
const { sendToUser, isUserOnline } = require('./users.js');

// Send message in real-time
const sendMessage = async (io, socket, data) => {
  try {
    const { receiverId, content } = data;
    const senderId = socket.user._id;

    // Validate input
    if (!receiverId || !content || !content.trim()) {
      socket.emit('error', { message: 'Receiver ID and content are required' });
      return;
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      socket.emit('error', { message: 'Receiver not found' });
      return;
    }

    // Create message in database
    const messageData = {
      senderId,
      receiverId,
      content: content.trim(),
      read: false
    };

    const message = await Message.create(messageData);

    // Populate sender and receiver info
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'profile.fullName')
      .populate('receiverId', 'profile.fullName');

    const messageResponse = {
      _id: populatedMessage._id,
      content: populatedMessage.content,
      sentAt: populatedMessage.sentAt,
      read: populatedMessage.read,
      senderId: populatedMessage.senderId._id,
      senderName: populatedMessage.senderId.profile.fullName,
      receiverId: populatedMessage.receiverId._id,
      receiverName: populatedMessage.receiverId.profile.fullName
    };

    // Send to receiver (real-time)
    if (isUserOnline(receiverId)) {
      sendToUser(io, receiverId, 'receive_message', messageResponse);
    }

    // Send delivery confirmation to sender
    socket.emit('message_sent', {
      success: true,
      message: messageResponse
    });

    // Send notification to receiver
    if (isUserOnline(receiverId)) {
      sendToUser(io, receiverId, 'message_notification', {
        type: 'new_message',
        from: {
          _id: senderId,
          name: populatedMessage.senderId.profile.fullName
        },
        message: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        timestamp: new Date()
      });
    }

    console.log(`Message sent from ${senderId} to ${receiverId}`);

  } catch (err) {
    console.error('Send message error:', err);
    socket.emit('error', { message: 'Failed to send message' });
  }
};

// Mark message as read
const markMessageAsRead = async (io, socket, data) => {
  try {
    const { messageId } = data;
    const userId = socket.user._id;

    // Find and validate message
    const message = await Message.findById(messageId);
    if (!message) {
      socket.emit('error', { message: 'Message not found' });
      return;
    }

    // Check if user is the receiver
    if (message.receiverId.toString() !== userId) {
      socket.emit('error', { message: 'Access denied' });
      return;
    }

    // Update message read status
    message.read = true;
    await message.save();

    // Populate message for response
    const populatedMessage = await Message.findById(messageId)
      .populate('senderId', 'profile.fullName')
      .populate('receiverId', 'profile.fullName');

    const messageResponse = {
      _id: populatedMessage._id,
      content: populatedMessage.content,
      sentAt: populatedMessage.sentAt,
      read: populatedMessage.read,
      senderId: populatedMessage.senderId._id,
      senderName: populatedMessage.senderId.profile.fullName,
      receiverId: populatedMessage.receiverId._id,
      receiverName: populatedMessage.receiverId.profile.fullName
    };

    // Send read receipt to sender
    sendToUser(io, message.senderId, 'message_read', {
      messageId,
      readBy: {
        _id: userId,
        name: populatedMessage.receiverId.profile.fullName
      },
      readAt: new Date()
    });

    // Confirm to receiver
    socket.emit('message_read_confirmed', {
      success: true,
      message: messageResponse
    });

    console.log(`Message ${messageId} marked as read by ${userId}`);

  } catch (err) {
    console.error('Mark as read error:', err);
    socket.emit('error', { message: 'Failed to mark message as read' });
  }
};

// Handle typing indicators
const handleTyping = (io, socket, data) => {
  const { receiverId, isTyping } = data;
  const senderId = socket.user._id;
  const senderName = socket.user.name;

  // Send typing indicator to receiver
  if (isUserOnline(receiverId)) {
    sendToUser(io, receiverId, 'typing_indicator', {
      userId: senderId,
      userName: senderName,
      isTyping
    });
  }
};

// Get message history between two users
const getMessageHistory = async (socket, data) => {
  try {
    const { otherUserId, page = 1, limit = 50 } = data;
    const userId = socket.user._id;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId }
      ]
    })
    .populate('senderId', 'profile.fullName')
    .populate('receiverId', 'profile.fullName')
    .sort({ sentAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Get other user info
    const otherUser = await User.findById(otherUserId, { 'profile.fullName': 1, username: 1 });

    const messageHistory = messages.reverse().map(msg => ({
      _id: msg._id,
      content: msg.content,
      sentAt: msg.sentAt,
      read: msg.read,
      senderId: msg.senderId._id,
      senderName: msg.senderId.profile.fullName,
      receiverId: msg.receiverId._id,
      receiverName: msg.receiverId.profile.fullName
    }));

    socket.emit('message_history', {
      messages: messageHistory,
      otherUser: {
        _id: otherUserId,
        name: otherUser?.profile?.fullName || 'Unknown User'
      },
      pagination: {
        page: parseInt(page),
        hasMore: messages.length === parseInt(limit)
      }
    });

  } catch (err) {
    console.error('Get message history error:', err);
    socket.emit('error', { message: 'Failed to get message history' });
  }
};

// Get unread message count
const getUnreadCount = async (socket) => {
  try {
    const userId = socket.user._id;

    const unreadCount = await Message.countDocuments({
      receiverId: userId,
      read: false
    });

    socket.emit('unread_count', { count: unreadCount });

  } catch (err) {
    console.error('Get unread count error:', err);
    socket.emit('error', { message: 'Failed to get unread count' });
  }
};

module.exports = {
  sendMessage,
  markMessageAsRead,
  handleTyping,
  getMessageHistory,
  getUnreadCount
};
