const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const defaultFeatureFlags = {
  data: true,
  campaigns: true,
  templates: true,
  advisors: true,
  advisorMetrics: true,
  inscripciones: true,
  metaEventos: true,
  assistant: true,
  conversationSummary: true,
  sendTemplates: true,
};

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'client'],
    default: 'client',
  },
  clientId: {
    type: String,
    required: function () { return this.role === 'client'; },
    unique: function () { return this.role === 'client'; },
  },
  workflowId: {
    type: String,
    required: function () { return this.role === 'client'; },
    default: null,
  },
  // Nuevo campo para el token de WhatsApp
  whatsappToken: {
    type: String,
    required: function () { return this.role === 'client'; },
    default: null,
  },
  // WhatsApp Business Account ID (WABA-ID) para gestión de plantillas
  wabaId: {
    type: String,
    required: false,
    default: null,
  },
  featureFlags: {
    data: { type: Boolean, default: defaultFeatureFlags.data },
    campaigns: { type: Boolean, default: defaultFeatureFlags.campaigns },
    templates: { type: Boolean, default: defaultFeatureFlags.templates },
    advisors: { type: Boolean, default: defaultFeatureFlags.advisors },
    advisorMetrics: { type: Boolean, default: defaultFeatureFlags.advisorMetrics },
    inscripciones: { type: Boolean, default: defaultFeatureFlags.inscripciones },
    metaEventos: { type: Boolean, default: defaultFeatureFlags.metaEventos },
    assistant: { type: Boolean, default: defaultFeatureFlags.assistant },
    conversationSummary: { type: Boolean, default: defaultFeatureFlags.conversationSummary },
    sendTemplates: { type: Boolean, default: defaultFeatureFlags.sendTemplates },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', UserSchema);
