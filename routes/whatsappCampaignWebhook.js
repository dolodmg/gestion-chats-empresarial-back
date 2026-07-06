const express = require('express');
const router = express.Router();
const whatsAppCampaignController = require('../controllers/whatsAppCampaignController');

router.get('/', whatsAppCampaignController.handleWebhookVerification);
router.post('/', whatsAppCampaignController.handleWebhookEvent);

module.exports = router;
