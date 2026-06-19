const SendingDomain = require('../models/SendingDomain');
const EmailCredential = require('../models/EmailCredential');
const {
    buildBounceTarget,
    buildDmarcRua,
    buildDmarcValue,
    buildSpfValue,
    buildTrackingTarget,
    generateDkimKeyPair,
    generateVerificationToken,
    normalizeDomain,
    serializeSendingDomain,
    validateDomain,
    validateLabel,
    verifyDnsConfiguration
} = require('../services/domainAuthService');

function buildSubdomain(prefix, domain) {
    return `${prefix}.${domain}`;
}

exports.createSendingDomain = async (req, res) => {
    try {
        const {
            domain,
            dkimSelector = 'default',
            trackingPrefix = 'track',
            bouncePrefix = 'bounce',
            dmarcRua
        } = req.body;

        const normalizedDomain = normalizeDomain(domain);
        const normalizedSelector = String(dkimSelector || 'default').trim().toLowerCase();
        const normalizedTrackingPrefix = String(trackingPrefix || 'track').trim().toLowerCase();
        const normalizedBouncePrefix = String(bouncePrefix || 'bounce').trim().toLowerCase();

        if (!validateDomain(normalizedDomain)) {
            return res.status(400).json({
                success: false,
                error: 'Ingresa un dominio válido.'
            });
        }

        if (!validateLabel(normalizedSelector) || !validateLabel(normalizedTrackingPrefix) || !validateLabel(normalizedBouncePrefix)) {
            return res.status(400).json({
                success: false,
                error: 'Selector DKIM y subdominios deben ser etiquetas DNS válidas.'
            });
        }

        const existingDomain = await SendingDomain.findOne({ domain: normalizedDomain });
        if (existingDomain) {
            return res.status(409).json({
                success: false,
                error: 'Ese dominio ya está registrado en el sistema.'
            });
        }

        const { publicKeyValue, privateKey } = generateDkimKeyPair();
        const verificationToken = generateVerificationToken();
        const resolvedRua = String(dmarcRua || buildDmarcRua(normalizedDomain)).trim().toLowerCase();

        const sendingDomain = new SendingDomain({
            domain: normalizedDomain,
            createdBy: req.user.id,
            verificationToken,
            verificationHost: `_mailauth.${normalizedDomain}`,
            dkimSelector: normalizedSelector,
            dkimPrivateKey: privateKey,
            dkimPublicKey: publicKeyValue,
            trackingSubdomain: buildSubdomain(normalizedTrackingPrefix, normalizedDomain),
            trackingTarget: buildTrackingTarget(),
            bounceSubdomain: buildSubdomain(normalizedBouncePrefix, normalizedDomain),
            bounceTarget: buildBounceTarget(),
            spfValue: buildSpfValue(),
            dmarcRua: resolvedRua,
            dmarcValue: buildDmarcValue(normalizedDomain, resolvedRua)
        });

        await sendingDomain.save();

        res.status(201).json({
            success: true,
            sendingDomain: serializeSendingDomain(sendingDomain)
        });
    } catch (error) {
        console.error('Error creando dominio autenticado:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getSendingDomains = async (req, res) => {
    try {
        const sendingDomains = await SendingDomain.find({ createdBy: req.user.id }).sort({ createdAt: -1 });

        res.json({
            success: true,
            sendingDomains: sendingDomains.map(serializeSendingDomain)
        });
    } catch (error) {
        console.error('Error obteniendo dominios autenticados:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getSendingDomainById = async (req, res) => {
    try {
        const sendingDomain = await SendingDomain.findOne({
            _id: req.params.id,
            createdBy: req.user.id
        });

        if (!sendingDomain) {
            return res.status(404).json({
                success: false,
                error: 'Dominio no encontrado.'
            });
        }

        res.json({
            success: true,
            sendingDomain: serializeSendingDomain(sendingDomain)
        });
    } catch (error) {
        console.error('Error obteniendo dominio autenticado:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.verifySendingDomain = async (req, res) => {
    try {
        const sendingDomain = await SendingDomain.findOne({
            _id: req.params.id,
            createdBy: req.user.id
        });

        if (!sendingDomain) {
            return res.status(404).json({
                success: false,
                error: 'Dominio no encontrado.'
            });
        }

        const verification = await verifyDnsConfiguration(sendingDomain);
        sendingDomain.verificationStatus = verification.statuses;
        sendingDomain.isVerified = verification.isVerified;
        sendingDomain.isReadyForSending = verification.isReadyForSending;
        sendingDomain.lastVerifiedAt = new Date();
        await sendingDomain.save();

        res.json({
            success: true,
            sendingDomain: serializeSendingDomain(sendingDomain)
        });
    } catch (error) {
        console.error('Error verificando dominio autenticado:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.deleteSendingDomain = async (req, res) => {
    try {
        const sendingDomain = await SendingDomain.findOne({
            _id: req.params.id,
            createdBy: req.user.id
        });

        if (!sendingDomain) {
            return res.status(404).json({
                success: false,
                error: 'Dominio no encontrado.'
            });
        }

        const credentialUsingDomain = await EmailCredential.findOne({
            createdBy: req.user.id,
            sendingDomain: sendingDomain._id
        }).select('_id name');

        if (credentialUsingDomain) {
            return res.status(400).json({
                success: false,
                error: `No puedes eliminar el dominio porque está asociado a la credencial "${credentialUsingDomain.name}".`
            });
        }

        await sendingDomain.deleteOne();

        res.json({
            success: true,
            message: 'Dominio eliminado correctamente.'
        });
    } catch (error) {
        console.error('Error eliminando dominio autenticado:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
