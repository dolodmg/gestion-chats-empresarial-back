const Chat = require('../models/Chat');
const Message = require('../models/Message');
const WhatsAppService = require('../services/whatsappService');
const ChatState = require('../models/ChatState');
const sseService = require('../services/sseService');
const Advisor = require('../models/Advisor');

// ... existing code ...

// Assign chat to advisor manually
exports.assignChatToAdvisor = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { advisorId } = req.body;

        // Only clients and admins can assign chats
        if (req.user.role === 'advisor') {
            return res.status(403).json({ msg: 'Los asesores no pueden asignar chats' });
        }

        const clientId = req.user.role === 'admin' ? req.body.clientId || req.query.clientId : req.user.clientId;

        if (!clientId) {
            return res.status(400).json({ msg: 'Se requiere clientId' });
        }

        // Find the chat
        const chat = await Chat.findOne({ chatId, clientId });

        if (!chat) {
            return res.status(404).json({ msg: 'Chat no encontrado' });
        }

        // If advisorId is provided, validate the advisor
        let advisorName = null;
        if (advisorId) {
            const advisor = await Advisor.findOne({ _id: advisorId, clientId, active: true });

            if (!advisor) {
                return res.status(404).json({ msg: 'Asesor no encontrado o inactivo' });
            }

            advisorName = advisor.name;
        }

        // Update the chat assignment
        chat.assignedAdvisorId = advisorId || null;
        chat.assignedAdvisorName = advisorName;
        await chat.save();

        console.log(`✅ Chat ${chatId} ${advisorId ? `asignado a ${advisorName}` : 'desasignado'}`);

        res.json({
            message: advisorId ? 'Chat asignado exitosamente' : 'Chat desasignado exitosamente',
            chat: {
                chatId: chat.chatId,
                assignedAdvisorId: chat.assignedAdvisorId,
                assignedAdvisorName: chat.assignedAdvisorName
            }
        });
    } catch (error) {
        console.error('Error assigning chat to advisor:', error);
        res.status(500).json({ msg: 'Error del servidor' });
    }
};
