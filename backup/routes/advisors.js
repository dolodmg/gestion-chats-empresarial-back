const express = require('express');
const router = express.Router();
const advisorController = require('../controllers/advisorController');
const authenticateToken = require('../middleware/auth');

// Todas las rutas protegidas con autenticación
router.use(authenticateToken);

// Configuración del módulo
router.get('/config', advisorController.getConfig);
router.put('/config', advisorController.updateConfig);

// CRUD de asesores
router.get('/', advisorController.getAdvisors);
router.post('/', advisorController.createAdvisor);
router.put('/:id', advisorController.updateAdvisor);
router.delete('/:id', advisorController.deleteAdvisor);

// Asignaciones a tablas
router.get('/assignments/:tableId', advisorController.getTableAssignments);
router.post('/assignments', advisorController.assignToTable);
router.delete('/assignments/:id', advisorController.removeFromTable);

// Estadísticas
router.get('/stats', advisorController.getStats);

module.exports = router;
