const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireClientFeature = require('../middleware/requireClientFeature');
const templateController = require('../controllers/templateController');

router.post('/', auth, requireClientFeature('templates'), templateController.createTemplate);
router.get('/', auth, requireClientFeature('templates'), templateController.getTemplates);
router.get('/:id', auth, requireClientFeature('templates'), templateController.getTemplateById);
router.delete('/:id', auth, requireClientFeature('templates'), templateController.deleteTemplate);
router.post('/sync', auth, requireClientFeature('templates'), templateController.syncTemplates);
router.post('/:id/send', auth, requireClientFeature('sendTemplates'), templateController.sendTemplateToChat);

module.exports = router;
