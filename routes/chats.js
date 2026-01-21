const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const chatExportController = require('../controllers/chatExportController');
const auth = require('../middleware/auth');

// Obtener todos los chats
router.get('/', auth, chatController.getChats);

// Buscar chats por nombre o teléfono
router.get('/search', auth, chatController.searchChats);

// Buscar chat por número de teléfono
router.get('/search/phone', auth, chatController.findChatByPhone);

// Obtener todos los IDs de chats (para seleccionar todos)
router.get('/export/all-ids', auth, chatExportController.getAllChatIds);

// Exportar chats seleccionados
router.post('/export', auth, chatExportController.exportChats);

// Obtener un chat específico con sus mensajes
router.get('/:chatId', auth, chatController.getChat);

// Cambiar el estado del chat (bot/human)
router.post('/:chatId/status', auth, chatController.changeChatStatus);

// Enviar mensaje manual
router.post('/:chatId/message', auth, chatController.sendManualMessage);

// Assign chat to advisor manually
router.put('/:chatId/assign-advisor', auth, chatController.assignChatToAdvisor);

module.exports = router;
