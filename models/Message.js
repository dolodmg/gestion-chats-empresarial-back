const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    index: true,
  },
  clientId: {
    type: String,
    required: true,
    index: true,
  },
  sender: {
    type: String,
    required: true,
    enum: ['user', 'bot'],
  },
  content: {
    type: String,
    default: '',
  },
  mediaUrl: {
    type: String,
    default: null,
  },
  mediaType: {
    type: String,
    enum: ['image', 'video', 'audio', 'document', 'sticker', null],
    default: null,
  },
  fileName: {
    type: String,
    default: null,
  },
  mimeType: {
    type: String,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent',
  },
});

module.exports = mongoose.model('Message', MessageSchema);

