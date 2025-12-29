const mongoose = require('mongoose');

const MetaTagMappingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    tagName: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    eventName: {
        type: String,
        required: true,
        enum: ['Purchase', 'Lead', 'Contact', 'Schedule'],
        trim: true
    },
    defaultValue: {
        type: Number,
        default: null
    },
    defaultCurrency: {
        type: String,
        default: 'USD',
        trim: true,
        uppercase: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to ensure unique tag-event mapping per user
MetaTagMappingSchema.index({ userId: 1, tagName: 1 }, { unique: true });

module.exports = mongoose.model('MetaTagMapping', MetaTagMappingSchema);
