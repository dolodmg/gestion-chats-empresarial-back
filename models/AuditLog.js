const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  actorId: {
    type: String,
    default: null,
    trim: true
  },
  actorRole: {
    type: String,
    default: 'anonymous',
    trim: true
  },
  actorEmail: {
    type: String,
    default: null,
    trim: true
  },
  clientId: {
    type: String,
    default: null,
    trim: true
  },
  action: {
    type: String,
    required: true,
    trim: true
  },
  targetType: {
    type: String,
    default: null,
    trim: true
  },
  targetId: {
    type: String,
    default: null,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ip: {
    type: String,
    default: null,
    trim: true
  },
  userAgent: {
    type: String,
    default: null
  }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  minimize: false
});

AuditLogSchema.index({ clientId: 1, createdAt: -1 }, { name: 'clientId_createdAt' });
AuditLogSchema.index({ actorId: 1, createdAt: -1 }, { name: 'actorId_createdAt' });
AuditLogSchema.index({ action: 1, createdAt: -1 }, { name: 'action_createdAt' });
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 }, { name: 'target_createdAt' });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
