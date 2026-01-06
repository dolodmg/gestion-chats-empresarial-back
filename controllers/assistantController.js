const axios = require('axios');
const dotenv = require('dotenv');
const AssistantPrompt = require('../models/AssistantPrompt');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const ImprovementSuggestion = require('../models/ImprovementSuggestion');
const FAQ = require('../models/FAQ'); 

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

async function callAI(prompt) {
  try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini', 
          messages: [
            {
              role: 'system',
              content: 'Eres un experto Auditor de Calidad de Chatbots. Respondes ÚNICAMENTE en formato JSON válido.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, 
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          }
        }
      );

      const content = response.data.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('Error llamando a OpenAI:', error.response?.data || error.message);
      throw new Error('Falló el análisis de IA');
    }
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

    req.body.prompt = promptToRestore.promptText;
    req.body.description = `Restaurado desde versión ${promptToRestore.version}`;

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
    
  exports.generateImprovements = async (req, res) => {
  try {
    const clientId = req.user.role === 'admin'
      ? req.query.clientId
      : req.user.clientId;

    console.log(`🕵️‍♀️ [DEBUG] Iniciando auditoría para cliente: ${clientId}`);

    // 1. Obtener System Message
    const currentPromptData = await AssistantPrompt.findOne({ clientId, isActive: true }).sort({ createdAt: -1 });
    const currentSystemMessage = currentPromptData ? currentPromptData.promptText : "No definido o genérico";

    // 2. Obtener Chats Recientes
    const recentChats = await Chat.find({ clientId })
      .sort({ updatedAt: -1 })
      .limit(20);

    console.log(`[DEBUG] Chats encontrados en DB: ${recentChats.length}`);

    if (recentChats.length === 0) {
      return res.json({ success: true, message: 'No hay chats.', suggestions: [] });
    }

    // 3. Serializar conversaciones
    let transcript = "";
    for (const chat of recentChats) {
      const msgs = await Message.find({ chatId: chat.chatId })
        .sort({ timestamp: 1 })
        .limit(15); 
      
      if (msgs.length < 2) continue; 

      transcript += `\n--- CHAT ${chat.chatId.substring(0, 4)} ---\n`;
      msgs.forEach(m => {
        const role = m.sender === 'user' ? 'USUARIO' : 'BOT';
        const content = m.content ? m.content.replace(/\n/g, ' ').substring(0, 200) : ''; 
        transcript += `${role}: ${content}\n`;
      });
    }

    if (transcript.length < 50) {
      return res.json({ success: true, message: 'Transcript vacío.', suggestions: [] });
    }

    // 4. Prompt Auditor
    const auditorPrompt = `Analiza el desempeño del bot.
CONTEXTO:
"""
${currentSystemMessage.substring(0, 3000)}
"""
CHATS:
"""
${transcript.substring(0, 15000)}
"""
TAREA: Detectar fallas.
CASOS:
1. KNOWLEDGE_GAP (Bot no sabe responder).
2. ESCALATION (Piden humano/Enojo).
3. SENTIMENT (Quejas).

SALIDA JSON:
Devuelve un objeto JSON con una propiedad "suggestions" que contenga el array de problemas detectados.
Ejemplo:
{
  "suggestions": [
    {"type": "knowledge_gap", "title": "...", "description": "...", "severity": "high"}
  ]
}`;

    // 5. Llamar a IA
    console.log('[DEBUG] Llamando a OpenAI...');
    const aiResponse = await callAI(auditorPrompt);
    console.log('[DEBUG] Respuesta OpenAI Raw:', JSON.stringify(aiResponse, null, 2));

    // --- LÓGICA DE EXTRACCIÓN ROBUSTA (EL ARREGLO) ---
    let suggestionsData = [];

    if (Array.isArray(aiResponse)) {
      suggestionsData = aiResponse;
    } else if (aiResponse.suggestions && Array.isArray(aiResponse.suggestions)) {
      suggestionsData = aiResponse.suggestions;
    } else if (aiResponse.issues && Array.isArray(aiResponse.issues)) {
      suggestionsData = aiResponse.issues; // <--- Aquí atrapamos el caso de tu log
    } else {
      // Intento final: buscar cualquier propiedad que sea un array
      const keys = Object.keys(aiResponse);
      for (const key of keys) {
        if (Array.isArray(aiResponse[key])) {
          suggestionsData = aiResponse[key];
          console.log(`[DEBUG] Array encontrado en propiedad: '${key}'`);
          break;
        }
      }
    }

    // 6. Guardar resultados
    await ImprovementSuggestion.deleteMany({ clientId, status: 'pending' });

    const savedSuggestions = [];
    if (Array.isArray(suggestionsData)) {
      for (const sugg of suggestionsData) {
        const type = sugg.type ? sugg.type.toLowerCase() : '';
        
        if (['knowledge_gap', 'escalation', 'sentiment'].includes(type)) {
            const newSugg = await ImprovementSuggestion.create({
              clientId,
              type: type,
              title: sugg.title,
              description: sugg.description,
              severity: sugg.severity || 'medium',
              status: 'pending'
            });
            savedSuggestions.push(newSugg);
        }
      }
    }

    console.log(`[DEBUG] Total guardado en DB: ${savedSuggestions.length}`);

    res.json({
      success: true,
      count: savedSuggestions.length,
      suggestions: savedSuggestions
    });

  } catch (error) {
    console.error('❌ Error en generateImprovements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getImprovements = async (req, res) => {
  try {
    const clientId = req.user.role === 'admin'
      ? req.query.clientId
      : req.user.clientId;

      const suggestions = await ImprovementSuggestion.find({ clientId, status: 'pending' })
        .sort({ severity: -1, createdAt: -1 }); 

      res.json({ success: true, suggestions });
    } catch (error) {
      console.error('Error obteniendo mejoras:', error);
      res.status(500).json({ success: false, error: 'Error al obtener mejoras' });
    }
};

exports.getAnalytics = async (req, res) => {
  try {
    const clientId = req.user.role === 'admin' ? req.query.clientId : req.user.clientId;
    
    // Rango: Últimos 7 días
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    console.log(`📊 Analytics reales para ${clientId}`);

    // 1. VOLUMEN TOTAL (Real)
    const volumeStats = await Message.aggregate([
      { $match: { clientId, timestamp: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: "$sender", count: { $sum: 1 } } }
    ]);

    const received = volumeStats.find(s => s._id === 'user')?.count || 0;
    const sent = volumeStats.find(s => s._id === 'bot')?.count || 0;

    const dailyTrend = await Message.aggregate([
      { $match: { clientId, timestamp: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          total: { $sum: 1 },
          userCount: { $sum: { $cond: [{ $eq: ["$sender", "user"] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const peakHours = await Message.aggregate([
      { $match: { clientId, timestamp: { $gte: startDate } } },
      { $group: { _id: { $hour: "$timestamp" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 }
    ]);

    const topCategories = await FAQ.aggregate([
      { $match: { clientId, status: 'active' } },
      { $group: { _id: "$category", total: { $sum: "$totalCount" } } },
      { $sort: { total: -1 } },
      { $limit: 4 } 
    ]);

    let satisfactionRate = null;
    if (received > 5) { 
       const positiveMessages = await Message.countDocuments({
         clientId, sender: 'user', timestamp: { $gte: startDate },
         content: { $regex: /gracias|excelente|bueno|genial|sirve|ayuda/i }
       });
       satisfactionRate = Math.min(Math.round((positiveMessages / received) * 100) + 50, 100);
    }

    res.json({
      success: true,
      stats: {
        received,
        sent,
        total: received + sent,
        dailyTrend,
        peakHours: peakHours.map(h => `${h._id}:00`),
        topCategories: topCategories.map(c => ({ category: c._id, count: c.total })),
        satisfactionRate 
      }
    });

  } catch (error) {
    console.error('Error analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};