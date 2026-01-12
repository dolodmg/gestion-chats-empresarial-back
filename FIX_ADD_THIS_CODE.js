// Add this code AFTER line 146 in chatController.js
// (after the console.log with phone numbers)

// También obtener chats asignados manualmente
const manuallyAssignedChats = await Chat.find({
    clientId,
    assignedAdvisorId: req.user.advisorId
}).select('chatId').lean();

const manuallyAssignedChatIds = new Set(manuallyAssignedChats.map(c => c.chatId));
console.log(`👤 ADVISOR: Chats asignados manualmente: ${manuallyAssignedChatIds.size}`);
