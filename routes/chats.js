const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const chatExportController = require('../controllers/chatExportController');
const auth = require('../middleware/auth');
const multer = require('multer');

// Configurar multer para uploads en memoria
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB máximo
});

// Obtener todos los chats
router.get('/', auth, chatController.getChats);

// Buscar chats por nombre o teléfono
router.get('/search', auth, chatController.searchChats);

// Buscar chat por número de teléfono
router.get('/search/phone', auth, chatController.findChatByPhone);

// Búsqueda global de chats por número de teléfono (Solo Admin)
router.get('/admin/search/phone', auth, chatController.adminSearchChatsByPhone);

// Ver el historial completo de un chat global (Solo Admin)
router.get('/admin/search/phone/messages/:clientId/:chatId', auth, chatController.adminGetGlobalChatMessages);

// Obtener todos los IDs de chats (para seleccionar todos)
router.get('/export/all-ids', auth, chatExportController.getAllChatIds);

// Exportar chats seleccionados
router.post('/export', auth, chatExportController.exportChats);

// Proxy para descargar media de mensajes
router.get('/media/:messageId', auth, chatController.getMedia);

// Obtener un chat específico con sus mensajes
router.get('/:chatId', auth, chatController.getChat);

// Cambiar el estado del chat (bot/human)
router.post('/:chatId/status', auth, chatController.changeChatStatus);

// Enviar mensaje manual (soporta texto y archivos)
router.post('/:chatId/message', auth, upload.single('file'), chatController.sendManualMessage);

// Assign chat to advisor manually
router.put('/:chatId/assign-advisor', auth, chatController.assignChatToAdvisor);

// Eliminar un mensaje individual
router.delete('/messages/:messageId', auth, chatController.deleteMessage);

// Eliminar un chat completo
router.delete('/:chatId', auth, chatController.deleteChat);

module.exports = router;

