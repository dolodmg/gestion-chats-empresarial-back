const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireClientFeature = require('../middleware/requireClientFeature');
const summaryController = require('../controllers/summaryController');

router.post('/generate/:chatId', auth, requireClientFeature('conversationSummary'), summaryController.generateSummary);
router.get('/:chatId', auth, requireClientFeature('conversationSummary'), summaryController.getChatSummaries);
router.get('/:chatId/latest', auth, requireClientFeature('conversationSummary'), summaryController.getLatestSummary);

module.exports = router;
