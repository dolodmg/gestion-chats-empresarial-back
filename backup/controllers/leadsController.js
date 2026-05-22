/**
 * MULTI-CLIENT LEADS CONTROLLER 
 * API para carga masiva con asignación automática de asesores
 * Soporte para múltiples clientes: 676360675564956, 564098906790434, etc.
 */

const mongoose = require('mongoose');
const CustomTable = require('../models/CustomTable');

// Cache para modelos dinámicos
const dynamicModelsCache = new Map();

/**
 * Obtener o crear modelo dinámico con cache
 */
function getDynamicModel(collectionName, schema) {
  if (dynamicModelsCache.has(collectionName)) {
    return dynamicModelsCache.get(collectionName);
  }
  
  if (mongoose.models[collectionName]) {
    dynamicModelsCache.set(collectionName, mongoose.models[collectionName]);
    return mongoose.models[collectionName];
  }
  
  const DynamicModel = mongoose.model(
    collectionName,
    new mongoose.Schema(schema),
    collectionName
  );
  
  dynamicModelsCache.set(collectionName, DynamicModel);
  return DynamicModel;
}

/**
 * Obtener CLIENT_ID desde el token JWT o desde el body/query
 */
function getClientIdFromRequest(req) {
  // Opción 1: Desde el token JWT (si el usuario es cliente)
  if (req.user && req.user.clientId) {
    return req.user.clientId;
  }
  
  // Opción 2: Desde el body de la request
  if (req.body && req.body.clientId) {
    return req.body.clientId;
  }
  
  // Opción 3: Desde query parameter
  if (req.query && req.query.clientId) {
    return req.query.clientId;
  }
  
  // Opción 4: Desde header personalizado
  if (req.headers['x-client-id']) {
    return req.headers['x-client-id'];
  }
  
  return null;
}

/**
 * Validar que el cliente tiene las tablas configuradas
 */
async function validateClientHasTables(clientId) {
  const asesoresTable = await CustomTable.findOne({
    collectionName: `asesores_${clientId}`
  });
  
  if (!asesoresTable) {
    throw new Error(`Cliente ${clientId} no tiene las tablas configuradas. Ejecute el script de creación de tablas.`);
  }
  
  return true;
}

/**
 * Obtener asesor usando round-robin para un servicio específico
 */
async function getNextAdvisorForService(clientId, servicio) {
  try {
    // Obtener tabla de asesores del cliente
    const asesoresTable = await CustomTable.findOne({
      collectionName: `asesores_${clientId}`
    });
    
    if (!asesoresTable) {
      throw new Error(`Tabla de asesores no encontrada para cliente ${clientId}`);
    }
    
    const AsesoresModel = getDynamicModel(
      `asesores_${clientId}`,
      asesoresTable.getValidationSchema()
    );
    
    // Buscar asesores activos para el servicio específico
    const asesores = await AsesoresModel.find({
      servicio: servicio,
      activo: true
    }).sort({ createdAt: 1 });
    
    if (asesores.length === 0) {
      console.warn(`No hay asesores activos para el servicio: ${servicio} (Cliente: ${clientId})`);
      return null;
    }
    
    // Obtener tabla de contactos para contar asignaciones
    const contactoTable = await CustomTable.findOne({
      collectionName: `contacto_${clientId}`
    });
    
    if (!contactoTable) {
      return asesores[0].nombre;
    }
    
    const ContactoModel = getDynamicModel(
      `contacto_${clientId}`,
      contactoTable.getValidationSchema()
    );
    
    // Contar asignaciones por asesor en las últimas 24 horas
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const assignmentCounts = {};
    
    for (const asesor of asesores) {
      const count = await ContactoModel.countDocuments({
        servicio: servicio,
        asesor: asesor.nombre,
        fecha_hora: { $gte: yesterday }
      });
      assignmentCounts[asesor.nombre] = count;
    }
    
    // Encontrar asesor con menos asignaciones
    const sortedAsesores = asesores.sort((a, b) => {
      return assignmentCounts[a.nombre] - assignmentCounts[b.nombre];
    });
    
    return sortedAsesores[0].nombre;
    
  } catch (error) {
    console.error(`Error en round-robin de asesores (Cliente ${clientId}):`, error);
    return null;
  }
}

