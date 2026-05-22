const Advisor = require('../models/Advisor');
const AdvisorConfig = require('../models/AdvisorConfig');
const AdvisorTableAssignment = require('../models/AdvisorTableAssignment');
const Chat = require('../models/Chat');
const RoundRobinState = require('../models/RoundRobinState');
const sseService = require('./sseService');

/**
 * Obtener o crear configuración de asesores para un cliente
 */
async function getOrCreateConfig(clientId) {
    let config = await AdvisorConfig.findOne({ clientId });

    if (!config) {
        config = new AdvisorConfig({ clientId, enabled: false });
        await config.save();
    }

    return config;
}

/**
 * Verificar si el módulo está habilitado para un cliente
 */
async function isModuleEnabled(clientId) {
    const config = await AdvisorConfig.findOne({ clientId });
    return config ? config.enabled : false;
}

/**
 * Obtener siguiente asesor para una tabla usando round-robin simple
 */
async function getNextAdvisorForTable(clientId, tableId) {
    try {
        const enabled = await isModuleEnabled(clientId);
        if (!enabled) {
            return null;
        }

        const assignments = await AdvisorTableAssignment.find({
            clientId,
            tableId
        })
            .populate('advisorId')
            .sort({ position: 1 });

        if (assignments.length === 0) {
            console.log(`No hay asesores asignados a la tabla ${tableId}`);
            return null;
        }

        const activeAssignments = assignments.filter(a =>
            a.advisorId && a.advisorId.active
        );

        if (activeAssignments.length === 0) {
            console.log(`No hay asesores activos para la tabla ${tableId}`);
            return null;
        }

        const lastIndex = await getLastAssignmentIndex(tableId);
        const nextIndex = (lastIndex + 1) % activeAssignments.length;

        await updateLastAssignmentIndex(tableId, nextIndex);

        const selectedAdvisor = activeAssignments[nextIndex].advisorId;

        console.log(`Asesor asignado: ${selectedAdvisor.name} (índice ${nextIndex}/${activeAssignments.length})`);

        return selectedAdvisor;

    } catch (error) {
        console.error('Error en getNextAdvisorForTable:', error);
        return null;
    }
}

/**
 * Obtener el índice del último asesor asignado para una tabla
 * Usa una colección auxiliar para trackear el estado del round-robin
 */
async function getLastAssignmentIndex(tableId) {
    const state = await RoundRobinState.findOne({ tableId });
    return state ? state.lastIndex : -1;
}

/**
 * Actualizar el índice del último asesor asignado
 */
async function updateLastAssignmentIndex(tableId, index) {
    await RoundRobinState.findOneAndUpdate(
        { tableId },
        { lastIndex: index, updatedAt: new Date() },
        { upsert: true, new: true }
    );
}

function normalizePhoneNumber(phoneNumber) {
    return String(phoneNumber || '').replace(/\D/g, '');
}

async function findChatByPhoneNumber(clientId, phoneNumber) {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    if (!normalizedPhone) {
        return null;
    }

    return Chat.findOne({
        clientId,
        $or: [
            { chatId: `${normalizedPhone}@c.us` },
            { phoneNumber: phoneNumber },
            { phoneNumber: normalizedPhone }
        ]
    });
}

async function removeAdvisorTagsFromChat(clientId, chat) {
    if (!chat || !Array.isArray(chat.tags) || chat.tags.length === 0) {
        return chat;
    }

    const advisors = await Advisor.find({ clientId }).select('name').lean();
    const advisorNames = new Set(
        advisors
            .map(advisor => String(advisor.name || '').trim().toLowerCase())
            .filter(Boolean)
    );

    chat.tags = chat.tags.filter(tag => !advisorNames.has(String(tag || '').trim().toLowerCase()));
    return chat;
}

/**
 * Asignar asesor a un chat de WhatsApp
 */
async function assignAdvisorToChat(clientId, phoneNumber, advisor, options = {}) {
    try {
        if (!advisor) return;

        const { forceAssignment = false } = options;
        const chat = await findChatByPhoneNumber(clientId, phoneNumber);

        if (chat) {
            await removeAdvisorTagsFromChat(clientId, chat);

            const shouldAssignAdvisor =
                forceAssignment ||
                !chat.assignedAdvisorId ||
                chat.assignedAdvisorId.toString() !== String(advisor._id);

            if (shouldAssignAdvisor) {
                chat.assignedAdvisorId = advisor._id;
                chat.assignedAdvisorName = advisor.name;
                await chat.save();
                sseService.notifyChatUpdate({
                    chatId: chat.chatId,
                    clientId: chat.clientId,
                    assignedAdvisorId: chat.assignedAdvisorId,
                    assignedAdvisorName: chat.assignedAdvisorName
                });
                console.log(`Asesor ${advisor.name} asignado al chat ${chat.chatId}`);
            }
        } else {
            const normalizedPhone = normalizePhoneNumber(phoneNumber);
            console.log(`Chat ${normalizedPhone}@c.us no encontrado para asignar asesor`);
        }
    } catch (error) {
        console.error('Error asignando asesor a chat:', error);
    }
}

/**
 * Detectar si un campo es de teléfono
 */
function isPhoneField(fieldName) {
    const phoneKeywords = ['phone', 'telefono', 'tel', 'celular', 'movil', 'whatsapp'];
    const lowerFieldName = fieldName.toLowerCase();
    return phoneKeywords.some(keyword => lowerFieldName.includes(keyword));
}

module.exports = {
    getOrCreateConfig,
    isModuleEnabled,
    getNextAdvisorForTable,
    assignAdvisorToChat,
    isPhoneField,
    findChatByPhoneNumber,
    removeAdvisorTagsFromChat
};
