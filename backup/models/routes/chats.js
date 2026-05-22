const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');

// Obtener todos los chats
router.get('/', auth, chatController.getChats);

// Obtener un chat específico con sus mensajes
router.get('/:chatId', auth, chatController.getChat);

// Cambiar el estado del chat (bot/human)
router.post('/:chatId/status', auth, chatController.changeChatStatus);

// Enviar mensaje manual
router.post('/:chatId/message', auth, chatController.sendManualMessage);

module.exports = router;
