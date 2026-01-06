const mongoose = require('mongoose');

/**
 * Modelo auxiliar para trackear el estado del round-robin por tabla
 */
const RoundRobinStateSchema = new mongoose.Schema({
    tableId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true,
        index: true
    },
    lastIndex: {
        type: Number,
        default: -1
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('RoundRobinState', RoundRobinStateSchema);
