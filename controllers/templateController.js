const WhatsAppTemplate = require('../models/WhatsAppTemplate');
const WhatsAppService = require('../services/whatsappService');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const { logAction } = require('../services/auditService');

/**
 * Crear una nueva plantilla
 */
exports.createTemplate = async (req, res) => {
    try {
        const { name, category, language, components } = req.body;
        const clientId = req.user.role === 'admin'
            ? req.body.clientId
            : req.user.clientId;

        if (!clientId) {
            return res.status(400).json({ msg: 'Se requiere clientId' });
        }

        // Validar campos requeridos
        if (!name || !category || !language || !components) {
            return res.status(400).json({
                msg: 'Faltan campos requeridos: name, category, language, components'
            });
        }

        // Obtener WABA ID del cliente
        const user = await User.findOne({ clientId, role: 'client' }).select('wabaId');
        if (!user || !user.wabaId) {
            return res.status(400).json({
                msg: 'Cliente no tiene WABA ID configurado. Contacte al administrador.'
            });
        }

        const wabaId = user.wabaId;

        // Verificar si ya existe una plantilla con el mismo nombre y lenguaje
        const existingTemplate = await WhatsAppTemplate.findOne({
            clientId,
            name,
            language
        });

        if (existingTemplate) {
            return res.status(400).json({
                msg: `Ya existe una plantilla con el nombre "${name}" en idioma ${language}`
            });
        }

        // Preparar datos para Facebook API
        const templateData = {
            name,
            category,
            language,
            components: components.map(comp => {
                const component = { type: comp.type };

                if (comp.format) component.format = comp.format;
                if (comp.text) component.text = comp.text;
                if (comp.example) component.example = comp.example;
                if (comp.buttons) component.buttons = comp.buttons;

                return component;
            })
        };

        // Crear plantilla en Facebook
        let facebookResponse;
        try {
            facebookResponse = await WhatsAppService.createTemplate(clientId, wabaId, templateData);
        } catch (fbError) {
            console.error('Error de Facebook API:', fbError);
            return res.status(500).json({
                msg: 'Error al crear plantilla en Facebook',
                error: fbError.response?.data || fbError.message
            });
        }

        // Guardar plantilla en base de datos local
        const template = new WhatsAppTemplate({
            clientId,
            wabaId,
            templateId: facebookResponse.id,
            name,
            category,
            language,
            status: facebookResponse.status || 'PENDING',
            components
        });

        await template.save();

        res.status(201).json({
            msg: 'Plantilla creada exitosamente',
            template,
            facebookResponse
        });
    } catch (error) {
        console.error('Error en createTemplate:', error);
        res.status(500).json({
            msg: 'Error del servidor',
            error: error.message
        });
    }
};

/**
 * Obtener todas las plantillas del cliente
 */
exports.getTemplates = async (req, res) => {
    try {
        const clientId = req.user.role === 'admin'
            ? req.query.clientId
            : req.user.clientId;

        if (!clientId) {
            return res.status(400).json({ msg: 'Se requiere clientId' });
        }

        const { status, category, language } = req.query;

        // Construir filtro
        const filter = { clientId };
        if (status) filter.status = status;
        if (category) filter.category = category;
        if (language) filter.language = language;

        const templates = await WhatsAppTemplate.find(filter)
            .sort({ createdAt: -1 });

        res.json({
            count: templates.length,
            templates
        });
    } catch (error) {
        console.error('Error en getTemplates:', error);
        res.status(500).json({
            msg: 'Error del servidor',
            error: error.message
        });
    }
};

/**
 * Obtener una plantilla específica por ID
 */
exports.getTemplateById = async (req, res) => {
    try {
        const { id } = req.params;
        const clientId = req.user.role === 'admin'
            ? req.query.clientId
            : req.user.clientId;

        const template = await WhatsAppTemplate.findOne({ _id: id, clientId });

        if (!template) {
            return res.status(404).json({ msg: 'Plantilla no encontrada' });
        }

        res.json(template);
    } catch (error) {
        console.error('Error en getTemplateById:', error);
        res.status(500).json({
            msg: 'Error del servidor',
            error: error.message
        });
    }
};

/**
 * Eliminar una plantilla
 */
exports.deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const clientId = req.user.role === 'admin'
            ? req.query.clientId || req.body.clientId
            : req.user.clientId;

        if (!clientId) {
            return res.status(400).json({ msg: 'Se requiere clientId' });
        }

        // Buscar plantilla
        const template = await WhatsAppTemplate.findOne({ _id: id, clientId });

        if (!template) {
            return res.status(404).json({ msg: 'Plantilla no encontrada' });
        }

        // Eliminar de Facebook
        try {
            await WhatsAppService.deleteTemplate(clientId, template.wabaId, template.name);
        } catch (fbError) {
            console.error('Error al eliminar de Facebook:', fbError);
            // Continuar con la eliminación local aunque falle en Facebook
        }

        // Eliminar de base de datos local
        await WhatsAppTemplate.deleteOne({ _id: id });

        res.json({
            msg: 'Plantilla eliminada exitosamente',
            templateName: template.name
        });
    } catch (error) {
        console.error('Error en deleteTemplate:', error);
        res.status(500).json({
            msg: 'Error del servidor',
            error: error.message
        });
    }
};

/**
 * Sincronizar plantillas con Facebook API
 */
