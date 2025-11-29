const CustomTable = require('../models/CustomTable');
const mongoose = require('mongoose');

// ✨ CACHE para modelos dinámicos - SOLUCIÓN al problema de OverwriteModelError
const dynamicModelsCache = new Map();

/**
 * Obtener o crear modelo dinámico con cache para evitar OverwriteModelError
 */
function getDynamicModel(collectionName, schema) {
  // Si el modelo ya existe en cache, devolverlo
  if (dynamicModelsCache.has(collectionName)) {
    return dynamicModelsCache.get(collectionName);
  }
  
  // Si el modelo ya está compilado en Mongoose, devolverlo
  if (mongoose.models[collectionName]) {
    dynamicModelsCache.set(collectionName, mongoose.models[collectionName]);
    return mongoose.models[collectionName];
  }
  
  // Crear nuevo modelo y guardarlo en cache
  const DynamicModel = mongoose.model(
    collectionName,
    new mongoose.Schema(schema),
    collectionName
  );
  
  dynamicModelsCache.set(collectionName, DynamicModel);
  console.log(`✅ Modelo dinámico creado y cacheado: ${collectionName}`);
  
  return DynamicModel;
}

/**
 * Obtener todas las tablas personalizadas (admin) o las del cliente específico
 */
exports.getCustomTables = async (req, res) => {
  try {
    const user = req.user;
    let tables;
    
    if (user.role === 'admin') {
      // Admin puede ver todas las tablas o filtrar por cliente
      const clientId = req.query.clientId;
      if (clientId) {
        tables = await CustomTable.findByClient(clientId);
      } else {
        tables = await CustomTable.find({ isActive: true })
          .sort({ createdAt: -1 })
          .populate('clientId', 'name email', 'User');
      }
    } else {
      // Cliente solo ve sus propias tablas
      tables = await CustomTable.findByClient(user.clientId);
    }
    
    res.json({
      success: true,
      tables
    });
    
  } catch (error) {
    console.error('Error obteniendo tablas personalizadas:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al obtener las tablas'
    });
  }
};

/**
 * Crear una nueva tabla personalizada (solo admin)
 */
exports.createCustomTable = async (req, res) => {
  try {
    // Verificar que el usuario sea admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Solo los administradores pueden crear tablas'
      });
    }
    
    const { clientId, tableName, collectionName, description, fields } = req.body;
    
    // Validaciones básicas
    if (!clientId || !tableName || !collectionName || !fields || fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos y debe haber al menos un campo definido'
      });
    }
    
    // Verificar que el nombre de colección no exista
    const existingCollection = await CustomTable.checkCollectionExists(collectionName);
    if (existingCollection) {
      return res.status(400).json({
        success: false,
        error: 'El nombre de colección ya está en uso. Por favor, elige otro nombre'
      });
    }
    
    // Validar formato de campos
    for (const field of fields) {
      if (!field.name || !field.type || !field.label) {
        return res.status(400).json({
          success: false,
          error: 'Cada campo debe tener nombre, tipo y etiqueta'
        });
      }
      
      // Validar que el nombre del campo sea válido (sin espacios, caracteres especiales)
      const fieldNameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
      if (!fieldNameRegex.test(field.name)) {
        return res.status(400).json({
          success: false,
          error: `El nombre del campo "${field.name}" no es válido. Debe empezar con una letra y solo contener letras, números y guiones bajos`
        });
      }
    }
    
    // Crear la tabla personalizada
    const customTable = new CustomTable({
      clientId,
      tableName,
      collectionName,
      description: description || '',
      fields,
      createdBy: req.user.id
    });
    
    await customTable.save();
    
    console.log(`Tabla personalizada creada: ${collectionName} para cliente ${clientId}`);
    
    res.json({
      success: true,
      message: 'Tabla personalizada creada correctamente',
      table: customTable,
      collectionName: customTable.collectionName
    });
    
  } catch (error) {
    console.error('Error creando tabla personalizada:', error);
    
    // Manejar errores de validación de Mongoose
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    // Manejar errores de duplicado
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'El nombre de colección ya está en uso'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error del servidor al crear la tabla'
    });
  }
};

/**
 * Actualizar una tabla personalizada (solo admin)
 */
exports.updateCustomTable = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Solo los administradores pueden modificar tablas'
      });
    }
    
    const { tableId } = req.params;
    const { tableName, description, fields } = req.body;
    
    const customTable = await CustomTable.findById(tableId);
    if (!customTable) {
      return res.status(404).json({
        success: false,
        error: 'Tabla no encontrada'
      });
    }
    
    // Actualizar campos permitidos (no se puede cambiar clientId ni collectionName)
    if (tableName) customTable.tableName = tableName;
    if (description !== undefined) customTable.description = description;
    if (fields) customTable.fields = fields;
    
    await customTable.save();
    
    // ✨ Limpiar cache del modelo si se actualizaron los campos
    if (fields && dynamicModelsCache.has(customTable.collectionName)) {
      console.log(`🔄 Limpiando cache del modelo: ${customTable.collectionName}`);
      dynamicModelsCache.delete(customTable.collectionName);
      // También eliminar de mongoose.models si existe
      if (mongoose.models[customTable.collectionName]) {
        delete mongoose.models[customTable.collectionName];
      }
    }
    
    res.json({
      success: true,
      message: 'Tabla actualizada correctamente',
      table: customTable
    });
    
  } catch (error) {
    console.error('Error actualizando tabla:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al actualizar la tabla'
    });
  }
};

