const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');
const authenticateToken = require('../middleware/auth');

router.get('/', authenticateToken, tagController.getUserTags);
router.post('/', authenticateToken, tagController.createTag);
router.put('/:tagName/color', authenticateToken, tagController.updateTagColor);
router.delete('/:tagName', authenticateToken, tagController.deleteTag);
router.get('/stats', authenticateToken, tagController.getTagStats);
router.post('/chats/:chatId/tags', authenticateToken, tagController.addTagToChat);
router.delete('/chats/:chatId/tags/:tagName', authenticateToken, tagController.removeTagFromChat);
router.put('/chats/:chatId/tags', authenticateToken, tagController.updateChatTags);

module.exports = router;