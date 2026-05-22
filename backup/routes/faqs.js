const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');
const auth = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(auth);

// Analizar y generar FAQs
router.post('/analyze', faqController.analyzeFAQs);

// Obtener FAQs
router.get('/', faqController.getFAQs);

// Obtener estadísticas
router.get('/stats', faqController.getFAQStats);

// Actualizar FAQ
router.put('/:id', faqController.updateFAQ);

// Eliminar FAQ
router.delete('/:id', faqController.deleteFAQ);

module.exports = router;