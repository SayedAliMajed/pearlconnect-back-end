const { authenticateSocket } = require('./auth');

function initializeMessageSocket(io) {
  io.on('connection', (socket) => {
    // Authenticate socket first
    authenticateSocket(socket, () => {
      socket.on('sendMessage', async (data) => {
        try {
          const { receiverId, content } = data;
          const senderId = socket.userId;

          // Import models dynamically to avoid circular dependencies
          const Message = require('../models/message');
          const User = require('../models/user');

          if (!receiverId || !content || content.trim() === '') {
            socket.emit('error', { message: 'Receiver and content are required' });
            return;
          }

          // Validate content length
          if (content.length > 1000) {
            socket.emit('error', { message: 'Message too long (max 1000 characters)' });
            return;
          }

          const receiverExists = await User.findById(receiverId);
          if (!receiverExists) {
            socket.emit('error', { message: 'Receiver not found' });
            return;
          }

          const message = await Message.create({
            sender: senderId,
            receiver: receiverId,
            content: content.trim()
          });

          socket.emit('messageSent', { message: 'Message sent successfully', messageId: message._id });

          // Emit to receiver if online
          const receiverSocket = getUserSocket(receiverId);
          if (receiverSocket) {
            receiverSocket.emit('newMessage', {
              sender: senderId,
              content: content,
              createdAt: message.createdAt
            });
          }
        } catch (err) {
          console.error('Send message error:', err);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      socket.on('getMessageHistory', async (data) => {
        try {
          const { otherUserId } = data;
          const userId = socket.userId;

          if (!otherUserId) {
            socket.emit('error', { message: 'Other user ID required' });
            return;
          }

          // Import model dynamically
          const Message = require('../models/message');

          const messages = await Message.find({
            $or: [
              { sender: userId, receiver: otherUserId },
              { sender: otherUserId, receiver: userId }
            ]
          })
          .sort({ createdAt: 1 })
          .limit(50);

          socket.emit('messageHistory', { messages });
        } catch (err) {
          console.error('Get message history error:', err);
          socket.emit('error', { message: 'Failed to get message history' });
        }
      });

      socket.on('markMessageAsRead', async (data) => {
        try {
          const { messageId } = data;
          const userId = socket.userId;

          if (!messageId) {
            socket.emit('error', { message: 'Message ID required' });
            return;
          }

          // Import model dynamically
          const Message = require('../models/message');

          const message = await Message.findById(messageId);
          if (!message) {
            socket.emit('error', { message: 'Message not found' });
            return;
          }

          if (message.receiver.toString() === userId) {
            await Message.findByIdAndUpdate(messageId, { read: true });
          }

          socket.emit('messageRead', { messageId });
        } catch (err) {
          console.error('Mark as read error:', err);
          socket.emit('error', { message: 'Failed to mark message as read' });
        }
      });

      socket.on('getUnreadCount', async () => {
        try {
          const userId = socket.userId;

          // Import model dynamically
          const Message = require('../models/message');

          con t u rea C unt = awa trMadCountcou tDocussnta(ments({
            r ceiver: u rreceiver: userId,
                refalsed: false
        ; });

 scktmt('uneaCnt', { count: unreadCount  );  socket.emit('unreadCount', { count: unreadCount });
       c}ecr)ch ( rr {
          c}sole.erro('Geunad ount rror:', r);
            });'error, { age: 'Filed to t un ut});
     })}
   });});
}});

}

module.exports = { initializeMessageSocket };
