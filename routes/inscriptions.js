const express = require('express');
const router = express.Router();
const inscriptionController = require('../controllers/inscriptionController');
const auth = require('../middleware/auth');

// Obtener inscripciones con filtros
router.get('/', auth, inscriptionController.getInscriptions);

// NUEVO: Exportar inscripciones a CSV
router.get('/export/csv', auth, inscriptionController.exportInscriptionsCSV);

// NUEVO: Obtener lista de cursos disponibles
router.get('/courses', auth, inscriptionController.getCourses);

// Crear nueva inscripción (para n8n)
router.post('/', inscriptionController.createInscription);

// Eliminar inscripción
router.delete('/:id', auth, inscriptionController.deleteInscription);

// Obtener estadísticas
router.get('/stats', auth, inscriptionController.getInscriptionStats);

module.exports = router;