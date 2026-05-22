const express = require('express');
const router = express.Router();
const n8nController = require('../controllers/n8nController');

// ✨ NUEVO: Importar middleware de autenticación
const authenticateN8N = require('../middleware/authenticateN8N');

// Ruta para verificar el estado del chat (CON AUTENTICACIÓN)
router.get('/check-chat-state', authenticateN8N, n8nController.checkChatState);

// Ruta para cambiar el estado del chat (SIN AUTENTICACIÓN por ahora)
router.post('/change-chat-state/:chatId', n8nController.changeChatState);

module.exports = router;