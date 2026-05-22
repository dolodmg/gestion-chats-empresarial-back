const mongoose = require('mongoose');

const ComponentSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['HEADER', 'BODY', 'FOOTER', 'BUTTONS'],
        required: true
    },
    format: {
        type: String,
        enum: ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'],
        default: 'TEXT'
    },
    text: {
        type: String,
        default: null
    },
    example: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    buttons: [{
        type: {
            type: String,
            enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER']
        },
        text: String,
        url: String,
        phone_number: String
    }]
}, { _id: false });

const WhatsAppTemplateSchema = new mongoose.Schema({
    clientId: {
        type: String,
        required: true,
        index: true
    },
    wabaId: {
        type: String,
        required: true,
        index: true
    },
    templateId: {
        type: String,
        default: null,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: /^[a-z0-9_]+$/
    },
    category: {
        type: String,
        enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
        required: true
    },
    language: {
        type: String,
        required: true,
        default: 'es'
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED', 'DELETED'],
        default: 'PENDING'
    },
    components: [ComponentSchema],
    rejectionReason: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Índice compuesto para búsqueda rápida
WhatsAppTemplateSchema.index({ clientId: 1, name: 1, language: 1 }, { unique: true });

// Actualizar timestamp en cada guardado
WhatsAppTemplateSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Método para obtener preview del template
WhatsAppTemplateSchema.methods.getPreview = function () {
    const bodyComponent = this.components.find(c => c.type === 'BODY');
    return bodyComponent ? bodyComponent.text : '';
};

// Método para validar si el template puede ser enviado
WhatsAppTemplateSchema.methods.canBeSent = function () {
    return this.status === 'APPROVED';
};

module.exports = mongoose.model('WhatsAppTemplate', WhatsAppTemplateSchema);