/**
 * Eliminar una tabla personalizada (solo admin)
 */
exports.deleteCustomTable = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Solo los administradores pueden eliminar tablas'
      });
    }
    
    const { tableId } = req.params;
    
    const customTable = await CustomTable.findById(tableId);
    if (!customTable) {
      return res.status(404).json({
        success: false,
        error: 'Tabla no encontrada'
      });
    }
    
    // ✨ Limpiar cache del modelo antes de eliminar
    if (dynamicModelsCache.has(customTable.collectionName)) {
      console.log(`🗑️ Eliminando modelo del cache: ${customTable.collectionName}`);
      dynamicModelsCache.delete(customTable.collectionName);
      // También eliminar de mongoose.models si existe
      if (mongoose.models[customTable.collectionName]) {
        delete mongoose.models[customTable.collectionName];
      }
    }
    
    // Marcar como inactiva en lugar de eliminar (soft delete)
    customTable.isActive = false;
    await customTable.save();
    
    res.json({
      success: true,
      message: 'Tabla eliminada correctamente'
    });
    
  } catch (error) {
    console.error('Error eliminando tabla:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al eliminar la tabla'
    });
  }
};

/**
 * Verificar si un nombre de colección está disponible
 */
exports.checkCollectionName = async (req, res) => {
  try {
    const { collectionName } = req.query;
    
    if (!collectionName) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el nombre de la colección'
      });
    }
    
    const exists = await CustomTable.checkCollectionExists(collectionName);
    
    res.json({
      success: true,
      available: !exists,
      message: exists ? 'El nombre ya está en uso' : 'El nombre está disponible'
    });
    
  } catch (error) {
    console.error('Error verificando nombre de colección:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor'
    });
  }
};

/**
 * ✅ FUNCIÓN CORREGIDA - Obtener datos de una tabla personalizada específica
 */
exports.getTableData = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { page = 1, limit = 50, search = '' } = req.query;
    
    console.log(`📊 Obteniendo datos para tabla: ${tableId}`);
    
    // Obtener la definición de la tabla
    const customTable = await CustomTable.findById(tableId);
    if (!customTable) {
      return res.status(404).json({
        success: false,
        error: 'Tabla no encontrada'
      });
    }
    
    console.log(`📋 Tabla encontrada: ${customTable.tableName} (${customTable.collectionName})`);
    
    // Verificar permisos
    if (req.user.role !== 'admin' && req.user.clientId !== customTable.clientId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ver estos datos'
      });
    }
    
    // ✅ USAR MODELO DINÁMICO CON CACHE - SOLUCIÓN PRINCIPAL
    const DataModel = getDynamicModel(
      customTable.collectionName,
      customTable.getValidationSchema()
    );
    
    // Construir filtro de búsqueda
    let filter = {};
    if (search) {
      const searchFields = customTable.fields
        .filter(field => ['string', 'email', 'phone', 'textarea'].includes(field.type))
        .map(field => field.name);
      
      if (searchFields.length > 0) {
        filter.$or = searchFields.map(fieldName => ({
          [fieldName]: { $regex: search, $options: 'i' }
        }));
      }
    }
    
    // Paginación
    const skip = (page - 1) * limit;
    
    console.log(`🔍 Filtros aplicados:`, filter);
    console.log(`📄 Paginación: página ${page}, límite ${limit}, skip ${skip}`);
    
    // Obtener datos
    const [data, total] = await Promise.all([
      DataModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      DataModel.countDocuments(filter)
    ]);
    
    console.log(`✅ Datos obtenidos: ${data.length} registros de ${total} totales`);
    
    res.json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      },
      table: {
        id: customTable._id,
        name: customTable.tableName,
        fields: customTable.fields
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo datos de la tabla:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al obtener los datos'
    });
  }
};

/**
 * ✅ FUNCIÓN CORREGIDA - Crear un nuevo registro en una tabla personalizada
 */
