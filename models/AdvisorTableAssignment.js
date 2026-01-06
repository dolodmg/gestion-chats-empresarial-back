const mongoose = require('mongoose');

const AdvisorTableAssignmentSchema = new mongoose.Schema({
    clientId: {
        type: String,
        required: true,
        index: true
    },
    advisorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Advisor',
        required: true
    },
    tableId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CustomTable',
        required: true
    },
    position: {
        type: Number,
        default: 0
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

// Índices compuestos para búsquedas eficientes
AdvisorTableAssignmentSchema.index({ clientId: 1, tableId: 1 });
AdvisorTableAssignmentSchema.index({ advisorId: 1 });
AdvisorTableAssignmentSchema.index({ tableId: 1, position: 1 });

// Middleware para actualizar updatedAt
AdvisorTableAssignmentSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('AdvisorTableAssignment', AdvisorTableAssignmentSchema);
