const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    required: function() { return this.role === 'client'; },
    unique: function() { return this.role === 'client'; },
  },
  workflowId: {
    type: String,
    required: function() { return this.role === 'client'; },
    default: null,
  },
  // Nuevo campo para el token de WhatsApp
  whatsappToken: {
    type: String,
    required: function() { return this.role === 'client'; },
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', UserSchema);