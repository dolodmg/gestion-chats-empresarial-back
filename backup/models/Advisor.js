const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
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
AdvisorSchema.index({ email: 1 });

// Middleware para hashear password y actualizar updatedAt
AdvisorSchema.pre('save', async function (next) {
    this.updatedAt = new Date();

    // Solo hashear la contraseña si ha sido modificada
    if (!this.isModified('password')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('Advisor', AdvisorSchema);
