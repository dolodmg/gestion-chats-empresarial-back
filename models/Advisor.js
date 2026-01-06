const mongoose = require('mongoose');

const AdvisorSchema = new mongoose.Schema({
    clientId: {
        type: String,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        default: '',
        trim: true
    },
    phone: {
        type: String,
        default: '',
        trim: true
    },
    active: {
        type: Boolean,
        default: true
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

// Índice compuesto para búsquedas eficientes
AdvisorSchema.index({ clientId: 1, active: 1 });

// Middleware para actualizar updatedAt
AdvisorSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Advisor', AdvisorSchema);
