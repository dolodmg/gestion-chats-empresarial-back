const mongoose = require('mongoose');

const FAQSchema = new mongoose.Schema({
  clientId: {
    type: String,
    required: true,
    index: true,
  },
  canonicalQuestion: {
    type: String,
    required: true,
  },
  variations: [{
    question: String,
    count: Number,
    lastSeen: Date,
  }],
  commonResponse: {
    type: String,
    default: null,
  },
  category: {
    type: String,
    default: 'General',
  },
  totalCount: {
    type: Number,
    default: 0,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  isPinned: {
    type: Boolean,
    default: false,
  },
  customResponse: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
  },
  metadata: {
    avgResponseTime: Number,
    satisfactionRate: Number,
    escalationRate: Number,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

FAQSchema.index({ clientId: 1, totalCount: -1 });
FAQSchema.index({ clientId: 1, category: 1 });

FAQSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('FAQ', FAQSchema);