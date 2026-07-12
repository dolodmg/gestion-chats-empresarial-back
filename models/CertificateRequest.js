const mongoose = require('mongoose');

const CertificateRequestSchema = new mongoose.Schema({
  dni: {
    type: String,
    required: true,
    index: true
  },
  correo: {
    type: String,
    required: true
  },
  nombreCompleto: {
    type: String,
    default: ''
  },
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'completed_with_errors', 'failed'],
    default: 'queued',
    index: true
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  error: {
    type: String,
    default: null
  },
  startedAt: {
    type: Date,
    default: null
  },
  finishedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

CertificateRequestSchema.index({ dni: 1, createdAt: -1 });

module.exports = mongoose.model('CertificateRequest', CertificateRequestSchema);
