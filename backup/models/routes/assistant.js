const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistantController');
const auth = require('../middleware/auth');

// Obtener el prompt del asistente
router.get('/prompt', auth, assistantController.getAssistantPrompt);

// Actualizar el prompt del asistente
router.put('/prompt', auth, assistantController.updateAssistantPrompt);

module.exports = router;