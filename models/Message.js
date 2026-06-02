const mongoose = require('mongoose');

const MESSAGE_TYPES = ['text', 'image', 'video', 'audio', 'document', 'sticker', 'template', 'system', 'unknown'];
const MESSAGE_SOURCES = ['n8n', 'dashboard', 'meta_webhook', 'api', 'migration', 'unknown'];
const MESSAGE_DIRECTIONS = ['inbound', 'outbound', 'internal'];
const MESSAGE_PROVIDERS = ['whatsapp_meta', 'n8n', 'internal', 'unknown'];
const DELIVERY_STATUSES = ['received', 'queued', 'sent', 'delivered', 'read', 'failed'];

const MessageSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    trim: true
  },
  clientId: {
    type: String,
    required: true,
    trim: true
  },
  messageId: {
    type: String,
    default: null,
    trim: true
  },
  responseToMessageId: {
    type: String,
    default: null,
    trim: true
  },
  sender: {
    type: String,
    required: true,
    enum: ['user', 'bot']
  },
  direction: {
    type: String,
    enum: MESSAGE_DIRECTIONS,
    default: function resolveDirection() {
      return this.sender === 'user' ? 'inbound' : 'outbound';
    }
  },
  source: {
    type: String,
    enum: MESSAGE_SOURCES,
    default: 'unknown'
  },
  provider: {
    type: String,
    enum: MESSAGE_PROVIDERS,
    default: 'whatsapp_meta'
  },
  workflowId: {
    type: String,
    default: null,
    trim: true
  },
  workflowName: {
    type: String,
    default: null,
    trim: true
  },
  insertedBy: {
    type: String,
    default: null,
    trim: true
  },
  aiGenerated: {
    type: Boolean,
    default: false
  },
  contactName: {
    type: String,
    default: '',
    trim: true
  },
  phoneNumber: {
    type: String,
    default: null,
    trim: true
  },
  content: {
    type: String,
    default: ''
  },
  messageType: {
    type: String,
    enum: MESSAGE_TYPES,
    default: function resolveMessageType() {
      if (this.mediaType) {
        return this.mediaType;
      }

      return this.content ? 'text' : 'unknown';
    }
  },
  templateName: {
    type: String,
    default: null,
    trim: true
  },
  mediaUrl: {
    type: String,
    default: null
  },
  mediaType: {
    type: String,
    enum: ['image', 'video', 'audio', 'document', 'sticker', null],
    default: null
  },
  fileName: {
    type: String,
    default: null
  },
  mimeType: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: DELIVERY_STATUSES,
    default: 'sent'
  },
  metaStatus: {
    type: String,
    default: null,
    trim: true
  },
  errorCode: {
    type: String,
    default: null,
    trim: true
  },
  errorMessage: {
    type: String,
    default: null
  },
  retentionUntil: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  minimize: false
});

MessageSchema.index({ clientId: 1, chatId: 1, timestamp: -1 }, { name: 'clientId_chatId_timestamp' });
MessageSchema.index({ clientId: 1, phoneNumber: 1, timestamp: -1 }, { name: 'clientId_phoneNumber_timestamp' });
MessageSchema.index(
  { clientId: 1, messageId: 1 },
  {
    name: 'clientId_messageId_unique',
    unique: true,
    partialFilterExpression: {
      messageId: { $exists: true, $type: 'string', $ne: '' }
    }
  }
);
MessageSchema.index({ clientId: 1, source: 1, timestamp: -1 }, { name: 'clientId_source_timestamp' });
MessageSchema.index({ retentionUntil: 1 }, { name: 'retentionUntil_idx' });

module.exports = mongoose.model('Message', MessageSchema);
