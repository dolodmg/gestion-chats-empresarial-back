const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        trim: true,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'sent', 'delivered', 'read', 'failed'],
        default: 'pending'
    },
    whatsAppMessageId: {
        type: String,
        default: null
    },
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    failedAt: Date,
    lastStatusAt: Date,
    error: {
        type: String,
        default: ''
    }
}, { _id: true });

const whatsAppCampaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    template: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WhatsAppTemplate',
        required: true
    },
    templateName: {
        type: String,
        required: true,
        trim: true
    },
    templateLanguage: {
        type: String,
        required: true,
        trim: true
    },
    templateCategory: {
        type: String,
        enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
        required: true
    },
    bodyPreview: {
        type: String,
        default: ''
    },
    parameters: [{
        type: String,
        default: ''
    }],
    recipients: [recipientSchema],
    status: {
        type: String,
        enum: ['draft', 'sending', 'completed', 'partial', 'failed'],
        default: 'draft'
    },
    totalRecipients: {
        type: Number,
        default: 0
    },
    sentCount: {
        type: Number,
        default: 0
    },
    deliveredCount: {
        type: Number,
        default: 0
    },
    readCount: {
        type: Number,
        default: 0
    },
    failedCount: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    clientId: {
        type: String,
        required: true,
        index: true
    },
    startedAt: Date,
    completedAt: Date
}, {
    timestamps: true
});

whatsAppCampaignSchema.index({ createdBy: 1, createdAt: -1 });
whatsAppCampaignSchema.index({ clientId: 1, status: 1 });
whatsAppCampaignSchema.index({ 'recipients.whatsAppMessageId': 1 });

whatsAppCampaignSchema.methods.updateCounts = function updateCounts() {
    this.totalRecipients = this.recipients.length;
    this.sentCount = this.recipients.filter(recipient =>
        ['accepted', 'sent', 'delivered', 'read'].includes(recipient.status)
    ).length;
    this.deliveredCount = this.recipients.filter(recipient =>
        ['delivered', 'read'].includes(recipient.status)
    ).length;
    this.readCount = this.recipients.filter(recipient => recipient.status === 'read').length;
    this.failedCount = this.recipients.filter(recipient => recipient.status === 'failed').length;

    if (!this.totalRecipients) {
        this.status = 'draft';
        this.completedAt = null;
        return;
    }

    const allFinalized = this.recipients.every(recipient =>
        ['read', 'delivered', 'sent', 'failed'].includes(recipient.status)
    );

    if (this.failedCount === this.totalRecipients) {
        this.status = 'failed';
        this.completedAt = new Date();
        return;
    }

    if (allFinalized) {
        this.status = this.failedCount > 0 ? 'partial' : 'completed';
        this.completedAt = new Date();
        return;
    }

    if (this.sentCount > 0 || this.failedCount > 0) {
        this.status = 'sending';
    }
};

whatsAppCampaignSchema.methods.addRecipients = function addRecipients(newRecipients) {
    const existingPhones = new Set(this.recipients.map(recipient => recipient.phoneNumber));
    const uniqueRecipients = newRecipients.filter(recipient => !existingPhones.has(recipient.phoneNumber));
    this.recipients.push(...uniqueRecipients);
    this.totalRecipients = this.recipients.length;
    return uniqueRecipients.length;
};

module.exports = mongoose.model('WhatsAppCampaign', whatsAppCampaignSchema);
