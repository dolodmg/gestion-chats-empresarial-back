const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const auth = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(auth);

// CRUD de campañas
router.post('/', campaignController.createCampaign);
router.get('/', campaignController.getCampaigns);
router.get('/stats', campaignController.getStats);
router.get('/:id', campaignController.getCampaignById);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);

// Gestión de destinatarios
router.post('/:id/recipients', campaignController.addRecipients);
router.post('/parse-csv', campaignController.parseCSV);

// Envío de campaña
router.post('/:id/send', campaignController.sendCampaign);

module.exports = router;
