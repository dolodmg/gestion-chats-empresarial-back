const express = require('express');
const router = express.Router();
const n8nController = require('../controllers/n8nController');
const authenticateN8N = require('../middleware/authenticateN8N');

router.get('/check-chat-state', authenticateN8N, n8nController.checkChatState);
router.post('/mark-chat-attention', authenticateN8N, n8nController.markChatForAttention);
router.post('/register-template-send', authenticateN8N, n8nController.registerTemplateSend);
router.post('/register-member-template-send', authenticateN8N, n8nController.registerMemberTemplateSend);
router.post('/change-chat-state/:chatId', authenticateN8N, n8nController.changeChatState);

module.exports = router;
