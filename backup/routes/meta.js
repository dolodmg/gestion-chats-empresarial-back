const express = require('express');
const router = express.Router();
const metaConfigController = require('../controllers/metaConfigController');
const metaEventController = require('../controllers/metaEventController');
const authenticateToken = require('../middleware/auth');

// Meta Configuration Routes
router.get('/config', authenticateToken, metaConfigController.getMetaConfig);
router.post('/config', authenticateToken, metaConfigController.saveMetaConfig);
router.delete('/config', authenticateToken, metaConfigController.deleteMetaConfig);
router.post('/config/test', authenticateToken, metaConfigController.testConnection);

// Meta Event Routes
router.post('/events/send', authenticateToken, metaEventController.sendManualEvent);

// Tag Mapping Routes
router.get('/mappings', authenticateToken, metaEventController.getTagMappings);
router.post('/mappings', authenticateToken, metaEventController.createTagMapping);
router.delete('/mappings/:tagName', authenticateToken, metaEventController.deleteTagMapping);

module.exports = router;
