const mongoose = require('mongoose');

const AssistantPromptSchema = new mongoose.Schema({
  clientId: {
    type: String,
    required: true,
    index: true,
  },
  workflowId: {
    type: String,
    required: true,
    index: true,
  },
  nodeId: {
    type: String,
    required: true, // ID del nodo específico donde está el prompt
  },
  promptText: {
    type: String,
    required: true,
  },
  version: {
    type: Number,
    default: 1,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  // Para el historial
  createdBy: {
    type: String, // ID del usuario que hizo el cambio
    default: 'system',
  },
  description: {
    type: String,
    default: 'Prompt update',
  }
});

// Índice compuesto para búsquedas eficientes
AssistantPromptSchema.index({ clientId: 1, workflowId: 1 });
AssistantPromptSchema.index({ clientId: 1, isActive: 1 });

// Middleware para actualizar updatedAt
AssistantPromptSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AssistantPrompt', AssistantPromptSchema);