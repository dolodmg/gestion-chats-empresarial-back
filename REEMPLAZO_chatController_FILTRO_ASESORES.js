// ============================================
// REEMPLAZO COMPLETO PARA chatController.js
// ============================================
// 
// UBICACIÓN: Líneas 99-162 aproximadamente
// BUSCA: "// 🔑 FILTRAR CHATS PARA ASESORES"
// REEMPLAZA toda la sección desde ahí hasta el cierre del try-catch
//
// ============================================

// 🔑 FILTRAR CHATS PARA ASESORES (por números en Mis Datos Y asignación manual)
if (req.user.role === 'advisor') {
    console.log(`🔍 ADVISOR: Filtrando chats para asesor ${req.user.advisorId}`);
    try {
        const CustomTable = require('../models/CustomTable');
        const mongoose = require('mongoose');

        const tables = await CustomTable.find({ clientId, isActive: true });
        console.log(`🔍 ADVISOR: Tablas encontradas: ${tables.length}`);

        // Recolectar todos los números de teléfono asignados al asesor
        const assignedPhoneNumbers = new Set();

        for (const table of tables) {
            const collectionName = table.collectionName;
            let DataModel;

            if (mongoose.models[collectionName]) {
                DataModel = mongoose.models[collectionName];
            } else {
                DataModel = mongoose.model(
                    collectionName,
                    new mongoose.Schema(table.getValidationSchema()),
                    collectionName
                );
            }

            const phoneFields = table.fields.filter(f =>
                f.type === 'phone' || f.name.toLowerCase().includes('telefono') || f.name.toLowerCase().includes('phone')
            );

            for (const phoneField of phoneFields) {
                const records = await DataModel.find({
                    assignedAdvisorId: req.user.advisorId
                }).select(phoneField.name);

                records.forEach(record => {
                    const phoneValue = record[phoneField.name];
                    if (phoneValue) {
                        // Normalizar a string
                        assignedPhoneNumbers.add(String(phoneValue));
                    }
                });
            }
        }

        console.log(`🔍 ADVISOR: Números asignados: ${assignedPhoneNumbers.size}`);
        console.log(`📞 ADVISOR: Números:`, Array.from(assignedPhoneNumbers));

        // También obtener chats asignados manualmente
        const manuallyAssignedChats = await Chat.find({
            clientId,
            assignedAdvisorId: req.user.advisorId
        }).select('chatId').lean();

        const manuallyAssignedChatIds = new Set(manuallyAssignedChats.map(c => c.chatId));
        console.log(`👤 ADVISOR: Chats asignados manualmente: ${manuallyAssignedChatIds.size}`);

        // Filtrar chats que coincidan con los números asignados O estén asignados manualmente
        chats = chats.filter(chat => {
            const chatPhone = chat.phoneNumber || chat.chatId;
            const matchByPhone = assignedPhoneNumbers.has(String(chatPhone));
            const matchByManualAssignment = manuallyAssignedChatIds.has(chat.chatId);
            const match = matchByPhone || matchByManualAssignment;

            if (match) {
                console.log(`✅ ADVISOR: Chat ${chat.chatId} coincide (${matchByPhone ? 'por teléfono' : 'asignación manual'})`);
            }
            return match;
        });

        console.log(`✅ ADVISOR: Chats filtrados: ${chats.length}`);
    } catch (filterError) {
        console.error('⚠️ Error filtrando chats para asesor:', filterError);
    }
}

// ============================================
// FIN DEL REEMPLAZO
// ============================================
