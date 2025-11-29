const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    unique: true,
  },
  clientId: {
    type: String,
    required: true,
    index: true,
  },
  contactName: {
    type: String,
    default: '',
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  lastMessage: {
    type: String,
    default: '',
  },
  lastMessageTimestamp: {
    type: Date,
    default: Date.now,
  },
  unreadCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Nuevo campo para el estado del chat
  chatStatus: {
    type: String,
    enum: ['bot', 'human'],
    default: 'bot'
  },
  // Timestamp para el cambio automático de estado
  statusChangeTime: {
    type: Date,
    default: null
  },
  tags: [{
  type: String,
  trim: true,
  lowercase: true
}]
});

module.exports = mongoose.model('Chat', ChatSchema);
