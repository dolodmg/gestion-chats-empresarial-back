const Campaign = require('../models/Campaign');
const EmailCredential = require('../models/EmailCredential');
const EmailService = require('../services/emailService');

const emailService = new EmailService();

/**
 * Crear nueva campaña
 */
exports.createCampaign = async (req, res) => {
    try {
        const { name, subject, htmlContent, textContent, recipients, emailCredentialId } = req.body;

        // Validar campos requeridos
        if (!name || !subject || !htmlContent || !emailCredentialId) {
            return res.status(400).json({
                success: false,
                error: 'Nombre, asunto, contenido HTML y credencial de email son requeridos'
            });
        }

        // Verificar que la credencial existe y pertenece al usuario
        const credential = await EmailCredential.findOne({
            _id: emailCredentialId,
            createdBy: req.user.id,
            isActive: true
        });

        if (!credential) {
            return res.status(404).json({
                success: false,
                error: 'Credencial de email no encontrada o inactiva'
            });
        }

        const campaign = new Campaign({
            name,
            subject,
            htmlContent,
            textContent: textContent || htmlContent.replace(/<[^>]*>/g, ''), // Extraer texto del HTML
            recipients: recipients || [],
            createdBy: req.user.id,
            emailCredential: emailCredentialId,
            totalRecipients: recipients ? recipients.length : 0
        });

        await campaign.save();

        res.status(201).json({
            success: true,
            campaign
        });
    } catch (error) {
        console.error('Error creando campaña:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Obtener todas las campañas del usuario
 */
exports.getCampaigns = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const query = { createdBy: req.user.id };
        if (status) {
            query.status = status;
        }

        const campaigns = await Campaign.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .select('-recipients'); // No incluir destinatarios en la lista

        const total = await Campaign.countDocuments(query);

        res.json({
            success: true,
            campaigns,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error obteniendo campañas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Obtener campaña por ID
 */
exports.getCampaignById = async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            createdBy: req.user.id
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaña no encontrada'
            });
        }

        res.json({
            success: true,
            campaign
        });
    } catch (error) {
        console.error('Error obteniendo campaña:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Actualizar campaña (solo si está en draft)
 */
exports.updateCampaign = async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            createdBy: req.user.id
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaña no encontrada'
            });
        }

        if (campaign.status !== 'draft') {
            return res.status(400).json({
                success: false,
                error: 'Solo se pueden editar campañas en borrador'
            });
        }

        const { name, subject, htmlContent, textContent } = req.body;

        if (name) campaign.name = name;
        if (subject) campaign.subject = subject;
        if (htmlContent) {
            campaign.htmlContent = htmlContent;
            campaign.textContent = textContent || htmlContent.replace(/<[^>]*>/g, '');
        }

        await campaign.save();

        res.json({
            success: true,
            campaign
        });
    } catch (error) {
        console.error('Error actualizando campaña:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Eliminar campaña
 */
exports.deleteCampaign = async (req, res) => {
    try {
        const campaign = await Campaign.findOneAndDelete({
            _id: req.params.id,
            createdBy: req.user.id
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaña no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Campaña eliminada correctamente'
        });
    } catch (error) {
        console.error('Error eliminando campaña:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Agregar destinatarios a una campaña
 */
exports.addRecipients = async (req, res) => {
    try {
        const { recipients } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere un array de destinatarios'
            });
        }

        const campaign = await Campaign.findOne({
            _id: req.params.id,
            createdBy: req.user.id
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaña no encontrada'
            });
        }

        if (campaign.status !== 'draft') {
            return res.status(400).json({
                success: false,
                error: 'Solo se pueden agregar destinatarios a campañas en borrador'
            });
        }

        // Validar y normalizar emails
        const validRecipients = recipients
            .filter(r => r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
            .map(r => ({
                email: r.email.toLowerCase().trim(),
                name: r.name ? r.name.trim() : '',
                status: 'pending'
            }));

        if (validRecipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No se encontraron emails válidos'
            });
        }

        const addedCount = campaign.addRecipients(validRecipients);
        await campaign.save();

        res.json({
            success: true,
            message: `${addedCount} destinatarios agregados (${recipients.length - addedCount} duplicados omitidos)`,
            totalRecipients: campaign.totalRecipients
        });
    } catch (error) {
        console.error('Error agregando destinatarios:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Parsear CSV y extraer emails
 */
exports.parseCSV = async (req, res) => {
    try {
        const { csvContent } = req.body;

        if (!csvContent) {
            return res.status(400).json({
                success: false,
                error: 'Contenido CSV requerido'
            });
        }

        // Parsear CSV simple - solo emails, uno por línea
        const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
        const recipients = [];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Validar que sea un email válido
            if (emailRegex.test(line.toLowerCase())) {
                recipients.push({
                    email: line.toLowerCase(),
                    name: ''
                });
            }
        }

        res.json({
            success: true,
            recipients,
            count: recipients.length
        });
    } catch (error) {
        console.error('Error parseando CSV:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Enviar campaña
 */
exports.sendCampaign = async (req, res) => {
    try {
        const campaign = await Campaign.findOne({
            _id: req.params.id,
            createdBy: req.user.id
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaña no encontrada'
            });
        }

        if (campaign.recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'La campaña no tiene destinatarios'
            });
        }

        if (campaign.status === 'sending') {
            return res.status(400).json({
                success: false,
                error: 'La campaña ya se está enviando'
            });
        }

        // Cambiar estado a "sending"
        campaign.status = 'sending';
        campaign.sentAt = new Date();
        await campaign.save();

        // Enviar respuesta inmediata
        res.json({
            success: true,
            message: 'Campaña en proceso de envío',
            campaign: {
                id: campaign._id,
                status: campaign.status,
                totalRecipients: campaign.totalRecipients
            }
        });

        // Enviar emails en background
        sendCampaignEmails(campaign._id);

    } catch (error) {
        console.error('Error enviando campaña:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Función auxiliar para enviar emails en background
 */
async function sendCampaignEmails(campaignId) {
    try {
        const campaign = await Campaign.findById(campaignId).populate('emailCredential');
        if (!campaign) return;

        if (!campaign.emailCredential) {
            console.error('❌ Campaña sin credencial de email configurada');
            campaign.status = 'failed';
            await campaign.save();
            return;
        }

        console.log(`📧 Iniciando envío de campaña: ${campaign.name} (${campaign.recipients.length} destinatarios)`);
        console.log(`📧 Usando credencial: ${campaign.emailCredential.name}`);

        // Note: We need to store the password in a way we can retrieve it
        // For now, we'll use the default transporter if credential password is hashed
        // In production, consider using encryption instead of hashing for passwords

        // Create transporter from credential
        // Since password is hashed, we'll need to handle this differently
        // For now, use default transporter
        const decryptedPassword = campaign.emailCredential.getDecryptedPassword();
        if (!decryptedPassword) {
            console.error('Error: No se pudo desencriptar la contraseña');
            campaign.status = 'failed';
            await campaign.save();
            return;
        }
        const transporter = emailService.createTransporterFromCredential(campaign.emailCredential, decryptedPassword);
        console.log(`Transporter creado para: ${campaign.emailCredential.user}`);

        // Enviar emails con delay para evitar rate limiting
        for (let i = 0; i < campaign.recipients.length; i++) {
            const recipient = campaign.recipients[i];

            if (recipient.status !== 'pending') continue;

            try {
                await emailService.sendCampaignEmail({
                    to: recipient.email,
                    subject: campaign.subject,
                    html: campaign.htmlContent,
                    text: campaign.textContent,
                    recipientName: recipient.name,
                    transporter: transporter,
                    fromName: campaign.emailCredential.fromName,
                    fromEmail: campaign.emailCredential.fromEmail
                });

                recipient.status = 'sent';
                recipient.sentAt = new Date();
                console.log(`✅ Email enviado a ${recipient.email}`);

            } catch (error) {
                recipient.status = 'failed';
                recipient.error = error.message;
                console.error(`❌ Error enviando a ${recipient.email}:`, error.message);
            }

            // Guardar progreso cada 10 emails
            if ((i + 1) % 10 === 0) {
                campaign.updateCounts();
                await campaign.save();
            }

            // Delay de 500ms entre emails para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Actualizar estado final
        campaign.updateCounts();
        await campaign.save();

        console.log(`✅ Campaña completada: ${campaign.sentCount} enviados, ${campaign.failedCount} fallidos`);

    } catch (error) {
        console.error('Error en envío de campaña:', error);

        // Marcar campaña como fallida
        const campaign = await Campaign.findById(campaignId);
        if (campaign) {
            campaign.status = 'failed';
            await campaign.save();
        }
    }
}

/**
 * Obtener estadísticas de campañas
 */
exports.getStats = async (req, res) => {
    try {
        const stats = await Campaign.aggregate([
            { $match: { createdBy: req.user._id } },
            {
                $group: {
                    _id: null,
                    totalCampaigns: { $sum: 1 },
                    totalSent: { $sum: '$sentCount' },
                    totalFailed: { $sum: '$failedCount' },
                    totalRecipients: { $sum: '$totalRecipients' }
                }
            }
        ]);

        const statusCounts = await Campaign.aggregate([
            { $match: { createdBy: req.user._id } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            stats: stats[0] || {
                totalCampaigns: 0,
                totalSent: 0,
                totalFailed: 0,
                totalRecipients: 0
            },
            statusCounts: statusCounts.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {})
        });
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
