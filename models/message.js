const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({

  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  content: { 
    type: String, 
    required: true, 
    trim: true 
  },
  read: { 
    type: Boolean, 
    default: false 
  },
  },
  { timestamps: { createdAt: "sentAt", updatedAt: false } }
);

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
