const mongoose = require('mongoose');
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-key-min-32-chars-long!!';
const ALGORITHM = 'aes-256-cbc';

const statusSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['pending', 'configured', 'error'],
        default: 'pending'
    },
    host: String,
    expectedValue: String,
    actualValue: String,
    errorMessage: String,
    checkedAt: Date
}, { _id: false });

const sendingDomainSchema = new mongoose.Schema({
    domain: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    verificationToken: {
        type: String,
        required: true
    },
    verificationHost: {
        type: String,
        required: true
    },
    dkimSelector: {
        type: String,
        default: 'default',
        trim: true
    },
    dkimPrivateKey: {
        type: String,
        required: true
    },
    dkimPublicKey: {
        type: String,
        required: true
    },
    trackingSubdomain: {
        type: String,
        required: true
    },
    trackingTarget: {
        type: String,
        required: true
    },
    bounceSubdomain: {
        type: String,
        required: true
    },
    bounceTarget: {
        type: String,
        required: true
    },
    spfValue: {
        type: String,
        required: true
    },
    dmarcRua: {
        type: String,
        required: true
    },
    dmarcValue: {
        type: String,
        required: true
    },
    verificationStatus: {
        ownership: { type: statusSchema, default: () => ({}) },
        spf: { type: statusSchema, default: () => ({}) },
        dkim: { type: statusSchema, default: () => ({}) },
        dmarc: { type: statusSchema, default: () => ({}) },
        tracking: { type: statusSchema, default: () => ({}) },
        bounce: { type: statusSchema, default: () => ({}) }
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isReadyForSending: {
        type: Boolean,
        default: false
    },
    lastVerifiedAt: Date
}, {
    timestamps: true
});

sendingDomainSchema.pre('save', function (next) {
    if (!this.isModified('dkimPrivateKey')) {
        return next();
    }

    try {
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(this.dkimPrivateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        this.dkimPrivateKey = `${iv.toString('hex')}:${encrypted}`;
        next();
    } catch (error) {
        next(error);
    }
});

sendingDomainSchema.methods.getDecryptedPrivateKey = function () {
    try {
        const parts = this.dkimPrivateKey.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];

        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Error decrypting DKIM private key:', error);
        return null;
    }
};

sendingDomainSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.dkimPrivateKey;
    return obj;
};

module.exports = mongoose.model('SendingDomain', sendingDomainSchema);
