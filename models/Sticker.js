const mongoose = require('mongoose');

const StickerSchema = new mongoose.Schema({
  clientId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  category: {
    type: String,
    default: 'custom',
    trim: true,
    maxlength: 40,
  },
  fileUrl: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    default: 'image/webp',
  },
  size: {
    type: Number,
    required: true,
  },
  createdBy: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Sticker', StickerSchema);
