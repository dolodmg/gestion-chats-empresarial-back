const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Advisor = require('../models/Advisor');
const { logAction } = require('../services/auditService');

/**
 * Obtener todos los IDs de chats (para seleccionar todos)
 */
exports.getAllChatIds = async (req, res) => {
    try {
        // Determinar clientId según el rol
        let clientId;
        if (req.user.role === 'admin') {
            clientId = req.query.clientId;
        } else if (req.user.role === 'advisor') {
            clientId = req.user.clientId;
        } else {
            clientId = req.user.clientId;
        }

        if (!clientId) {
            return res.status(400).json({ msg: 'Se requiere clientId' });
        }

        // Obtener solo los chatIds
        const chats = await Chat.find({ clientId }).select('chatId').lean();
        const chatIds = chats.map(chat => chat.chatId);

        void logAction({
            req,
            clientId,
            action: 'chat.export_ids.requested',
            targetType: 'chat_collection',
            targetId: clientId,
            metadata: {
                count: chatIds.length
            }
        });

        res.json({
            count: chatIds.length,
            chatIds
        });
    } catch (error) {
        console.error('Error en getAllChatIds:', error);
        res.status(500).json({
            msg: 'Error del servidor',
            error: error.message
        });
    }
};


/**
 * Exportar chats por rango de fechas con todos sus datos
 * Soporta formatos JSON y CSV
 */
exports.exportChats = async (req, res) => {
    try {
        const { startDate, endDate, format = 'json' } = req.body;

        // Validar formato
        if (!['json', 'csv'].includes(format)) {
            return res.status(400).json({ msg: 'Formato inválido. Use "json" o "csv"' });
        }

        // Determinar clientId según el rol
        let clientId;
        if (req.user.role === 'admin') {
            clientId = req.query.clientId;
        } else if (req.user.role === 'advisor') {
            clientId = req.user.clientId;
        } else {
            clientId = req.user.clientId;
        }

        if (!clientId) {
            return res.status(400).json({ msg: 'Se requiere clientId' });
        }

        // Construir filtro de fecha
        const dateFilter = {};
        if (startDate) {
            dateFilter.$gte = new Date(startDate);
        }
        if (endDate) {
            // Agregar un día completo para incluir todo el día final
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            dateFilter.$lte = endDateTime;
        }

        const chatFilter = { clientId };
        if (Object.keys(dateFilter).length > 0) {
            chatFilter.createdAt = dateFilter;
        }

        console.log(`📤 Exportando chats en formato ${format}`, { startDate, endDate });

        // Obtener chats con todos sus datos
        const chats = await Chat.find(chatFilter).lean();

        if (chats.length === 0) {
            return res.status(404).json({ msg: 'No se encontraron chats para exportar en el rango de fechas especificado' });
        }

        const chatIds = chats.map(c => c.chatId);

        // Obtener mensajes para cada chat
        const messages = await Message.find({
            chatId: { $in: chatIds },
            clientId: clientId
        }).sort({ timestamp: 1 }).lean();

        // Obtener información de asesores únicos
        const advisorIds = [...new Set(chats.map(c => c.assignedAdvisorId).filter(Boolean))];
        const advisors = await Advisor.find({
            _id: { $in: advisorIds }
        }).select('_id name email').lean();

        const advisorMap = {};
        advisors.forEach(adv => {
            advisorMap[adv._id.toString()] = {
                id: adv._id.toString(),
                name: adv.name,
                email: adv.email
            };
        });

        // Construir datos de exportación
        const exportData = {
            exportDate: new Date().toISOString(),
            totalChats: chats.length,
            chats: chats.map(chat => {
                const chatMessages = messages.filter(m => m.chatId === chat.chatId);

                return {
                    chatId: chat.chatId,
                    phoneNumber: chat.phoneNumber,
                    contactName: chat.contactName || chat.phoneNumber,
                    chatStatus: chat.chatStatus,
                    assignedAdvisor: chat.assignedAdvisorId
                        ? advisorMap[chat.assignedAdvisorId.toString()] || null
                        : null,
                    tags: chat.tags || [],
                    timestamps: {
                        createdAt: chat.createdAt,
                        lastMessage: chat.lastMessageTimestamp,
                        statusChanged: chat.statusChangeTime
                    },
                    stats: {
                        totalMessages: chatMessages.length,
                        unreadCount: chat.unreadCount || 0
                    },
                    messages: chatMessages.map(msg => ({
                        sender: msg.sender,
                        content: msg.content,
                        timestamp: msg.timestamp,
                        status: msg.status,
                        messageType: msg.messageType || 'text'
                    }))
                };
            })
        };

        // Generar archivo según formato
        if (format === 'json') {
            // Exportar como JSON
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="chats-export-${Date.now()}.json"`);
            void logAction({
                req,
                clientId,
                action: 'chat.export.generated',
                targetType: 'chat_collection',
                targetId: clientId,
                metadata: {
                    format,
                    startDate: startDate || null,
                    endDate: endDate || null,
                    totalChats: chats.length,
                    totalMessages: messages.length
                }
            });
            return res.json(exportData);
        } else {
            // Exportar como CSV
            const { Parser } = require('json2csv');

            // CSV de chats
            const chatsForCsv = exportData.chats.map(chat => ({
                chatId: chat.chatId,
                phoneNumber: chat.phoneNumber,
                contactName: chat.contactName,
                chatStatus: chat.chatStatus,
                assignedAdvisorName: chat.assignedAdvisor?.name || '',
                assignedAdvisorEmail: chat.assignedAdvisor?.email || '',
                tags: chat.tags.join(', '),
                createdAt: chat.timestamps.createdAt,
                lastMessage: chat.timestamps.lastMessage,
                statusChanged: chat.timestamps.statusChanged,
                totalMessages: chat.stats.totalMessages,
                unreadCount: chat.stats.unreadCount
            }));

            // CSV de mensajes
            const messagesForCsv = [];
            exportData.chats.forEach(chat => {
                chat.messages.forEach(msg => {
                    messagesForCsv.push({
                        chatId: chat.chatId,
                        phoneNumber: chat.phoneNumber,
                        contactName: chat.contactName,
                        sender: msg.sender,
                        content: msg.content,
                        timestamp: msg.timestamp,
                        status: msg.status,
                        messageType: msg.messageType
                    });
                });
            });

            const chatsParser = new Parser({ fields: Object.keys(chatsForCsv[0] || {}) });
            const messagesParser = new Parser({ fields: Object.keys(messagesForCsv[0] || {}) });

            const chatsCsv = chatsParser.parse(chatsForCsv);
            const messagesCsv = messagesParser.parse(messagesForCsv);

            // Combinar ambos CSVs en un solo archivo con separador
            const combinedCsv = `# CHATS\n${chatsCsv}\n\n# MESSAGES\n${messagesCsv}`;

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="chats-export-${Date.now()}.csv"`);
            void logAction({
                req,
                clientId,
                action: 'chat.export.generated',
                targetType: 'chat_collection',
                targetId: clientId,
                metadata: {
                    format,
                    startDate: startDate || null,
                    endDate: endDate || null,
                    totalChats: chats.length,
                    totalMessages: messages.length
                }
            });
            return res.send(combinedCsv);
        }

    } catch (error) {
        console.error('Error en exportChats:', error);
        res.status(500).json({
            msg: 'Error del servidor',
            error: error.message
        });
    }
};
