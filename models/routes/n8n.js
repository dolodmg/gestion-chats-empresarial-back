const express = require('express');
const router = express.Router();
const n8nController = require('../controllers/n8nController');

// Ruta para verificar el estado del chat (endpoint específico para n8n)
router.get('/check-chat-state', n8nController.checkChatState);

// Ruta para cambiar el estado del chat (usada desde el panel)
router.post('/change-chat-state/:chatId', n8nController.changeChatState);

module.exports = router;
