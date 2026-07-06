const WhatsAppCampaign = require('../models/WhatsAppCampaign');
const WhatsAppTemplate = require('../models/WhatsAppTemplate');
const WhatsAppService = require('../services/whatsappService');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const UserTag = require('../models/UserTags');
const sseService = require('../services/sseService');

const WHATSAPP_CAMPAIGN_TAG_COLOR = '#2563eb';

function hasRealContactName(value, phoneNumber) {
    const normalizedValue = String(value || '').trim();
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    if (!normalizedValue || normalizedValue === 'Usuario Prueba') {
        return false;
    }

    return normalizePhoneNumber(normalizedValue) !== normalizedPhone;
}

function getClientIdFromRequest(req) {
    return req.user.role === 'admin'
        ? req.query.clientId || req.body.clientId
        : req.user.clientId;
}

function normalizePhoneNumber(value) {
    return String(value || '').replace(/\D/g, '');
}

function extractBodyPreview(template) {
    const bodyComponent = template.components.find(component => component.type === 'BODY');
    return bodyComponent?.text || '';
}

function getBodyParameterCount(template) {
    const bodyText = extractBodyPreview(template);
    const matches = bodyText.match(/\{\{(\d+)\}\}/g);
    return matches ? matches.length : 0;
}

function buildTemplateComponents(parameters = []) {
    if (!parameters.length) {
        return [];
    }

    return [{
        type: 'body',
        parameters: parameters.map(parameter => ({
            type: 'text',
            text: String(parameter || '')
        }))
    }];
}

