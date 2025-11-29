const express = require('express');
const router = express.Router();
const customTableController = require('../controllers/customTableController');
const auth = require('../middleware/auth');

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

// Crear un nuevo registro en una tabla
router.post('/:tableId/data', auth, customTableController.createTableRecord);

// Actualizar un registro existente
router.put('/:tableId/data/:recordId', auth, customTableController.updateTableRecord);

// Eliminar un registro
router.delete('/:tableId/data/:recordId', auth, customTableController.deleteTableRecord);

module.exports = router;