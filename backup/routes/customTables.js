const express = require('express');
const router = express.Router();
const customTableController = require('../controllers/customTableController');
const auth = require('../middleware/auth');
const authenticateN8N = require('../middleware/authenticateN8N'); // 🔑 NUEVO

// Obtener todas las tablas personalizadas
router.get('/', auth, customTableController.getCustomTables);

// Crear una nueva tabla personalizada (solo admin)
router.post('/', auth, customTableController.createCustomTable);

// Verificar disponibilidad de nombre de colección
router.get('/check-name', auth, customTableController.checkCollectionName);

// Actualizar una tabla personalizada (solo admin)
router.put('/:tableId', auth, customTableController.updateCustomTable);

// Eliminar una tabla personalizada (solo admin)
router.delete('/:tableId', auth, customTableController.deleteCustomTable);

// Obtener datos de una tabla específica
router.get('/:tableId/data', auth, customTableController.getTableData);

// 🔑 NUEVO: Crear registro con autenticación N8N (para APIs externas)
// Usa el mismo token que /api/leads/create
router.post('/:tableId/records', authenticateN8N, customTableController.createTableRecord);

// Crear un nuevo registro en una tabla (con JWT - para frontend)
router.post('/:tableId/data', auth, customTableController.createTableRecord);

// Actualizar un registro existente
router.put('/:tableId/data/:recordId', auth, customTableController.updateTableRecord);

// Eliminar un registro
router.delete('/:tableId/data/:recordId', auth, customTableController.deleteTableRecord);

// 🔧 TEMPORAL: Limpiar cache de modelos (útil en desarrollo)
router.post('/clear-cache', auth, (req, res) => {
    try {
        customTableController.clearModelCache();
        res.json({ success: true, message: 'Cache limpiado correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;