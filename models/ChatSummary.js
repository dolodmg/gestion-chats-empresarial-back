const mongoose = require('mongoose');

const ChatSummarySchema = new mongoose.Schema({
    chatId: {
        type: String,
        required: true,
        index: true
    },
    clientId: {
        type: String,
        required: true,
        index: true
    },
    summary: {
        type: String,
        required: true
    },
    messageCount: {
        type: Number,
        required: true,
        default: 0
    },
    generatedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastMessageDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

// Índice compuesto para búsquedas eficientes
ChatSummarySchema.index({ chatId: 1, generatedAt: -1 });
ChatSummarySchema.index({ clientId: 1, generatedAt: -1 });

module.exports = mongoose.model('ChatSummary', ChatSummarySchema);
