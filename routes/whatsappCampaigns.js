const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireClientFeature = require('../middleware/requireClientFeature');
const whatsAppCampaignController = require('../controllers/whatsAppCampaignController');

router.use(auth);
router.use(requireClientFeature('whatsappCampaigns'));

router.post('/', whatsAppCampaignController.createCampaign);
router.get('/', whatsAppCampaignController.getCampaigns);
router.get('/stats', whatsAppCampaignController.getStats);
router.post('/parse-csv', whatsAppCampaignController.parseCSV);
router.get('/:id', whatsAppCampaignController.getCampaignById);
router.put('/:id', whatsAppCampaignController.updateCampaign);
router.delete('/:id', whatsAppCampaignController.deleteCampaign);
router.post('/:id/recipients', whatsAppCampaignController.addRecipients);
router.post('/:id/send', whatsAppCampaignController.sendCampaign);

module.exports = router;