function parseRecipientsFromCsv(csvContent) {
    const lines = String(csvContent || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (!lines.length) {
        return [];
    }

    const headerCandidates = lines[0].split(',').map(part => part.trim().toLowerCase());
    const phoneHeaderIndex = headerCandidates.findIndex(header =>
        ['telefono', 'tel', 'phone', 'telefono_whatsapp', 'whatsapp', 'numero', 'numero_telefono'].includes(header)
    );
    const nameHeaderIndex = headerCandidates.findIndex(header =>
        ['nombre', 'name', 'full_name'].includes(header)
    );

    const hasHeader = phoneHeaderIndex >= 0;
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const recipients = [];

    for (const line of dataLines) {
        const parts = line.split(',').map(part => part.trim().replace(/^"|"$/g, ''));
        const rawPhone = hasHeader
            ? parts[phoneHeaderIndex]
            : parts[0];
        const rawName = hasHeader && nameHeaderIndex >= 0
            ? parts[nameHeaderIndex]
            : (parts[1] || '');
        const phoneNumber = normalizePhoneNumber(rawPhone);

        if (!phoneNumber || phoneNumber.length < 8) {
            continue;
        }

        recipients.push({
            phoneNumber,
            name: rawName || '',
            status: 'pending'
        });
    }

    return recipients;
}

async function loadCampaignForUser(req, campaignId) {
    const filter = { _id: campaignId };

    if (req.user.role !== 'admin') {
        filter.createdBy = req.user.id;
    }

    const clientId = getClientIdFromRequest(req);
    if (clientId) {
        filter.clientId = clientId;
    }

    return WhatsAppCampaign.findOne(filter).populate('template');
}

async function findClientUser(clientId) {
    return User.findOne({ clientId, role: 'client' });
}

async function ensureUserTag(userId, tagName, color) {
    let userTags = await UserTag.findOne({ userId });

    if (!userTags) {
        userTags = await UserTag.create({
            userId,
            tags: []
        });
    }

    const normalizedTagName = String(tagName).trim().toLowerCase();
    let tag = userTags.tags.find(item => item.name === normalizedTagName);

    if (!tag) {
        userTags.tags.push({
            name: normalizedTagName,
            color
        });
        await userTags.save();
        tag = userTags.tags[userTags.tags.length - 1];
    }

    return tag;
}

function buildCampaignTagName(campaignName) {
    return `campaña: ${String(campaignName || '').trim()}`.toLowerCase();
}

function buildCampaignPreview(campaign) {
    const preview = String(campaign.bodyPreview || '').trim();
    if (preview) {
        return preview;
    }

    return `Campaña enviada: ${String(campaign.name || '').trim()}`;
}

async function markCampaignChatForHumanControl(campaign, recipient) {
    const phoneNumber = normalizePhoneNumber(recipient.phoneNumber);

    if (!phoneNumber) {
        return null;
    }

    const campaignTagName = buildCampaignTagName(campaign.name);
    const clientUser = await findClientUser(campaign.clientId);

    if (clientUser) {
        await ensureUserTag(clientUser._id, campaignTagName, WHATSAPP_CAMPAIGN_TAG_COLOR);
    }

    let chat = await Chat.findOne({
        clientId: campaign.clientId,
        $or: [
            { phoneNumber },
            { chatId: phoneNumber }
        ]
    });

    const now = new Date();
    const lastMessage = buildCampaignPreview(campaign);
    const contactName = String(recipient.name || '').trim() || phoneNumber;

    if (!chat) {
        chat = new Chat({
            chatId: phoneNumber,
            clientId: campaign.clientId,
            phoneNumber,
            contactName,
            lastMessage,
            lastMessageTimestamp: now,
            unreadCount: 0,
            chatStatus: 'human',
            statusChangeTime: now,
            manualControlLocked: true,
            tags: [campaignTagName],
            lastOpenedAt: null
        });
    } else {
        if (!hasRealContactName(chat.contactName, phoneNumber) && hasRealContactName(contactName, phoneNumber)) {
            chat.contactName = contactName;
        }
        chat.lastMessage = lastMessage;
        chat.lastMessageTimestamp = now;
        chat.chatStatus = 'human';
        chat.statusChangeTime = now;
        chat.manualControlLocked = true;

        if (!chat.tags.includes(campaignTagName)) {
            chat.tags.push(campaignTagName);
        }
    }

    await chat.save();

    const insertedMessage = await Message.collection.insertOne({
        chatId: chat.chatId,
        clientId: chat.clientId,
        sender: 'bot',
        content: lastMessage,
        timestamp: now,
        status: 'sent',
        phoneNumber: chat.phoneNumber,
        contactName: chat.contactName,
        source: 'whatsapp_campaign',
        campaignId: campaign._id.toString(),
        whatsAppMessageId: recipient.whatsAppMessageId || null
    });

    sseService.notifyChatStatusChange(
        chat.chatId,
        chat.clientId,
        chat.chatStatus,
        chat.statusChangeTime,
        Boolean(chat.manualControlLocked)
    );

    sseService.notifyNewMessage({
        chatId: chat.chatId,
        clientId: chat.clientId,
        sender: 'bot',
        content: lastMessage,
        timestamp: now,
        phoneNumber: chat.phoneNumber,
        id: String(insertedMessage.insertedId),
        source: 'whatsapp_campaign'
    });

    sseService.notifyChatUpdate({
        chatId: chat.chatId,
        clientId: chat.clientId,
        phoneNumber: chat.phoneNumber,
        contactName: chat.contactName,
        lastMessage: chat.lastMessage,
        lastMessageTimestamp: chat.lastMessageTimestamp,
        chatStatus: chat.chatStatus,
        statusChangeTime: chat.statusChangeTime,
        manualControlLocked: Boolean(chat.manualControlLocked),
        tags: chat.tags
    });

    return chat;
}

exports.createCampaign = async (req, res) => {
    try {
        const { name, templateId, parameters = [], recipients = [] } = req.body;
        const clientId = getClientIdFromRequest(req);

        if (!clientId) {
            return res.status(400).json({ success: false, error: 'Se requiere clientId' });
        }

        if (!name || !templateId) {
            return res.status(400).json({
                success: false,
                error: 'Nombre y plantilla son requeridos'
            });
        }

        const template = await WhatsAppTemplate.findOne({
            _id: templateId,
            clientId
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                error: 'Plantilla no encontrada'
            });
        }

        if (!template.canBeSent()) {
            return res.status(400).json({
                success: false,
                error: 'La plantilla debe estar aprobada para poder usarse en campañas'
            });
        }

        const expectedParameterCount = getBodyParameterCount(template);
        if (expectedParameterCount !== parameters.length) {
            return res.status(400).json({
                success: false,
                error: `La plantilla requiere ${expectedParameterCount} parámetro(s) de body`
            });
        }

        const validRecipients = Array.isArray(recipients)
            ? recipients
                .map(recipient => ({
                    phoneNumber: normalizePhoneNumber(recipient.phoneNumber),
                    name: String(recipient.name || '').trim(),
                    status: 'pending'
                }))
                .filter(recipient => recipient.phoneNumber && recipient.phoneNumber.length >= 8)
            : [];

        const uniqueRecipients = validRecipients.filter((recipient, index, array) =>
            array.findIndex(item => item.phoneNumber === recipient.phoneNumber) === index
        );

        const campaign = new WhatsAppCampaign({
            name: String(name).trim(),
            template: template._id,
            templateName: template.name,
            templateLanguage: template.language,
            templateCategory: template.category,
            bodyPreview: extractBodyPreview(template),
            parameters: parameters.map(parameter => String(parameter || '')),
            recipients: uniqueRecipients,
            totalRecipients: uniqueRecipients.length,
            createdBy: req.user.id,
            clientId
        });

        await campaign.save();

        res.status(201).json({
            success: true,
            campaign
        });
    } catch (error) {
        console.error('Error creando campaña de WhatsApp:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getCampaigns = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = {};
        const clientId = getClientIdFromRequest(req);

        console.log('[whatsapp-campaigns.getCampaigns] request', {
            userId: req.user?.id,
            role: req.user?.role,
            clientId,
            status,
            page,
            limit
        });

        if (req.user.role !== 'admin') {
            query.createdBy = req.user.id;
        }

        if (clientId) {
            query.clientId = clientId;
        }

        if (status) {
            query.status = status;
        }

        const campaigns = await WhatsAppCampaign.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit, 10))
            .skip((parseInt(page, 10) - 1) * parseInt(limit, 10))
            .select('-recipients')
            .populate('template', 'name status category language');

        const total = await WhatsAppCampaign.countDocuments(query);

        console.log('[whatsapp-campaigns.getCampaigns] success', {
            query,
            count: campaigns.length,
            total
        });

        res.json({
            success: true,
            campaigns,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total,
                pages: Math.ceil(total / parseInt(limit, 10))
            }
        });
    } catch (error) {
        console.error('Error obteniendo campañas de WhatsApp:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getCampaignById = async (req, res) => {
    try {
        const campaign = await loadCampaignForUser(req, req.params.id);

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
        console.error('Error obteniendo campaña de WhatsApp:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.updateCampaign = async (req, res) => {
    try {
        const { name, parameters } = req.body;
        const campaign = await loadCampaignForUser(req, req.params.id);

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

        if (typeof name === 'string' && name.trim()) {
            campaign.name = name.trim();
        }

        if (Array.isArray(parameters)) {
            const expectedParameterCount = getBodyParameterCount(campaign.template);
            if (expectedParameterCount !== parameters.length) {
                return res.status(400).json({
                    success: false,
                    error: `La plantilla requiere ${expectedParameterCount} parámetro(s) de body`
                });
            }

            campaign.parameters = parameters.map(parameter => String(parameter || ''));
        }

        await campaign.save();

        res.json({
            success: true,
            campaign
        });
    } catch (error) {
        console.error('Error actualizando campaña de WhatsApp:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.deleteCampaign = async (req, res) => {
    try {
        const filter = { _id: req.params.id };
        const clientId = getClientIdFromRequest(req);

        if (req.user.role !== 'admin') {
            filter.createdBy = req.user.id;
        }

        if (clientId) {
            filter.clientId = clientId;
        }

        const campaign = await WhatsAppCampaign.findOneAndDelete(filter);

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
        console.error('Error eliminando campaña de WhatsApp:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.addRecipients = async (req, res) => {
    try {
        const { recipients } = req.body;
        const campaign = await loadCampaignForUser(req, req.params.id);

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

        if (!Array.isArray(recipients) || !recipients.length) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere un array de destinatarios'
            });
        }

        const validRecipients = recipients
            .map(recipient => ({
                phoneNumber: normalizePhoneNumber(recipient.phoneNumber),
                name: String(recipient.name || '').trim(),
                status: 'pending'
            }))
            .filter(recipient => recipient.phoneNumber && recipient.phoneNumber.length >= 8);

        if (!validRecipients.length) {
            return res.status(400).json({
                success: false,
                error: 'No se encontraron teléfonos válidos'
            });
        }

        const addedCount = campaign.addRecipients(validRecipients);
        await campaign.save();

        res.json({
            success: true,
            message: `${addedCount} destinatarios agregados`,
            totalRecipients: campaign.totalRecipients
        });
    } catch (error) {
        console.error('Error agregando destinatarios a campaña de WhatsApp:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.parseCSV = async (req, res) => {
    try {
        const { csvContent } = req.body;

        if (!csvContent) {
            return res.status(400).json({
                success: false,
                error: 'Contenido CSV requerido'
            });
        }

        const recipients = parseRecipientsFromCsv(csvContent);

        res.json({
            success: true,
            recipients,
            count: recipients.length
        });
    } catch (error) {
        console.error('Error parseando CSV de WhatsApp:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.sendCampaign = async (req, res) => {
    try {
        const campaign = await loadCampaignForUser(req, req.params.id);

        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaña no encontrada'
            });
        }

        if (!campaign.recipients.length) {
            return res.status(400).json({
                success: false,
                error: 'La campaña no tiene destinatarios'
            });
        }

        if (campaign.status === 'sending') {
            return res.status(400).json({
                success: false,
                error: 'La campaña ya está en proceso de envío'
            });
        }

        campaign.status = 'sending';
        campaign.startedAt = new Date();
        await campaign.save();

        res.json({
            success: true,
            message: 'Campaña de WhatsApp en proceso de envío',
            campaign: {
                id: campaign._id,
                status: campaign.status,
                totalRecipients: campaign.totalRecipients
            }
        });

        sendWhatsAppCampaign(campaign._id).catch(error => {
            console.error('Error en background enviando campaña de WhatsApp:', error);
        });
    } catch (error) {
        console.error('Error enviando campaña de WhatsApp:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

async function sendWhatsAppCampaign(campaignId) {
    const campaign = await WhatsAppCampaign.findById(campaignId).populate('template');
    if (!campaign) {
        return;
    }

    const components = buildTemplateComponents(campaign.parameters);

    for (const recipient of campaign.recipients) {
        if (recipient.status !== 'pending') {
            continue;
        }

        try {
            const response = await WhatsAppService.sendTemplateMessage(
                campaign.clientId,
                recipient.phoneNumber,
                campaign.templateName,
                campaign.templateLanguage,
                components
            );

            const messageId = response?.messages?.[0]?.id || null;
            recipient.status = 'sent';
            recipient.sentAt = new Date();
            recipient.lastStatusAt = new Date();
            recipient.whatsAppMessageId = messageId;
            recipient.error = '';

            try {
                await markCampaignChatForHumanControl(campaign, recipient);
            } catch (postSendError) {
                console.error('Error marcando chat de campaña en control humano:', {
                    campaignId: String(campaign._id),
                    phoneNumber: recipient.phoneNumber,
                    error: postSendError.message
                });
            }
        } catch (error) {
            recipient.status = 'failed';
            recipient.failedAt = new Date();
            recipient.lastStatusAt = new Date();
            recipient.error = error.response?.data?.error?.message || error.message;
        }
    }

    campaign.updateCounts();
    await campaign.save();
}

exports.getStats = async (req, res) => {
    try {
        const clientId = getClientIdFromRequest(req);
        const query = {};

        console.log('[whatsapp-campaigns.getStats] request', {
            userId: req.user?.id,
            role: req.user?.role,
            clientId
        });

        if (req.user.role !== 'admin') {
            query.createdBy = req.user.id;
        }

        if (clientId) {
            query.clientId = clientId;
        }

        const campaigns = await WhatsAppCampaign.find(query).select(
            'totalRecipients sentCount deliveredCount readCount failedCount'
        );

        const stats = campaigns.reduce((accumulator, campaign) => {
            accumulator.totalCampaigns += 1;
            accumulator.totalRecipients += campaign.totalRecipients || 0;
            accumulator.totalSent += campaign.sentCount || 0;
            accumulator.totalDelivered += campaign.deliveredCount || 0;
            accumulator.totalRead += campaign.readCount || 0;
            accumulator.totalFailed += campaign.failedCount || 0;
            return accumulator;
        }, {
            totalCampaigns: 0,
            totalRecipients: 0,
            totalSent: 0,
            totalDelivered: 0,
            totalRead: 0,
            totalFailed: 0
        });

        res.json({
            success: true,
            stats
        });
        console.log('[whatsapp-campaigns.getStats] success', {
            query,
            stats
        });
    } catch (error) {
        console.error('Error obteniendo estadísticas de campañas de WhatsApp:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.handleWebhookVerification = async (req, res) => {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && verifyToken && token === verifyToken) {
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
};

function applyMetaStatus(recipient, status, errorText) {
    const timestamp = new Date();
    recipient.lastStatusAt = timestamp;

    if (status === 'sent') {
        recipient.status = 'sent';
        recipient.sentAt = recipient.sentAt || timestamp;
        return;
    }

    if (status === 'delivered') {
        recipient.status = 'delivered';
        recipient.deliveredAt = timestamp;
        recipient.sentAt = recipient.sentAt || timestamp;
        return;
    }

    if (status === 'read') {
        recipient.status = 'read';
        recipient.readAt = timestamp;
        recipient.deliveredAt = recipient.deliveredAt || timestamp;
        recipient.sentAt = recipient.sentAt || timestamp;
        return;
    }

    if (status === 'failed') {
        recipient.status = 'failed';
        recipient.failedAt = timestamp;
        recipient.error = errorText || 'Meta reportó el envío como fallido';
        return;
    }
}

exports.handleWebhookEvent = async (req, res) => {
    try {
        const statuses = [];
        const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];

        for (const entry of entries) {
            const changes = Array.isArray(entry?.changes) ? entry.changes : [];
            for (const change of changes) {
                const changeStatuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
                statuses.push(...changeStatuses);
            }
        }

        for (const statusEvent of statuses) {
            const messageId = statusEvent?.id;
            const status = statusEvent?.status;

            if (!messageId || !status) {
                continue;
            }

            const campaign = await WhatsAppCampaign.findOne({
                'recipients.whatsAppMessageId': messageId
            });

            if (!campaign) {
                continue;
            }

            const recipient = campaign.recipients.find(item => item.whatsAppMessageId === messageId);
            if (!recipient) {
                continue;
            }

            const errorText = Array.isArray(statusEvent?.errors) && statusEvent.errors.length
                ? statusEvent.errors.map(error => error.title || error.message || error.code).filter(Boolean).join(', ')
                : '';

            applyMetaStatus(recipient, status, errorText);
            campaign.updateCounts();
            await campaign.save();
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error procesando webhook de campañas de WhatsApp:', error);
        res.sendStatus(500);
    }
};
