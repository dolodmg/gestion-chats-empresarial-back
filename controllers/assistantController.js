const axios = require('axios');
const dotenv = require('dotenv');
const AssistantPrompt = require('../models/AssistantPrompt');

dotenv.config();

// Configuración para la API de n8n
const N8N_API_URL = process.env.N8N_API_URL || 'https://n8n.pupuia.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

/**
 * Función SIMPLE para limpiar el workflow - Solo campos permitidos por n8n
 */
function cleanWorkflowForUpdate(workflow) {
  if (!workflow || typeof workflow !== 'object') {
    throw new Error('El workflow debe ser un objeto válido');
  }

  // Settings: solo campos permitidos por n8n API
  const allowedSettingsFields = [
    'saveExecutionProgress',
    'saveManualExecutions', 
    'saveDataErrorExecution',
    'saveDataSuccessExecution',
    'executionTimeout',
    'errorWorkflow',
    'timezone',
    'executionOrder'
  ];

  const cleanSettings = {};
  if (workflow.settings) {
    allowedSettingsFields.forEach(field => {
      if (workflow.settings[field] !== undefined) {
        cleanSettings[field] = workflow.settings[field];
      }
    });
  }

  // Si no hay settings válidos, usar default
  if (Object.keys(cleanSettings).length === 0) {
    cleanSettings.executionOrder = "v1";
  }

  // SOLO mantener los campos esenciales que necesita n8n
  return {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: cleanSettings,
    staticData: workflow.staticData || null
  };
}

/**
 * Función helper para encontrar el nodo del asistente en el workflow
 */
function findAssistantNode(workflow) {
  if (!workflow || !workflow.nodes) {
    console.log('❌ No hay workflow o nodes');
    return null;
  }

  console.log('🔍 === DEBUGGING BÚSQUEDA DE NODO ===');
  console.log('Tipo de nodes:', Array.isArray(workflow.nodes) ? 'Array' : 'Object');
  console.log('Cantidad de nodos:', Array.isArray(workflow.nodes) ? workflow.nodes.length : Object.keys(workflow.nodes).length);

  // Manejar tanto arrays como objetos
  let nodesToSearch = [];
  
  if (Array.isArray(workflow.nodes)) {
    nodesToSearch = workflow.nodes.map(node => ({
      ...node,
      nodeId: node.id
    }));
  } else {
    // Es un objeto, convertir a array para facilitar búsqueda
    nodesToSearch = Object.keys(workflow.nodes).map(key => ({
      ...workflow.nodes[key],
      nodeId: key
    }));
  }

  console.log('Nodos a buscar:', nodesToSearch.length);

  // Log de todos los nodos para debugging
  nodesToSearch.forEach((node, index) => {
    console.log(`Nodo ${index + 1}:`);
    console.log('  - ID:', node.nodeId);
    console.log('  - Nombre:', node.name);
    console.log('  - Tipo:', node.type);
    console.log('  - Tiene parameters:', !!node.parameters);
    console.log('  - Tiene options:', !!node.parameters?.options);
    console.log('  - Tiene systemMessage:', !!node.parameters?.options?.systemMessage);
    if (node.parameters?.options?.systemMessage) {
      console.log('  - SystemMessage preview:', node.parameters.options.systemMessage.substring(0, 100) + '...');
    }
    console.log('---');
  });

  // Buscar el nodo del asistente
  for (const node of nodesToSearch) {
    // Criterio 1: Nodo de tipo langchain.agent con systemMessage
    if (node.type === '@n8n/n8n-nodes-langchain.agent' && 
        node.parameters?.options?.systemMessage) {
      
      console.log('✅ ENCONTRADO por criterio 1 (langchain.agent):', node.nodeId);
      return {
        nodeId: node.nodeId,
        node: node,
        promptText: node.parameters.options.systemMessage
      };
    }
    
    // Criterio 2: Buscar por nombre que contenga "asistente"
    if (node.name && 
        node.name.toLowerCase().includes('asistente') && 
        node.parameters?.options?.systemMessage) {
      
      console.log('✅ ENCONTRADO por criterio 2 (nombre con asistente):', node.nodeId);
      return {
        nodeId: node.nodeId,
        node: node,
        promptText: node.parameters.options.systemMessage
      };
    }
  }
  
  console.log('❌ NO se encontró el nodo del asistente');
  console.log('=================================');
  return null;
}

/**
 * Función helper para actualizar el prompt en un nodo específico
 */
function updateNodePrompt(node, newPrompt) {
  if (node.parameters?.options?.systemMessage !== undefined) {
    node.parameters.options.systemMessage = newPrompt;
  } else if (node.parameters?.systemMessage !== undefined) {
    node.parameters.systemMessage = newPrompt;
  } else if (node.parameters?.text !== undefined) {
    node.parameters.text = newPrompt;
  } else {
    // Crear la estructura si no existe
    if (!node.parameters) node.parameters = {};
    if (!node.parameters.options) node.parameters.options = {};
    node.parameters.options.systemMessage = newPrompt;
  }
}

