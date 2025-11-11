const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/user');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');
const Message = require('../models/message');


// CREATE - POST - /messages
router.post('/', verifyToken, checkRole(['admin', 'provider', 'customer']), async (req, res) => {
  try {
    // Validate required fields
    const { receiverId, content } = req.body;
    
    if (!receiverId || !content) {
      return res.status(400).json({
        err: 'Receiver ID and content are required'
      });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      res.status(404);
      throw new Error('Receiver not found');
    }

    // Create message with sender ID from authenticated user
    const messageData = {
      senderId: req.user._id,
      receiverId,
      content: content.trim(),
      read: false
    };

    const createdMessage = await Message.create(messageData);
    
    // Populate sender and receiver info for response
    const populatedMessage = await Message.findById(createdMessage._id)
      .populate('senderId', 'profile.fullName')
      .populate('receiverId', 'profile.fullName');

    res.status(201).json(populatedMessage);

  } catch (err) {
    if (res.statusCode === 404) {
      res.json({err: err.message});
    } else {
      res.status(500).json({err: 'Internal server error'});
    }
  }
});

// Index route - GET - /messages
router.get('/', verifyToken, checkRole(['admin', 'provider', 'customer']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get messages where user is either sender or receiver
    const foundMessages = await Message.find({
      $or: [
        { senderId: req.user._id },
        { receiverId: req.user._id }
      ]
    })
    .populate('senderId', 'profile.fullName')
    .populate('receiverId', 'profile.fullName')
    .sort({ sentAt: -1 })
    .skip(skip)
    .limit(limit);

    // Get total count for pagination
    const totalMessages = await Message.countDocuments({
      $or: [
        { senderId: req.user._id },
        { receiverId: req.user._id }
      ]
    });

    const totalPages = Math.ceil(totalMessages / limit);

    res.status(200).json({
      messages: foundMessages,
      pagination: {
        currentPage: page,
        totalPages,
        totalMessages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (err) {
    res.status(500).json({err: 'Message processing failed'});
  }
});

// Show route - GET - /messages/:messageId
router.get('/:messageId', verifyToken, checkRole(['admin', 'provider', 'customer']), async (req, res) => {
  try {
    const foundMessage = await Message.findById(req.params.messageId)
      .populate('senderId', 'profile.fullName')
      .populate('receiverId', 'profile.fullName');

    if (!foundMessage) {
      res.status(404);
      throw new Error('Message not found');
    }

    // Check if user is authorized to view this message
    if (foundMessage.senderId._id.toString() !== req.user._id.toString() && 
        foundMessage.receiverId._id.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Access denied');
    }

    res.status(200).json({foundMessage});

  } catch (err) {
    if (res.statusCode === 404 || res.statusCode === 403) {
      res.json({err: err.message});
    } else {
      res.status(500).json({err: 'Database operation failed'});
    }
  }
});

// Delete route - DELETE - /messages/:messageId
router.delete('/:messageId', verifyToken, checkRole(['admin', 'provider', 'customer']), async (req, res) => {
  try {
    const deletedMessage = await Message.findById(req.params.messageId);

    if (!deletedMessage) {
      res.status(404);
      throw new Error('Message not found');
    }

    // Only sender can delete message
    if (deletedMessage.senderId.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Only sender can delete message');
    }

    await Message.findByIdAndDelete(req.params.messageId);

    res.status(200).json({deletedMessage});

  } catch (err) {
    if (res.statusCode === 404 || res.statusCode === 403) {
      res.json({err: err.message});
    } else {
      res.status(500).json({err: 'Service temporarily unavailable'});
    }
  }
});

// Update route - PUT - /messages/:messageId/read
router.put('/:messageId/read', verifyToken, checkRole(['admin', 'provider', 'customer']), async (req, res) => {
  try {
    const foundMessage = await Message.findById(req.params.messageId);

    if (!foundMessage) {
      res.status(404);
      throw new Error('Message not found');
    }

    // Only receiver can mark message as read
    if (foundMessage.receiverId.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Only receiver can mark message as read');
    }

    // Update read status
    foundMessage.read = true;
    await foundMessage.save();

    // Return updated message with populated data
    const updatedMessage = await Message.findById(req.params.messageId)
      .populate('senderId', 'profile.fullName')
      .populate('receiverId', 'profile.fullName');

    res.status(200).json({updatedMessage});

  } catch (err) {
    if (res.statusCode === 404 || res.statusCode === 403) {
      res.json({err: err.message});
    } else {
      res.status(500).json({err: 'Message operation failed'});
    }
  }
});

// Get conversation between current user and specific user - GET - /messages/conversation/:userId
router.get('/conversation/:userId', verifyToken, checkRole(['admin', 'provider', 'customer']), async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Verify the other user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      res.status(404);
      throw new Error('User not found');
    }

    // Get conversation between current user and specified user
    const foundConversation = await Message.find({
      $or: [
        { senderId: req.user._id, receiverId: userId },
        { senderId: userId, receiverId: req.user._id }
      ]
    })
    .populate('senderId', 'profile.fullName')
    .populate('receiverId', 'profile.fullName')
    .sort({ sentAt: 1 }) // chronological order for conversations
    .skip(skip)
    .limit(limit);

    // Get total messages in conversation
    const totalMessages = await Message.countDocuments({
      $or: [
        { senderId: req.user._id, receiverId: userId },
        { senderId: userId, receiverId: req.user._id }
      ]
    });

    const totalPages = Math.ceil(totalMessages / limit);

    res.status(200).json({
      conversation: foundConversation,
      otherUser: {
        _id: otherUser._id,
        name: otherUser.profile.fullName
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalMessages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (err) {
    if (res.statusCode === 404) {
      res.json({err: err.message});
    } else {
      res.status(500).json({err: 'Conversation retrieval failed'});
    }
  }
});

// Get conversation list (all users current user has messaged with) - GET - /messages/conversations/list
router.get('/conversations/list', verifyToken, checkRole(['admin', 'provider', 'customer']), async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get all unique conversation partners
    const sentMessages = await Message.find({ senderId: userId }).distinct('receiverId');
    const receivedMessages = await Message.find({ receiverId: userId }).distinct('senderId');
    
    // Combine and remove duplicates
    const conversationPartnerIds = [...new Set([...sentMessages, ...receivedMessages])];
    
    // Get user details for each conversation partner
    const conversationPartners = await User.find(
      { _id: { $in: conversationPartnerIds } },
      { 'profile.fullName': 1 }
    );
    
    // Get last message and unread count for each conversation
    const foundConversations = await Promise.all(
      conversationPartners.map(async (partner) => {
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: userId, receiverId: partner._id },
            { senderId: partner._id, receiverId: userId }
          ]
        }).sort({ sentAt: -1 });
        
        const unreadCount = await Message.countDocuments({
          senderId: partner._id,
          receiverId: userId,
          read: false
        });
        
        return {
          otherUser: {
            _id: partner._id,
            name: partner.profile.fullName
          },
          lastMessage: lastMessage ? {
            _id: lastMessage._id,
            content: lastMessage.content,
            sentAt: lastMessage.sentAt,
            read: lastMessage.read,
            senderId: lastMessage.senderId
          } : null,
          unreadCount
        };
      })
    );
    
    // Sort by last message date
    foundConversations.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.sentAt) - new Date(a.lastMessage.sentAt);
    });
    
    res.status(200).json({conversations: foundConversations});

  } catch (err) {
    res.status(500).json({err: 'Service temporarily unavailable'});
  }
});

// Get unread message count - GET - /messages/unread/count
router.get('/unread/count', verifyToken, checkRole(['admin', 'provider', 'customer']), async (req, res) => {
  try {
    const unreadCount = await Message.countDocuments({
      receiverId: req.user._id,
      read: false
    });

    res.status(200).json({unreadCount});

  } catch (err) {
    res.status(500).json({err: 'Message operation failed'});
  }
});

// Update route - PUT - /messages/mark-read/:userId
router.put('/mark-read/:userId', verifyToken, checkRole(['admin', 'provider', 'customer']), async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify the other user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      res.status(404);
      throw new Error('User not found');
    }

    // Mark all messages from this user as read
    const result = await Message.updateMany(
      {
        senderId: userId,
        receiverId: req.user._id,
        read: false
      },
      { read: true }
    );

    res.status(200).json({ 
      message: 'Messages marked as read',
      modifiedCount: result.modifiedCount 
    });

  } catch (err) {
    if (res.statusCode === 404) {
      res.json({err: err.message});
    } else {
      res.status(500).json({err: 'Database operation failed'});
    }
  }
});

module.exports = router;