exports.syncTemplates = async (req, res) => {
    try {
        const clientId = req.user.role === 'admin'
            ? req.query.clientId || req.body.clientId
            : req.user.clientId;

        if (!clientId) {
            return res.status(400).json({ msg: 'Se requiere clientId' });
        }

        // Obtener WABA ID
        const user = await User.findOne({ clientId, role: 'client' }).select('wabaId');

        if (!user || !user.wabaId) {
            return res.status(400).json({
                msg: 'Cliente no tiene WABA ID configurado'
            });
        }

        const wabaId = user.wabaId;

        // Obtener plantillas de Facebook
        const facebookTemplates = await WhatsAppService.listTemplates(clientId, wabaId);

        if (!facebookTemplates.data) {
            return res.status(500).json({ msg: 'Error al obtener plantillas de Facebook' });
        }

        // Actualizar plantillas locales
        let syncedCount = 0;
        let createdCount = 0;

        for (const fbTemplate of facebookTemplates.data) {
            const existingTemplate = await WhatsAppTemplate.findOne({
                clientId,
                name: fbTemplate.name,
                language: fbTemplate.language
            });

            if (existingTemplate) {
                // Actualizar estado
                existingTemplate.status = fbTemplate.status;
                existingTemplate.templateId = fbTemplate.id;
                existingTemplate.rejectionReason = fbTemplate.rejected_reason || null;
                await existingTemplate.save();
                syncedCount++;
            } else {
                // Crear nueva plantilla local
                const newTemplate = new WhatsAppTemplate({
                    clientId,
                    wabaId,
                    templateId: fbTemplate.id,
                    name: fbTemplate.name,
                    category: fbTemplate.category,
                    language: fbTemplate.language,
                    status: fbTemplate.status,
                    components: fbTemplate.components || [],
                    rejectionReason: fbTemplate.rejected_reason || null
                });
                await newTemplate.save();
                createdCount++;
            }
        }

        res.json({
            msg: 'Sincronización completada',
            syncedCount,
            createdCount,
            totalFacebookTemplates: facebookTemplates.data.length
        });
    } catch (error) {
        console.error('Error en syncTemplates:', error);
        res.status(500).json({
            msg: 'Error del servidor',
            error: error.message
        });
    }
};

/**
 * Enviar plantilla a un chat específico
 */
exports.sendTemplateToChat = async (req, res) => {
    try {
        const { id } = req.params; // ID de la plantilla
        const { chatId, parameters } = req.body;
        const clientId = req.user.role === 'admin'
            ? req.query.clientId || req.body.clientId
            : req.user.clientId;

        if (!clientId || !chatId) {
            return res.status(400).json({ msg: 'Se requieren clientId y chatId' });
        }

        // Buscar plantilla
        const template = await WhatsAppTemplate.findOne({ _id: id, clientId });

        if (!template) {
            return res.status(404).json({ msg: 'Plantilla no encontrada' });
        }

        // Verificar que la plantilla esté aprobada
        if (!template.canBeSent()) {
            return res.status(400).json({
                msg: `La plantilla debe estar APROBADA para ser enviada. Estado actual: ${template.status}`
            });
        }

        // Buscar chat para obtener número de teléfono
        const chat = await Chat.findOne({ chatId, clientId });

        if (!chat) {
            return res.status(404).json({ msg: 'Chat no encontrado' });
        }

        const phoneNumber = chat.phoneNumber || chatId;

        // Preparar componentes con parámetros
        const components = [];

        if (parameters && parameters.length > 0) {
            // Asumir que los parámetros son para el BODY
            components.push({
                type: "body",
                parameters: parameters.map(param => ({
                    type: "text",
                    text: param
                }))
            });
        }

        // Enviar plantilla vía WhatsApp
        let whatsappResponse;
        try {
            whatsappResponse = await WhatsAppService.sendTemplateMessage(
                clientId,
                phoneNumber,
                template.name,
                template.language,
                components
            );
        } catch (whatsappError) {
            console.error('Error al enviar plantilla por WhatsApp:', whatsappError);
            return res.status(500).json({
                msg: 'Error al enviar plantilla',
                error: whatsappError.response?.data || whatsappError.message
            });
        }

        // Guardar mensaje en la base de datos
        const messageContent = template.getPreview();
        const newMessage = new Message({
            chatId,
            clientId,
            sender: 'bot',
            direction: 'outbound',
            source: 'dashboard',
            provider: 'whatsapp_meta',
            insertedBy: `${req.user.role}:${req.user.id}`,
            aiGenerated: false,
            content: messageContent,
            timestamp: new Date(),
            status: 'sent',
            phoneNumber,
            messageType: 'template',
            templateName: template.name
        });

        await newMessage.save();

        // Cambiar chat a modo "human" automáticamente
        console.log(`📝 Cambiando chat ${chatId} a modo HUMAN...`);
        console.log(`Estado anterior: ${chat.chatStatus}`);

        chat.chatStatus = 'human';
        chat.statusChangeTime = new Date();
        chat.lastMessage = messageContent;
        chat.lastMessageTimestamp = new Date();
        await chat.save();

        console.log(`✅ Chat ${chatId} cambiado a modo HUMAN exitosamente`);
        console.log(`Estado actual: ${chat.chatStatus}`);
        console.log('🎉 ===== PLANTILLA ENVIADA EXITOSAMENTE =====');

        void logAction({
            req,
            clientId,
            action: 'chat.template.sent',
            targetType: 'chat',
            targetId: chatId,
            metadata: {
                templateId: template.id,
                templateName: template.name,
                phoneNumber,
                messageId: newMessage._id.toString(),
                parametersCount: parameters?.length || 0
            }
        });

        res.json({
            msg: 'Plantilla enviada exitosamente',
            whatsappResponse,
            message: newMessage,
            chatStatus: 'human'
        });
    } catch (error) {
        console.error('❌ ===== ERROR EN ENVÍO DE PLANTILLA =====');
        console.error('Error completo:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            msg: 'Error del servidor',
            error: error.message
        });
    }
};
