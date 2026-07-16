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
  ctwa_clid: {
    type: String,
    default: null,
    index: true // Index for faster queries
  },
  assignedAdvisorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Advisor',
    default: null
  },
  assignedAdvisorName: {
    type: String,
    default: null
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
  manualControlLocked: {
    type: Boolean,
    default: false
  },
  manualControlOption: {
    type: String,
    enum: ['30m', '2h', '8h', 'workday', 'manual'],
    default: null
  },
  manualControlExpiresAt: {
    type: Date,
    default: null
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  lastOpenedAt: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model('Chat', ChatSchema);
