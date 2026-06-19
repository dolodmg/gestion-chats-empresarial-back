const mongoose = require('mongoose');
const crypto = require('crypto');

// Encryption key - should be in environment variable in production
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-key-min-32-chars-long!!';
const ALGORITHM = 'aes-256-cbc';

const emailCredentialSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    host: {
        type: String,
        required: true,
        trim: true
    },
    port: {
        type: Number,
        required: true,
        min: 1,
        max: 65535
    },
    secure: {
        type: Boolean,
        default: false
    },
    user: {
        type: String,
        required: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    fromName: {
        type: String,
        required: true,
        trim: true
    },
    fromEmail: {
        type: String,
        required: true,
        trim: true
    },
    sendingDomain: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SendingDomain',
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Encrypt password before saving
emailCredentialSchema.pre('save', function (next) {
    if (!this.isModified('password')) {
        return next();
    }

    try {
        // Create cipher
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        // Encrypt password
        let encrypted = cipher.update(this.password, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Store IV + encrypted password
        this.password = iv.toString('hex') + ':' + encrypted;
        next();
    } catch (error) {
        next(error);
    }
});

// Method to decrypt password
emailCredentialSchema.methods.getDecryptedPassword = function () {
    try {
        const parts = this.password.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];

        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Error decrypting password:', error);
        return null;
    }
};

// Don't return password in JSON
emailCredentialSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

module.exports = mongoose.model('EmailCredential', emailCredentialSchema);