/**
 * Obtener workflowId del usuario
 */
async function getWorkflowIdForClient(clientId) {
  const User = require('../models/User');
  
  try {
    const user = await User.findOne({ clientId }).select('workflowId');
    if (user && user.workflowId) {
      console.log(`WorkflowId obtenido del usuario: ${user.workflowId}`);
      return user.workflowId;
    }
  } catch (error) {
    console.log('Error al buscar usuario:', error.message);
  }
  
  return null;
}

/**
 * Función de debugging para ver settings
 */
function debugSettings(workflow) {
  console.log('=== SETTINGS ACTUALES ===');
  if (workflow.settings) {
    console.log('Campos en settings:', Object.keys(workflow.settings));
    console.log('Settings completos:', JSON.stringify(workflow.settings, null, 2));
  } else {
    console.log('No hay settings en el workflow');
  }
  console.log('========================');
}

/**
 * Controlador para obtener el prompt del asistente
 */
exports.getAssistantPrompt = async (req, res) => {
  try {
    const clientId = req.user.role === 'admin'
      ? req.query.clientId
      : req.user.clientId;

    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere clientId' 
      });
    }

    console.log(`Obteniendo prompt del asistente para clientId: ${clientId}`);

    // 1. Buscar en BD primero (caché)
    const savedPrompt = await AssistantPrompt.findOne({ 
      clientId, 
      isActive: true 
    }).sort({ createdAt: -1 });

    if (savedPrompt) {
      return res.json({
        success: true,
        prompt: savedPrompt.promptText,
        workflowId: savedPrompt.workflowId,
        nodeId: savedPrompt.nodeId,
        version: savedPrompt.version,
        lastUpdated: savedPrompt.updatedAt,
        source: 'database'
      });
    }

    // 2. Si no hay en BD, obtener workflowId del usuario
    const workflowId = await getWorkflowIdForClient(clientId);
    
    if (!workflowId) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró workflowId para este cliente'
      });
    }
    
    // 3. Hacer GET a n8n para obtener el workflow
    const workflowResponse = await axios.get(`${N8N_API_URL}/workflows/${workflowId}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    if (!workflowResponse.data) {
      return res.status(404).json({
        success: false,
        error: 'No se pudo obtener el workflow desde n8n'
      });
    }

    // 4. Extraer el prompt del workflow
    const workflow = workflowResponse.data;
    const assistantNodeInfo = findAssistantNode(workflow);

    if (!assistantNodeInfo) {
      return res.status(404).json({
        success: false,
        error: 'No se pudo encontrar el prompt en el workflow'
      });
    }

    // 5. Guardar en BD para futuras consultas (caché)
    const newPrompt = new AssistantPrompt({
      clientId,
      workflowId,
      nodeId: assistantNodeInfo.nodeId,
      promptText: assistantNodeInfo.promptText,
      description: 'Prompt inicial'
    });

    await newPrompt.save();

    res.json({
      success: true,
      prompt: assistantNodeInfo.promptText,
      workflowId: workflowId,
      nodeId: assistantNodeInfo.nodeId,
      version: 1,
      source: 'n8n_imported'
    });

  } catch (error) {
    console.error('Error obteniendo prompt del asistente:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al obtener el prompt',
      details: error.message
    });
  }
};

/**
 * Controlador para actualizar el prompt del asistente
 */
exports.updateAssistantPrompt = async (req, res) => {
  try {
    const clientId = req.user.role === 'admin'
      ? req.query.clientId || req.body.clientId
      : req.user.clientId;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere clientId'
      });
    }

    const { prompt, description } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el texto del prompt'
      });
    }

    console.log(`Actualizando prompt del asistente para clientId: ${clientId}`);

    let workflowId, nodeId;

    // 1. Buscar workflowId y nodeId en BD primero
    const currentPrompt = await AssistantPrompt.findOne({ 
      clientId, 
      isActive: true 
    }).sort({ createdAt: -1 });

    if (currentPrompt) {
      workflowId = currentPrompt.workflowId;
      nodeId = currentPrompt.nodeId;
    } else {
      // Si no hay en BD, obtener workflowId del usuario
      workflowId = await getWorkflowIdForClient(clientId);
      
      if (!workflowId) {
        return res.status(404).json({
          success: false,
          error: 'No se encontró workflowId para este cliente'
        });
      }

      // Obtener el workflow para encontrar el nodeId
      const workflowResponse = await axios.get(`${N8N_API_URL}/workflows/${workflowId}`, {
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY
        }
      });

      const assistantNodeInfo = findAssistantNode(workflowResponse.data);
      if (!assistantNodeInfo) {
        return res.status(404).json({
          success: false,
          error: 'No se pudo encontrar el nodo del asistente en el workflow'
        });
      }

      nodeId = assistantNodeInfo.nodeId;
    }

    // 2. Hacer GET del workflow actual desde n8n
    const getResponse = await axios.get(`${N8N_API_URL}/workflows/${workflowId}`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    });

    if (!getResponse.data) {
      return res.status(404).json({
        success: false,
        error: 'No se pudo obtener el workflow desde n8n'
      });
    }

    const workflow = getResponse.data;
    
    // 3. Encontrar y actualizar el prompt en el nodo correcto
    let promptUpdated = false;
    
    if (Array.isArray(workflow.nodes)) {
      // Si nodes es array, buscar por id
      const nodeIndex = workflow.nodes.findIndex(node => 
        node.type === '@n8n/n8n-nodes-langchain.agent' && 
        node.parameters?.options?.systemMessage
      );
      
      if (nodeIndex !== -1) {
        workflow.nodes[nodeIndex].parameters.options.systemMessage = prompt;
        nodeId = workflow.nodes[nodeIndex].id;
        promptUpdated = true;
      }
    } else {
      // Si nodes es objeto, buscar en todos los nodos
      for (const [id, node] of Object.entries(workflow.nodes)) {
        if (node.type === '@n8n/n8n-nodes-langchain.agent' && 
            node.parameters?.options?.systemMessage) {
          node.parameters.options.systemMessage = prompt;
          nodeId = id;
          promptUpdated = true;
          break;
        }
      }
    }

    if (!promptUpdated) {
      return res.status(404).json({
        success: false,
        error: 'No se pudo encontrar el nodo del asistente en el workflow'
      });
    }

    // 4. Crear objeto simple para PUT
    const cleanedWorkflow = cleanWorkflowForUpdate(workflow);
    
    // DEBUG: Ver JSON que se enviará
    console.log('=== JSON QUE SE ENVIARÁ A N8N ===');
    console.log(JSON.stringify(cleanedWorkflow, null, 2));
    console.log('=================================');

    const updateResponse = await axios.put(`${N8N_API_URL}/workflows/${workflowId}`, cleanedWorkflow, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!updateResponse.data) {
      return res.status(500).json({
        success: false,
        error: 'Error al actualizar el workflow en n8n'
      });
    }

    // 5. Guardar nueva versión en BD
    // Marcar versión anterior como inactiva
    if (currentPrompt) {
      await AssistantPrompt.updateMany(
        { clientId, isActive: true },
        { $set: { isActive: false } }
      );
    }

    const newVersion = currentPrompt ? currentPrompt.version + 1 : 1;
    const newPrompt = new AssistantPrompt({
      clientId,
      workflowId,
      nodeId,
      promptText: prompt,
      version: newVersion,
      createdBy: req.user.id,
      description: description || `Actualización versión ${newVersion}`
    });

    await newPrompt.save();

    res.json({
      success: true,
      message: 'Prompt del asistente actualizado correctamente',
      version: newVersion,
      updatedAt: newPrompt.updatedAt
    });

  } catch (error) {
    console.error('💥 ERROR EN updateAssistantPrompt:');
    console.error('Message:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    res.status(500).json({
      success: false,
      error: 'Error del servidor al actualizar el prompt',
      details: error.message,
      n8nError: error.response?.data
    });
  }
};

/**
 * Controlador para obtener el historial de prompts
 */
exports.getPromptHistory = async (req, res) => {
  try {
    const clientId = req.user.role === 'admin'
      ? req.query.clientId
      : req.user.clientId;

    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere clientId' 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const prompts = await AssistantPrompt.find({ clientId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('version promptText description createdAt createdBy isActive');

    const total = await AssistantPrompt.countDocuments({ clientId });

    res.json({
      success: true,
      prompts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error obteniendo historial de prompts:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al obtener el historial',
      details: error.message
    });
  }
};

/**
 * Controlador para restaurar un prompt específico del historial
 */
exports.restorePrompt = async (req, res) => {
  try {
    const clientId = req.user.role === 'admin'
      ? req.query.clientId || req.body.clientId
      : req.user.clientId;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere clientId'
      });
    }

    const { promptId } = req.params;

    if (!promptId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el ID del prompt'
      });
    }

    // Buscar el prompt a restaurar
    const promptToRestore = await AssistantPrompt.findById(promptId);

    if (!promptToRestore || promptToRestore.clientId !== clientId) {
      return res.status(404).json({
        success: false,
        error: 'Prompt no encontrado'
      });
    }

    // Usar el método de actualización existente
    req.body.prompt = promptToRestore.promptText;
    req.body.description = `Restaurado desde versión ${promptToRestore.version}`;

    // Llamar al método de actualización
    await exports.updateAssistantPrompt(req, res);

  } catch (error) {
    console.error('Error restaurando prompt:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al restaurar el prompt',
      details: error.message
    });
  }
};