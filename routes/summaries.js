const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const summaryController = require('../controllers/summaryController');

// Generar resumen para un chat
router.post('/generate/:chatId', auth, summaryController.generateSummary);

// Obtener todos los resúmenes de un chat
router.get('/:chatId', auth, summaryController.getChatSummaries);

// Obtener el resumen más reciente de un chat
router.get('/:chatId/latest', auth, summaryController.getLatestSummary);

module.exports = router;
