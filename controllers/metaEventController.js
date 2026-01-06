const MetaConfig = require('../models/MetaConfig');
const MetaTagMapping = require('../models/MetaTagMapping');
const Chat = require('../models/Chat');
const metaService = require('../services/metaService');

/**
 * Send manual Meta event from chat interface
 */
exports.sendManualEvent = async (req, res) => {
    try {
        const userId = req.user.id;
        const { chatId, eventName, value, currency } = req.body;

        // Validate required fields
        if (!chatId || !eventName) {
            return res.status(400).json({
                error: 'Chat ID y nombre del evento son requeridos'
            });
        }

        // Validate event name
        const validEvents = ['Purchase', 'Lead', 'Contact', 'Schedule'];
        if (!validEvents.includes(eventName)) {
            return res.status(400).json({
                error: 'Evento inválido. Debe ser: Purchase, Lead, Contact o Schedule'
            });
        }

        // Get Meta configuration
        const config = await MetaConfig.findOne({ userId });
        if (!config) {
            return res.status(400).json({
                error: 'Debes configurar Meta CAPI primero en "Eventos de Meta"'
            });
        }

        // Get chat to retrieve phone number
        const clientId = req.user.clientId;
        const chat = await Chat.findOne({ chatId, clientId });

        if (!chat) {
            return res.status(404).json({ error: 'Chat no encontrado' });
        }

        // Decrypt access token
        const decryptedToken = config.getDecryptedToken();

        // Send event to Meta
        const result = await metaService.sendConversionEvent(
            {
                metaDatasetId: config.metaDatasetId,
                metaAccessToken: decryptedToken,
                metaTestEventCode: config.metaTestEventCode
            },
            {
                eventName,
                phoneNumber: chat.phoneNumber,
                chatId: chat.chatId,
                value: value || null,
                currency: currency || 'USD',
                ctwaClid: chat.ctwa_clid || null // 🔑 Incluir ctwa_clid si existe
            }
        );

        res.json({
            success: true,
            message: 'Evento enviado exitosamente a Meta',
            eventId: result.eventId
        });

    } catch (error) {
        console.error('Error sending manual event:', error);
        res.status(500).json({
            error: 'Error al enviar evento a Meta',
            details: error.error || error.message
        });
    }
};

/**
 * Get all tag-to-event mappings for user
 */
exports.getTagMappings = async (req, res) => {
    try {
        const userId = req.user.id;

        const mappings = await MetaTagMapping.find({ userId }).sort({ createdAt: -1 });

        res.json({ mappings });
    } catch (error) {
        console.error('Error getting tag mappings:', error);
        res.status(500).json({ error: 'Error al obtener mapeos de tags' });
    }
};

/**
 * Create new tag-to-event mapping
 */
exports.createTagMapping = async (req, res) => {
    try {
        const userId = req.user.id;
        const { tagName, eventName, defaultValue, defaultCurrency } = req.body;

        // Validate required fields
        if (!tagName || !eventName) {
            return res.status(400).json({
                error: 'Nombre de tag y evento son requeridos'
            });
        }

        // Validate event name - Meta standard events for business_messaging
        const validEvents = ['Purchase', 'AddToCart', 'InitiateCheckout', 'CompleteRegistration'];
        if (!validEvents.includes(eventName)) {
            return res.status(400).json({
                error: 'Evento inválido. Debe ser: Purchase, AddToCart, InitiateCheckout o CompleteRegistration'
            });
        }

        // Check if mapping already exists
        const existing = await MetaTagMapping.findOne({
            userId,
            tagName: tagName.toLowerCase()
        });

        if (existing) {
            return res.status(400).json({
                error: 'Ya existe un mapeo para esta tag'
            });
        }

        // Create mapping
        const mapping = new MetaTagMapping({
            userId,
            tagName: tagName.toLowerCase(),
            eventName,
            defaultValue: defaultValue || null,
            defaultCurrency: defaultCurrency || 'USD'
        });

        await mapping.save();

        res.status(201).json({
            message: 'Mapeo creado exitosamente',
            mapping
        });
    } catch (error) {
        console.error('Error creating tag mapping:', error);
        res.status(500).json({ error: 'Error al crear mapeo de tag' });
    }
};

/**
 * Delete tag-to-event mapping
 */
exports.deleteTagMapping = async (req, res) => {
    try {
        const userId = req.user.id;
        const { tagName } = req.params;

        const result = await MetaTagMapping.deleteOne({
            userId,
            tagName: tagName.toLowerCase()
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Mapeo no encontrado' });
        }

        res.json({ message: 'Mapeo eliminado exitosamente' });
    } catch (error) {
        console.error('Error deleting tag mapping:', error);
        res.status(500).json({ error: 'Error al eliminar mapeo' });
    }
};