/**
 * Mapear servicio a nombre de colección para un cliente específico
 */
function getCollectionForService(clientId, servicio) {
  const mapping = {
    "Ventas": `ventas_${clientId}`,
    "Compras": `compras_${clientId}`, 
    "Lavadero": `lavadero_${clientId}`,
    "Taller Mecánico Pilar": `taller_pilar_${clientId}`,
    "Taller Mecánico Maschwitz": `taller_maschwitz_${clientId}`,
    "Taller de Chapa y Pintura": `chapa_pintura_${clientId}`
  };
  
  return mapping[servicio];
}

/**
 * Validar que el servicio es válido
 */
function validateService(servicio) {
  const validServices = [
    "Ventas", 
    "Compras", 
    "Lavadero", 
    "Taller Mecánico Pilar", 
    "Taller Mecánico Maschwitz", 
    "Taller de Chapa y Pintura"
  ];
  
  return validServices.includes(servicio);
}

/**
 * API ENDPOINT: Crear lead individual
 * POST /api/leads/create
 */
exports.createLead = async (req, res) => {
  try {
    const leadData = req.body;
    
    // Obtener CLIENT_ID
    const clientId = getClientIdFromRequest(req);
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'CLIENT_ID es requerido. Proporciona clientId en el body, query, header x-client-id, o asegúrate que tu token JWT tenga clientId.'
      });
    }
    
    console.log(`Creando lead para cliente ${clientId}:`, leadData);
    
    // Validar que el cliente tiene tablas configuradas
    await validateClientHasTables(clientId);
    
    // Validaciones básicas
    if (!leadData.servicio || !validateService(leadData.servicio)) {
      return res.status(400).json({
        success: false,
        error: `Servicio inválido. Debe ser uno de: Ventas, Compras, Lavadero, Taller Mecánico Pilar, Taller Mecánico Maschwitz, Taller de Chapa y Pintura`
      });
    }
    
    if (!leadData.telefono || !leadData.nombre) {
      return res.status(400).json({
        success: false,
        error: 'Los campos telefono y nombre son requeridos'
      });
    }
    
    // Asignar asesor automáticamente
    const asesor = await getNextAdvisorForService(clientId, leadData.servicio);
    leadData.asesor = asesor;
    leadData.fecha_hora = leadData.fecha_hora || new Date();
    
    // Obtener colección específica del servicio para este cliente
    const collectionName = getCollectionForService(clientId, leadData.servicio);
    const serviceTable = await CustomTable.findOne({ collectionName });
    
    if (!serviceTable) {
      return res.status(404).json({
        success: false,
        error: `Tabla para servicio ${leadData.servicio} no encontrada para cliente ${clientId}`
      });
    }
    
    // Crear registro en tabla específica
    const ServiceModel = getDynamicModel(collectionName, serviceTable.getValidationSchema());
    const serviceRecord = new ServiceModel(leadData);
    await serviceRecord.save();
    
    // Crear registro en tabla Contacto (resumen)
    const contactoTable = await CustomTable.findOne({
      collectionName: `contacto_${clientId}`
    });
    
    if (contactoTable) {
      const ContactoModel = getDynamicModel(`contacto_${clientId}`, contactoTable.getValidationSchema());
      const contactoRecord = new ContactoModel({
        fecha_hora: leadData.fecha_hora,
        servicio: leadData.servicio,
        telefono: leadData.telefono,
        nombre: leadData.nombre,
        asesor: asesor
      });
      await contactoRecord.save();
    }
    
    console.log(`Lead creado: ${leadData.nombre} - ${leadData.servicio} - Cliente: ${clientId} - Asesor: ${asesor}`);
    
    res.json({
      success: true,
      message: 'Lead creado correctamente',
      data: {
        id: serviceRecord._id,
        clientId: clientId,
        servicio: leadData.servicio,
        asesor: asesor,
        created_at: serviceRecord.createdAt || serviceRecord.fecha_hora
      }
    });
    
  } catch (error) {
    console.error('Error creando lead:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};

/**
 * API ENDPOINT: Carga masiva de leads  
 * POST /api/leads/bulk-create
 */
exports.bulkCreateLeads = async (req, res) => {
  try {
    const { leads } = req.body;
    
    // Obtener CLIENT_ID
    const clientId = getClientIdFromRequest(req);
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'CLIENT_ID es requerido'
      });
    }
    
    console.log(`Iniciando carga masiva de ${leads?.length || 0} leads para cliente ${clientId}`);
    
    // Validar que el cliente tiene tablas configuradas
    await validateClientHasTables(clientId);
    
    // Validaciones
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de leads no vacío'
      });
    }
    
    if (leads.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Máximo 100 leads por solicitud'
      });
    }
    
    const results = {
      success: [],
      errors: [],
      total: leads.length
    };
    
    // Procesar cada lead
    for (let i = 0; i < leads.length; i++) {
      try {
        const leadData = leads[i];
        
        // Validar lead individual
        if (!leadData.servicio || !leadData.telefono || !leadData.nombre) {
          results.errors.push({
            index: i,
            data: leadData,
            error: 'Campos requeridos faltantes: servicio, telefono, nombre'
          });
          continue;
        }
        
        if (!validateService(leadData.servicio)) {
          results.errors.push({
            index: i,
            data: leadData,
            error: 'Servicio inválido'
          });
          continue;
        }
        
        // Asignar asesor
        const asesor = await getNextAdvisorForService(clientId, leadData.servicio);
        leadData.asesor = asesor;
        leadData.fecha_hora = leadData.fecha_hora || new Date();
        
        // Guardar en tabla específica
        const collectionName = getCollectionForService(clientId, leadData.servicio);
        const serviceTable = await CustomTable.findOne({ collectionName });
        
        if (!serviceTable) {
          results.errors.push({
            index: i,
            data: leadData,
            error: `Tabla para servicio ${leadData.servicio} no encontrada para cliente ${clientId}`
          });
          continue;
        }
        
        const ServiceModel = getDynamicModel(collectionName, serviceTable.getValidationSchema());
        const serviceRecord = new ServiceModel(leadData);
        await serviceRecord.save();
        
        // Guardar en tabla Contacto
        const contactoTable = await CustomTable.findOne({
          collectionName: `contacto_${clientId}`
        });
        
        if (contactoTable) {
          const ContactoModel = getDynamicModel(`contacto_${clientId}`, contactoTable.getValidationSchema());
          const contactoRecord = new ContactoModel({
            fecha_hora: leadData.fecha_hora,
            servicio: leadData.servicio,
            telefono: leadData.telefono,
            nombre: leadData.nombre,
            asesor: asesor
          });
          await contactoRecord.save();
        }
        
        results.success.push({
          index: i,
          id: serviceRecord._id,
          servicio: leadData.servicio,
          asesor: asesor
        });
        
      } catch (error) {
        results.errors.push({
          index: i,
          data: leads[i],
          error: error.message
        });
      }
    }
    
    console.log(`Carga masiva completada para cliente ${clientId}: ${results.success.length} exitosos, ${results.errors.length} errores`);
    
    res.json({
      success: true,
      message: `Procesados ${results.total} leads para cliente ${clientId}`,
      results: {
        clientId: clientId,
        processed: results.total,
        successful: results.success.length,
        failed: results.errors.length,
        success_details: results.success,
        error_details: results.errors
      }
    });
    
  } catch (error) {
    console.error('Error en carga masiva:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};

/**
 * API ENDPOINT: Obtener estadísticas de asesores
 * GET /api/leads/advisor-stats
 */
exports.getAdvisorStats = async (req, res) => {
  try {
    const { servicio, days = 7 } = req.query;
    
    // Obtener CLIENT_ID
    const clientId = getClientIdFromRequest(req);
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'CLIENT_ID es requerido'
      });
    }
    
    await validateClientHasTables(clientId);
    
    // Calcular fecha límite
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - parseInt(days));
    
    const contactoTable = await CustomTable.findOne({
      collectionName: `contacto_${clientId}`
    });
    
    if (!contactoTable) {
      return res.status(404).json({
        success: false,
        error: `Tabla de contacto no encontrada para cliente ${clientId}`
      });
    }
    
    const ContactoModel = getDynamicModel(`contacto_${clientId}`, contactoTable.getValidationSchema());
    
    // Construir filtro
    const filter = {
      fecha_hora: { $gte: dateLimit }
    };
    
    if (servicio && validateService(servicio)) {
      filter.servicio = servicio;
    }
    
    // Agregación para obtener estadísticas
    const stats = await ContactoModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            asesor: "$asesor",
            servicio: "$servicio"
          },
          count: { $sum: 1 },
          latest: { $max: "$fecha_hora" }
        }
      },
      {
        $group: {
          _id: "$_id.asesor",
          total_assignments: { $sum: "$count" },
          services: {
            $push: {
              servicio: "$_id.servicio",
              count: "$count",
              latest: "$latest"
            }
          }
        }
      },
      { $sort: { total_assignments: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        clientId: clientId,
        period_days: parseInt(days),
        date_from: dateLimit,
        stats: stats
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};

/**
 * API ENDPOINT: Health check
 * GET /api/leads/health
 */
exports.healthCheck = async (req, res) => {
  try {
    // Obtener CLIENT_ID (opcional para health check)
    const clientId = getClientIdFromRequest(req);
    
    // Verificar conexión a MongoDB
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    const response = {
      success: true,
      status: 'healthy',
      timestamp: new Date(),
      mongodb: mongoStatus
    };
    
    // Si se proporciona clientId, verificar sus tablas
    if (clientId) {
      const asesoresTable = await CustomTable.findOne({
        collectionName: `asesores_${clientId}`
      });
      
      const contactoTable = await CustomTable.findOne({
        collectionName: `contacto_${clientId}`
      });
      
      response.client_info = {
        clientId: clientId,
        tables: {
          asesores: asesoresTable ? 'exists' : 'missing',
          contacto: contactoTable ? 'exists' : 'missing'
        }
      };
    }
    
    // Listar clientes configurados
    const configuredClients = await CustomTable.distinct('clientId');
    response.configured_clients = configuredClients;
    
    res.json(response);
    
  } catch (error) {
    console.error('Error en health check:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
};

/**
 * API ENDPOINT: Listar clientes configurados
 * GET /api/leads/clients
 */
exports.listConfiguredClients = async (req, res) => {
  try {
    // Obtener todos los clientes que tienen tablas configuradas
    const clientsData = await CustomTable.aggregate([
      {
        $group: {
          _id: "$clientId",
          tables_count: { $sum: 1 },
          tables: { $push: "$tableName" },
          created_at: { $min: "$createdAt" }
        }
      },
      { $sort: { created_at: -1 } }
    ]);
    
    const configuredClients = clientsData.map(client => ({
      clientId: client._id,
      tables_count: client.tables_count,
      tables: client.tables,
      has_complete_setup: client.tables_count >= 8, // 8 tablas esperadas
      created_at: client.created_at
    }));
    
    res.json({
      success: true,
      data: {
        total_clients: configuredClients.length,
        clients: configuredClients
      }
    });
    
  } catch (error) {
    console.error('Error listando clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};

module.exports = {
  createLead: exports.createLead,
  bulkCreateLeads: exports.bulkCreateLeads,
  getAdvisorStats: exports.getAdvisorStats,
  healthCheck: exports.healthCheck,
  listConfiguredClients: exports.listConfiguredClients
};