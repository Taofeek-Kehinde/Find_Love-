const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'text' },
  timestamp: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null }
});

module.exports = mongoose.model('Message', messageSchema);
