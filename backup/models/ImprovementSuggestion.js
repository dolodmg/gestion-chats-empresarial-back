const mongoose = require('mongoose');

const ImprovementSchema = new mongoose.Schema({
  clientId: {
    type: String,
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['knowledge_gap', 'escalation', 'sentiment', 'prompt_health'],
    required: true
  },
  title: { type: String, required: true }, 
  description: { type: String, required: true },
  context: String, 
  severity: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'resolved', 'ignored'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ImprovementSuggestion', ImprovementSchema);