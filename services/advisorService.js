const Advisor = require('../models/Advisor');
const AdvisorConfig = require('../models/AdvisorConfig');
const AdvisorTableAssignment = require('../models/AdvisorTableAssignment');
const Chat = require('../models/Chat');

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
        // Verificar si el módulo está habilitado
        const enabled = await isModuleEnabled(clientId);
        if (!enabled) {
            return null;
        }

        // Obtener asignaciones de asesores para esta tabla, ordenadas por posición
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

        // Filtrar solo asesores activos
        const activeAssignments = assignments.filter(a =>
            a.advisorId && a.advisorId.active
        );

        if (activeAssignments.length === 0) {
            console.log(`No hay asesores activos para la tabla ${tableId}`);
            return null;
        }

        // Obtener el índice del último asesor asignado para esta tabla
        const lastIndex = await getLastAssignmentIndex(tableId);

        // Calcular el siguiente índice (round-robin circular)
        const nextIndex = (lastIndex + 1) % activeAssignments.length;

        // Actualizar el índice para la próxima asignación
        await updateLastAssignmentIndex(tableId, nextIndex);

        // Retornar el asesor correspondiente
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
const RoundRobinState = require('../models/RoundRobinState');

async function getLastAssignmentIndex(tableId) {
    const state = await RoundRobinState.findOne({ tableId });
    return state ? state.lastIndex : -1; // -1 para que el primero sea 0
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

/**
 * Asignar asesor a un chat de WhatsApp
 */
async function assignAdvisorToChat(clientId, phoneNumber, advisor) {
    try {
        if (!advisor) return;

        // Buscar el chat por número de teléfono
        const chatId = `${phoneNumber.replace(/\D/g, '')}@c.us`;

        const chat = await Chat.findOne({ chatId, clientId });

        if (chat) {
            // Solo asignar si no tiene asesor ya asignado
            if (!chat.assignedAdvisorId) {
                chat.assignedAdvisorId = advisor._id;
                chat.assignedAdvisorName = advisor.name;
                await chat.save();

                console.log(`Asesor ${advisor.name} asignado al chat ${chatId}`);
            }
        } else {
            console.log(`Chat ${chatId} no encontrado para asignar asesor`);
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
    isPhoneField
};
