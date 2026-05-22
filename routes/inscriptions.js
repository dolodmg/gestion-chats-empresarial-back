const express = require('express');
const router = express.Router();
const inscriptionController = require('../controllers/inscriptionController');
const auth = require('../middleware/auth');
const authenticateN8N = require('../middleware/authenticateN8N'); // Import n8n auth middleware

// Obtener inscripciones con filtros
router.get('/', auth, inscriptionController.getInscriptions);

// NUEVO: Exportar inscripciones a CSV
router.get('/export/csv', auth, inscriptionController.exportInscriptionsCSV);

// NUEVO: Obtener lista de cursos disponibles
router.get('/courses', auth, inscriptionController.getCourses);

// Crear nueva inscripción (desde el frontend)
router.post('/', inscriptionController.createInscription);

// Crear inscripción desde Bot n8n (Recibe número de curso y normaliza, autenticado)
router.post('/n8n', authenticateN8N, inscriptionController.createInscriptionFromN8N);

// Eliminar inscripción
router.delete('/:id', auth, inscriptionController.deleteInscription);

// Obtener estadísticas
router.get('/stats', auth, inscriptionController.getInscriptionStats);

module.exports = router;