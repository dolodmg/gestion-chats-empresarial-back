const EmailCredential = require('../models/EmailCredential');
const nodemailer = require('nodemailer');
const SendingDomain = require('../models/SendingDomain');
const { domainMatchesEmail } = require('../services/domainAuthService');

async function resolveSendingDomainForUser(sendingDomainId, userId) {
    if (!sendingDomainId) {
        return null;
    }

    return SendingDomain.findOne({
        _id: sendingDomainId,
        createdBy: userId
    });
}

/**
 * Create new email credential
 */
exports.createCredential = async (req, res) => {
    try {
        const { name, host, port, secure, user, password, fromName, fromEmail, sendingDomainId } = req.body;

        // Validate required fields
        if (!name || !host || !port || !user || !password || !fromName || !fromEmail) {
            return res.status(400).json({
                success: false,
                error: 'Todos los campos son requeridos'
            });
        }

        // Check if credential name already exists for this user
        const existingCredential = await EmailCredential.findOne({
            name,
            createdBy: req.user.id
        });

        if (existingCredential) {
            return res.status(400).json({
                success: false,
                error: 'Ya existe una credencial con este nombre'
            });
        }

        const sendingDomain = await resolveSendingDomainForUser(sendingDomainId, req.user.id);
        if (!sendingDomain) {
            return res.status(400).json({
                success: false,
                error: 'Debes seleccionar un dominio autenticado válido.'
            });
        }

        if (!domainMatchesEmail(fromEmail, sendingDomain.domain)) {
            return res.status(400).json({
                success: false,
                error: `El remitente debe pertenecer al dominio ${sendingDomain.domain}.`
            });
        }

        const credential = new EmailCredential({
            name,
            host,
            port,
            secure: secure || false,
            user,
            password,
            fromName,
            fromEmail,
            sendingDomain: sendingDomain._id,
            createdBy: req.user.id
        });

        await credential.save();

        res.status(201).json({
            success: true,
            credential
        });
    } catch (error) {
        console.error('Error creando credencial:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get all credentials for user
 */
exports.getCredentials = async (req, res) => {
    try {
        const credentials = await EmailCredential.find({
            createdBy: req.user.id
        }).populate('sendingDomain').sort({ createdAt: -1 });

        res.json({
            success: true,
            credentials
        });
    } catch (error) {
        console.error('Error obteniendo credenciales:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Get credential by ID
 */
exports.getCredentialById = async (req, res) => {
    try {
        const credential = await EmailCredential.findOne({
            _id: req.params.id,
            createdBy: req.user.id
        }).populate('sendingDomain');

        if (!credential) {
            return res.status(404).json({
                success: false,
                error: 'Credencial no encontrada'
            });
        }

        res.json({
            success: true,
            credential
        });
    } catch (error) {
        console.error('Error obteniendo credencial:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Update credential
 */
exports.updateCredential = async (req, res) => {
    try {
        const credential = await EmailCredential.findOne({
            _id: req.params.id,
            createdBy: req.user.id
        });

        if (!credential) {
            return res.status(404).json({
                success: false,
                error: 'Credencial no encontrada'
            });
        }

        const { name, host, port, secure, user, password, fromName, fromEmail, isActive, sendingDomainId } = req.body;

        const sendingDomain = sendingDomainId
            ? await resolveSendingDomainForUser(sendingDomainId, req.user.id)
            : credential.sendingDomain
                ? await resolveSendingDomainForUser(credential.sendingDomain, req.user.id)
                : null;

        if (!sendingDomain) {
            return res.status(400).json({
                success: false,
                error: 'Debes asociar la credencial a un dominio autenticado válido.'
            });
        }

        const nextFromEmail = fromEmail || credential.fromEmail;
        if (!domainMatchesEmail(nextFromEmail, sendingDomain.domain)) {
            return res.status(400).json({
                success: false,
                error: `El remitente debe pertenecer al dominio ${sendingDomain.domain}.`
            });
        }

        if (name) credential.name = name;
        if (host) credential.host = host;
        if (port) credential.port = port;
        if (typeof secure !== 'undefined') credential.secure = secure;
        if (user) credential.user = user;
        if (password) credential.password = password; // Will be encrypted by pre-save hook
        if (fromName) credential.fromName = fromName;
        if (fromEmail) credential.fromEmail = fromEmail;
        credential.sendingDomain = sendingDomain._id;
        if (typeof isActive !== 'undefined') credential.isActive = isActive;

        await credential.save();

        res.json({
            success: true,
            credential
        });
    } catch (error) {
        console.error('Error actualizando credencial:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Delete credential
 */
exports.deleteCredential = async (req, res) => {
    try {
        const credential = await EmailCredential.findOneAndDelete({
            _id: req.params.id,
            createdBy: req.user.id
        });

        if (!credential) {
            return res.status(404).json({
                success: false,
                error: 'Credencial no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Credencial eliminada correctamente'
        });
    } catch (error) {
        console.error('Error eliminando credencial:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Test SMTP connection
 */
exports.testCredential = async (req, res) => {
    try {
        const { host, port, secure, user, password, fromEmail, sendingDomainId } = req.body;

        // If testing existing credential
        if (req.params.id) {
            const credential = await EmailCredential.findOne({
                _id: req.params.id,
                createdBy: req.user.id
            });

            if (!credential) {
                return res.status(404).json({
                    success: false,
                    error: 'Credencial no encontrada'
                });
            }

            // Note: We can't decrypt bcrypt hash, so we'll need the original password
            // For existing credentials, we'll just verify the config is valid
            return res.status(400).json({
                success: false,
                error: 'Para probar una credencial existente, proporciona la contraseña'
            });
        }

        // Test new credential
        if (!host || !port || !user || !password) {
            return res.status(400).json({
                success: false,
                error: 'Host, puerto, usuario y contraseña son requeridos'
            });
        }

        if (sendingDomainId) {
            const sendingDomain = await resolveSendingDomainForUser(sendingDomainId, req.user.id);
            if (!sendingDomain) {
                return res.status(400).json({
                    success: false,
                    error: 'Dominio autenticado inválido.'
                });
            }

            if (fromEmail && !domainMatchesEmail(fromEmail, sendingDomain.domain)) {
                return res.status(400).json({
                    success: false,
                    error: `El remitente debe pertenecer al dominio ${sendingDomain.domain}.`
                });
            }
        }

        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: secure || false,
            auth: {
                user,
                pass: password
            }
        });

        await transporter.verify();

        res.json({
            success: true,
            message: 'Conexión SMTP exitosa'
        });
    } catch (error) {
        console.error('Error probando conexión:', error);
        res.status(400).json({
            success: false,
            error: `Error de conexión: ${error.message}`
        });
    }
};
