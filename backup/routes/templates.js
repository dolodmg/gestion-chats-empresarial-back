const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const templateController = require('../controllers/templateController');

// Crear nueva plantilla
router.post('/', auth, templateController.createTemplate);

// Obtener todas las plantillas del cliente
router.get('/', auth, templateController.getTemplates);

// Obtener plantilla específica por ID
router.get('/:id', auth, templateController.getTemplateById);

// Eliminar plantilla
router.delete('/:id', auth, templateController.deleteTemplate);

// Sincronizar plantillas con Facebook API
router.post('/sync', auth, templateController.syncTemplates);

// Enviar plantilla a un chat
router.post('/:id/send', auth, templateController.sendTemplateToChat);

module.exports = router;
