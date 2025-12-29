const mongoose = require('mongoose');
const crypto = require('crypto');

// Encryption key - In production, use environment variable
const ENCRYPTION_KEY = process.env.META_ENCRYPTION_KEY || 'your-32-character-secret-key!!'; // Must be 32 characters
const ALGORITHM = 'aes-256-cbc';

const MetaConfigSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    metaDatasetId: {
        type: String,
        required: true,
        trim: true
    },
    metaAccessToken: {
        type: String,
        required: true
    },
    metaTestEventCode: {
        type: String,
        default: null,
        trim: true
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

// Encrypt access token before saving
MetaConfigSchema.pre('save', function (next) {
    if (!this.isModified('metaAccessToken')) {
        return next();
    }

    try {
        // Generate a random IV (Initialization Vector)
        const iv = crypto.randomBytes(16);

        // Create cipher
        const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        // Encrypt the token
        let encrypted = cipher.update(this.metaAccessToken, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Store IV + encrypted data (separated by :)
        this.metaAccessToken = iv.toString('hex') + ':' + encrypted;
        next();
    } catch (error) {
        next(error);
    }
});

// Method to decrypt access token
MetaConfigSchema.methods.getDecryptedToken = function () {
    try {
        // Split IV and encrypted data
        const parts = this.metaAccessToken.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedData = parts[1];

        // Create decipher
        const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        // Decrypt
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Error decrypting token:', error);
        throw new Error('Error al desencriptar token');
    }
};

// Update timestamp on save
MetaConfigSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('MetaConfig', MetaConfigSchema);
