const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    name: {
        type: String,
        trim: true,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'failed'],
        default: 'pending'
    },
    sentAt: Date,
    error: String
}, { _id: false });

const campaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    htmlContent: {
        type: String,
        required: true
    },
    textContent: {
        type: String,
        default: ''
    },
    recipients: [recipientSchema],
    status: {
        type: String,
        enum: ['draft', 'sending', 'sent', 'failed', 'partial'],
        default: 'draft'
    },
    sentCount: {
        type: Number,
        default: 0
    },
    failedCount: {
        type: Number,
        default: 0
    },
    totalRecipients: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    emailCredential: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmailCredential',
        required: true
    },
    sentAt: Date,
    completedAt: Date
}, {
    timestamps: true
});

// Índices para mejorar búsquedas
campaignSchema.index({ createdBy: 1, createdAt: -1 });
campaignSchema.index({ status: 1 });

// Método para actualizar contadores
campaignSchema.methods.updateCounts = function () {
    this.sentCount = this.recipients.filter(r => r.status === 'sent').length;
    this.failedCount = this.recipients.filter(r => r.status === 'failed').length;
    this.totalRecipients = this.recipients.length;

    // Actualizar estado general
    if (this.sentCount === this.totalRecipients && this.totalRecipients > 0) {
        this.status = 'sent';
        this.completedAt = new Date();
    } else if (this.failedCount === this.totalRecipients && this.totalRecipients > 0) {
        this.status = 'failed';
        this.completedAt = new Date();
    } else if (this.sentCount > 0 || this.failedCount > 0) {
        this.status = 'partial';
    }
};

// Método para agregar destinatarios sin duplicados
campaignSchema.methods.addRecipients = function (newRecipients) {
    const existingEmails = new Set(this.recipients.map(r => r.email));
    const uniqueRecipients = newRecipients.filter(r => !existingEmails.has(r.email.toLowerCase()));
    this.recipients.push(...uniqueRecipients);
    this.totalRecipients = this.recipients.length;
    return uniqueRecipients.length;
};

module.exports = mongoose.model('Campaign', campaignSchema);