exports.createTableRecord = async (req, res) => {
  try {
    const { tableId } = req.params;
    const recordData = req.body;
    
    console.log(`📝 Creando registro para tabla: ${tableId}`);
    console.log(`📋 Datos recibidos:`, recordData);
    
    // Obtener la definición de la tabla
    const customTable = await CustomTable.findById(tableId);
    if (!customTable) {
      return res.status(404).json({
        success: false,
        error: 'Tabla no encontrada'
      });
    }
    
    console.log(`📋 Tabla encontrada: ${customTable.tableName} (${customTable.collectionName})`);
    
    // Verificar permisos
    if (req.user.role !== 'admin' && req.user.clientId !== customTable.clientId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para crear registros en esta tabla'
      });
    }
    
    // ✅ USAR MODELO DINÁMICO CON CACHE - SOLUCIÓN PRINCIPAL
    const DataModel = getDynamicModel(
      customTable.collectionName,
      customTable.getValidationSchema()
    );
    
    // Crear el registro
    const newRecord = new DataModel(recordData);
    await newRecord.save();
    
    console.log(`✅ Registro creado correctamente con ID: ${newRecord._id}`);
    
    res.json({
      success: true,
      message: 'Registro creado correctamente',
      record: newRecord
    });
    
  } catch (error) {
    console.error('❌ Error creando registro:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos: ' + error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error del servidor al crear el registro'
    });
  }
};

/**
 * ✅ FUNCIÓN CORREGIDA - Actualizar un registro existente
 */
exports.updateTableRecord = async (req, res) => {
  try {
    const { tableId, recordId } = req.params;
    const updateData = req.body;
    
    console.log(`✏️ Actualizando registro ${recordId} en tabla: ${tableId}`);
    
    // Obtener la definición de la tabla
    const customTable = await CustomTable.findById(tableId);
    if (!customTable) {
      return res.status(404).json({
        success: false,
        error: 'Tabla no encontrada'
      });
    }
    
    // Verificar permisos
    if (req.user.role !== 'admin' && req.user.clientId !== customTable.clientId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para modificar registros en esta tabla'
      });
    }
    
    // ✅ USAR MODELO DINÁMICO CON CACHE - SOLUCIÓN PRINCIPAL
    const DataModel = getDynamicModel(
      customTable.collectionName,
      customTable.getValidationSchema()
    );
    
    // Actualizar registro
    updateData.updatedAt = new Date();
    const updatedRecord = await DataModel.findByIdAndUpdate(
      recordId,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado'
      });
    }
    
    console.log(`✅ Registro actualizado correctamente: ${recordId}`);
    
    res.json({
      success: true,
      message: 'Registro actualizado correctamente',
      record: updatedRecord
    });
    
  } catch (error) {
    console.error('❌ Error actualizando registro:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos: ' + error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error del servidor al actualizar el registro'
    });
  }
};

/**
 * ✅ FUNCIÓN CORREGIDA - Eliminar un registro
 */
exports.deleteTableRecord = async (req, res) => {
  try {
    const { tableId, recordId } = req.params;
    
    console.log(`🗑️ Eliminando registro ${recordId} de tabla: ${tableId}`);
    
    // Obtener la definición de la tabla
    const customTable = await CustomTable.findById(tableId);
    if (!customTable) {
      return res.status(404).json({
        success: false,
        error: 'Tabla no encontrada'
      });
    }
    
    // Verificar permisos
    if (req.user.role !== 'admin' && req.user.clientId !== customTable.clientId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para eliminar registros en esta tabla'
      });
    }
    
    // ✅ USAR MODELO DINÁMICO CON CACHE - SOLUCIÓN PRINCIPAL
    const DataModel = getDynamicModel(
      customTable.collectionName,
      customTable.getValidationSchema()
    );
    
    // Eliminar registro
    const deletedRecord = await DataModel.findByIdAndDelete(recordId);
    
    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado'
      });
    }
    
    console.log(`✅ Registro eliminado correctamente: ${recordId}`);
    
    res.json({
      success: true,
      message: 'Registro eliminado correctamente'
    });
    
  } catch (error) {
    console.error('❌ Error eliminando registro:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al eliminar el registro'
    });
  }
};

// ✨ FUNCIÓN ÚTIL PARA DEBUGGING - Limpiar todo el cache
exports.clearModelCache = () => {
  console.log('🧹 Limpiando cache completo de modelos dinámicos...');
  dynamicModelsCache.clear();
  
  // También limpiar mongoose.models de modelos dinámicos
  const modelsToDelete = [];
  for (const modelName in mongoose.models) {
    // Solo eliminar modelos que parecen ser dinámicos (no los modelos principales)
    if (!['User', 'Chat', 'Message', 'CustomTable', 'Inscription', 'AssistantPrompt', 'ChatState'].includes(modelName)) {
      modelsToDelete.push(modelName);
    }
  }
  
  modelsToDelete.forEach(modelName => {
    delete mongoose.models[modelName];
    console.log(`🗑️ Modelo eliminado de mongoose.models: ${modelName}`);
  });
  
  console.log(`✅ Cache limpiado: ${modelsToDelete.length} modelos dinámicos eliminados`);
};