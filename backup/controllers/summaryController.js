const axios = require('axios');
const ChatSummary = require('../models/ChatSummary');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

/**
 * Función helper para llamar a OpenAI
 */
async function callOpenAI(prompt) {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'Eres un asistente experto en resumir conversaciones de WhatsApp de manera concisa y útil.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error llamando a OpenAI:', error.response?.data || error.message);
        throw new Error('Error al generar resumen con IA');
    }
}

/**
 * POST /api/summaries/generate/:chatId
 * Genera un resumen para un chat específico
 */
exports.generateSummary = async (req, res) => {
    try {
        const { chatId } = req.params;
        const clientId = req.user.role === 'admin'
            ? req.query.clientId || req.body.clientId
            : req.user.clientId;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere clientId'
            });
        }

        console.log(`Generando resumen para chat: ${chatId}, cliente: ${clientId}`);

        // 1. Verificar que el chat existe
        const chat = await Chat.findOne({ chatId, clientId });
        if (!chat) {
            return res.status(404).json({
                success: false,
                error: 'Chat no encontrado'
            });
        }

        // 2. Buscar el último resumen para saber desde cuándo resumir
        const lastSummary = await ChatSummary.findOne({
            chatId,
            clientId,
            isActive: true
        }).sort({ generatedAt: -1 });

        let messages;

        if (lastSummary) {
            // Si hay un resumen previo, solo tomar mensajes NUEVOS desde esa fecha
            console.log(`Último resumen: ${lastSummary.generatedAt}, resumiendo solo mensajes nuevos`);
            messages = await Message.find({
                chatId,
                clientId,
                timestamp: { $gt: lastSummary.lastMessageDate } // Solo mensajes DESPUÉS del último resumen
            })
                .sort({ timestamp: 1 })
                .limit(100)
                .select('sender content timestamp');
        } else {
            // Si es el primer resumen, tomar los últimos 50 mensajes (no 100, para ser más específico)
            console.log('Primer resumen, tomando últimos 50 mensajes');
            messages = await Message.find({ chatId, clientId })
                .sort({ timestamp: -1 })
                .limit(50)
                .select('sender content timestamp');

            // Reordenar cronológicamente
            messages = messages.reverse();
        }

        if (messages.length === 0) {
            return res.status(400).json({
                success: false,
                error: lastSummary
                    ? 'No hay mensajes nuevos desde el último resumen'
                    : 'No hay mensajes para resumir'
            });
        }

        console.log(`Resumiendo ${messages.length} mensajes`);

        // 4. Construir transcript para la IA
        let transcript = '';
        messages.forEach(msg => {
            const role = msg.sender === 'user' ? 'CLIENTE' : 'BOT';
            const content = msg.content ? msg.content.replace(/\n/g, ' ') : '';
            transcript += `${role}: ${content}\n`;
        });

        // 5. Generar prompt para IA - ULTRA CONCISO
        const prompt = `Resume esta conversación de WhatsApp de forma ULTRA CONCISA.

CONVERSACIÓN:
"""
${transcript}
"""

INSTRUCCIONES CRÍTICAS:
- Máximo 2-3 líneas en total
- Solo menciona QUÉ QUIERE el cliente (su necesidad/solicitud principal)
- Si mencionó algo específico importante (modelo, fecha, precio, etc.), inclúyelo
- NO expliques el contexto ni el proceso
- NO menciones "el asistente" ni "el bot"
- Usa lenguaje directo y simple
- Sin introducciones ni conclusiones

EJEMPLO DE FORMATO CORRECTO:
"Cliente interesado en Kangoo Parnet Sendero Stewart. Asesor lo contactará."

FORMATO:
Texto plano, sin formato markdown, máximo 2-3 líneas.`;

        // 6. Llamar a OpenAI
        console.log('Llamando a OpenAI para generar resumen...');
        const summary = await callOpenAI(prompt);

        // 7. Guardar resumen en la base de datos
        const chatSummary = new ChatSummary({
            chatId,
            clientId,
            summary,
            messageCount: messages.length,
            generatedBy: req.user.id,
            lastMessageDate: messages[messages.length - 1].timestamp
        });

        await chatSummary.save();

        console.log(`Resumen generado exitosamente para chat ${chatId}`);

        res.json({
            success: true,
            summary: {
                id: chatSummary._id,
                summary: chatSummary.summary,
                messageCount: chatSummary.messageCount,
                generatedAt: chatSummary.generatedAt,
                lastMessageDate: chatSummary.lastMessageDate
            }
        });

    } catch (error) {
        console.error('Error generando resumen:', error);
        res.status(500).json({
            success: false,
            error: 'Error del servidor al generar resumen',
            details: error.message
        });
    }
};

/**
 * GET /api/summaries/:chatId
 * Obtiene todos los resúmenes de un chat
 */
exports.getChatSummaries = async (req, res) => {
    try {
        const { chatId } = req.params;
        const clientId = req.user.role === 'admin'
            ? req.query.clientId
            : req.user.clientId;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere clientId'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Obtener resúmenes ordenados por fecha (más reciente primero)
        const summaries = await ChatSummary.find({
            chatId,
            clientId,
            isActive: true
        })
            .sort({ generatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('generatedBy', 'name email')
            .select('summary messageCount generatedAt lastMessageDate generatedBy');

        const total = await ChatSummary.countDocuments({
            chatId,
            clientId,
            isActive: true
        });

        res.json({
            success: true,
            summaries,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error obteniendo resúmenes:', error);
        res.status(500).json({
            success: false,
            error: 'Error del servidor al obtener resúmenes',
            details: error.message
        });
    }
};

/**
 * GET /api/summaries/:chatId/latest
 * Obtiene el resumen más reciente de un chat
 */
exports.getLatestSummary = async (req, res) => {
    try {
        const { chatId } = req.params;
        const clientId = req.user.role === 'admin'
            ? req.query.clientId
            : req.user.clientId;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere clientId'
            });
        }

        const summary = await ChatSummary.findOne({
            chatId,
            clientId,
            isActive: true
        })
            .sort({ generatedAt: -1 })
            .populate('generatedBy', 'name email')
            .select('summary messageCount generatedAt lastMessageDate generatedBy');

        if (!summary) {
            return res.status(404).json({
                success: false,
                error: 'No se encontraron resúmenes para este chat'
            });
        }

        res.json({
            success: true,
            summary
        });

    } catch (error) {
        console.error('Error obteniendo resumen más reciente:', error);
        res.status(500).json({
            success: false,
            error: 'Error del servidor al obtener resumen',
            details: error.message
        });
    }
};
