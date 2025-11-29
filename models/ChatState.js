const mongoose = require('mongoose');

const ChatStateSchema = new mongoose.Schema({
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
  chatStatus: {
    type: String,
    enum: ['bot', 'human'],
    default: 'bot'
  },
  statusChangeTime: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// Actualizar la fecha de modificación antes de cada actualización
ChatStateSchema.pre('updateOne', function() {
  this.set({ updatedAt: new Date() });
});

ChatStateSchema.pre('findOneAndUpdate', function() {
  this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('ChatState', ChatStateSchema);
