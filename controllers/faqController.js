const Message = require('../models/Message');
const FAQ = require('../models/FAQ');
const AssistantPrompt = require('../models/AssistantPrompt'); 
const Chat = require('../models/Chat');

exports.analyzeFAQs = async (req, res) => {
  try {
    const { clientId } = req.query;
    const user = req.user;
    const effectiveClientId = user.role === 'admin' ? clientId : user.clientId;
    
    if (!effectiveClientId) {
      return res.status(400).json({ success: false, error: 'clientId es requerido' });
    }

    console.log(`🔍 Analizando FAQs para cliente: ${effectiveClientId}`);

    let businessContext = '';
    try {
      const assistantData = await AssistantPrompt.findOne({ 
        clientId: effectiveClientId, 
        isActive: true 
      }).select('promptText');
      
      if (assistantData && assistantData.promptText) {
        businessContext = assistantData.promptText;
        console.log('🧠 Contexto del negocio cargado exitosamente.');
      }
    } catch (err) {
      console.warn('⚠️ No se pudo cargar el contexto del asistente, usando modo genérico.');
    }

    const userMessages = await Message.find({
      clientId: effectiveClientId,
      sender: 'user',
      content: { $exists: true, $ne: '', $ne: null, $type: 'string' }
    })
    .select('content chatId timestamp')
    .sort({ timestamp: -1 })
    .limit(20000);

    const validMessages = userMessages.filter(msg => msg.content && typeof msg.content === 'string' && msg.content.trim().length > 0);

    if (validMessages.length === 0) {
      return res.json({
        success: true,
        message: 'No se encontraron preguntas para analizar',
        faqs: [],
        stats: { messagesAnalyzed: 0, faqsGenerated: 0 }
      });
    }

    const groupedQuestions = await groupQuestionsByAI(validMessages, effectiveClientId, businessContext);
    const faqsWithResponses = await enrichFAQsWithResponses(groupedQuestions, effectiveClientId);
    const savedFAQs = await saveFAQs(faqsWithResponses, effectiveClientId);
    res.json({
      success: true,
      message: 'Análisis completado exitosamente',
      faqs: savedFAQs,
      stats: {
        messagesAnalyzed: validMessages.length,
        faqsGenerated: savedFAQs.length,
        analyzedPeriod: 'Últimos 2000 mensajes'
      }
    });

  } catch (error) {
    console.error('❌ Error analizando FAQs:', error);
    res.status(500).json({ success: false, error: 'Error al analizar preguntas frecuentes', details: error.message });
  }
};

exports.getFAQs = async (req, res) => {
  try {
    const { clientId, status = 'active', category, limit = 50, skip = 0 } = req.query;
    const user = req.user;

    const effectiveClientId = user.role === 'admin' ? clientId : user.clientId;
    
    if (!effectiveClientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'clientId es requerido' 
      });
    }

    const query = { 
      clientId: effectiveClientId,
      status 
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    const faqs = await FAQ.find(query)
      .sort({ totalCount: -1, isPinned: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await FAQ.countDocuments(query);

    const categories = await FAQ.distinct('category', { 
      clientId: effectiveClientId,
      status: 'active' 
    });

    res.json({
      success: true,
      faqs,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > (parseInt(skip) + parseInt(limit))
      },
      categories
    });

  } catch (error) {
    console.error('Error obteniendo FAQs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener FAQs' 
    });
  }
};

exports.updateFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { customResponse, category, isPinned, status } = req.body;
    const user = req.user;

    const faq = await FAQ.findById(id);
    
    if (!faq) {
      return res.status(404).json({ 
        success: false, 
        error: 'FAQ no encontrada' 
      });
    }

    if (user.role !== 'admin' && faq.clientId !== user.clientId) {
      return res.status(403).json({ 
        success: false, 
        error: 'No tienes permisos para modificar esta FAQ' 
      });
    }

    if (customResponse !== undefined) faq.customResponse = customResponse;
    if (category !== undefined) faq.category = category;
    if (isPinned !== undefined) faq.isPinned = isPinned;
    if (status !== undefined) faq.status = status;

    await faq.save();

    res.json({
      success: true,
      faq
    });

  } catch (error) {
    console.error('Error actualizando FAQ:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al actualizar FAQ' 
    });
  }
};

exports.deleteFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const faq = await FAQ.findById(id);
    
    if (!faq) {
      return res.status(404).json({ 
        success: false, 
        error: 'FAQ no encontrada' 
      });
    }

    if (user.role !== 'admin' && faq.clientId !== user.clientId) {
      return res.status(403).json({ 
        success: false, 
        error: 'No tienes permisos para eliminar esta FAQ' 
      });
    }

    await FAQ.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'FAQ eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando FAQ:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al eliminar FAQ' 
    });
  }
};

exports.getFAQStats = async (req, res) => {
  try {
    const { clientId } = req.query;
    const user = req.user;

    const effectiveClientId = user.role === 'admin' ? clientId : user.clientId;
    
    if (!effectiveClientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'clientId es requerido' 
      });
    }

    const totalFAQs = await FAQ.countDocuments({ 
      clientId: effectiveClientId, 
      status: 'active' 
    });

    const totalQuestions = await FAQ.aggregate([
      { $match: { clientId: effectiveClientId, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$totalCount' } } }
    ]);

    const categoriesStats = await FAQ.aggregate([
      { $match: { clientId: effectiveClientId, status: 'active' } },
      { 
        $group: { 
          _id: '$category', 
          count: { $sum: 1 },
          totalQuestions: { $sum: '$totalCount' }
        } 
      },
      { $sort: { totalQuestions: -1 } }
    ]);

    const topFAQs = await FAQ.find({ 
      clientId: effectiveClientId, 
      status: 'active' 
    })
    .sort({ totalCount: -1 })
    .limit(5)
    .select('canonicalQuestion totalCount category');

    res.json({
      success: true,
      stats: {
        totalFAQs,
        totalQuestions: totalQuestions[0]?.total || 0,
        categories: categoriesStats.map(cat => ({
          category: cat._id,
          faqCount: cat.count,
          questionCount: cat.totalQuestions
        })),
        topFAQs
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener estadísticas' 
    });
  }
};

async function groupQuestionsByAI(messages, clientId, businessContext) {
  try {
    const questions = messages
      .map(m => m.content)
      .filter(content => content && typeof content === 'string')
      .map(content => content.trim())
      .filter(q => q.length > 5); 
    const cleanQuestions = questions.filter(q => {
      const lower = q.toLowerCase();
      const forbidden = ['gracias', 'muchas gracias', 'ok dale', 'perfecto', 'buenisimo', 'si obvio', 'dale genial', 'hola', 'buen dia', 'info'];
      return !forbidden.some(f => lower === f); 
    });

    const sampleSize = Math.min(cleanQuestions.length, 400);
    const sampledQuestions = cleanQuestions.slice(0, sampleSize);

    console.log(`🤖 Enviando ${sampledQuestions.length} mensajes a IA para agrupar...`);

    const prompt = `Eres un Analista de Datos experto y estricto.
CONTEXTO DEL NEGOCIO:
"""
${businessContext ? businessContext.substring(0, 3000) : 'Negocio general'}
"""

TU TAREA:
Agrupar mensajes en Preguntas Frecuentes (FAQs).

REGLAS DE ORO PARA EL TÍTULO (CANONICAL QUESTION):
1. **REPRESENTATIVIDAD:** El título (canonicalQuestion) debe reflejar la intención DE LA MAYORÍA de los mensajes del grupo, no del mensaje más largo o complejo.
   - Si 10 personas dicen "¿Cómo funcionan los préstamos?" y 1 dice "¿Qué tasa tiene?", el título DEBE SER "¿Cómo funcionan los préstamos?".

REGLAS DE AGRUPACIÓN (ANTI-MEZCLA):
1. **ALQUILER vs VENTA/FINANCIACIÓN:** SON COSAS DISTINTAS. 
   - Si alguien pregunta por "Alquilar", "Rentar" o "Por día", NO lo agrupes con "Comprar", "Financiar" o "Préstamos". Haz un grupo aparte o ignóralo si son pocos.
2. **INTENCIONES MIXTAS:** No agrupes "Requisitos" con "Precios". Si no estás seguro, sepáralos.

REGLAS DE FUSIÓN (MERGE):
- Si ves un grupo "¿Cómo funcionan los préstamos?" y otro "¿Info sobre préstamos?", JÚNTALOS EN UNO SOLO. Son la misma intención.

CATEGORÍAS (4): "Precios/Financiamiento", "Productos/Servicios", "Soporte Técnico", "Información General".

INPUT (Muestra):
${sampledQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

FORMATO JSON:
{
  "groups": [
    {
      "canonicalQuestion": "Pregunta representativa de la mayoría",
      "category": "Categoría",
      "variations": ["texto original 1", "texto original 2"]
    }
  ]
}`;
    
    const grouped = await callAI(prompt);
    
    const groupsWithCounts = grouped.groups.map(group => {
      const finalCategory = assignStrictCategory(group.canonicalQuestion, group.category);

      const variations = group.variations.map(variation => {
        
        const count = questions.filter(q => 
          areTextsSimilar(q, variation) 
        ).length;
        
        return {
          question: variation,
          count: Math.max(count, 1), 
          lastSeen: new Date()
        };
      });

      const totalCount = variations.reduce((sum, v) => sum + v.count, 0);

      return {
        ...group,
        category: finalCategory,
        variations,
        totalCount
      };
    });

    const validGroups = groupsWithCounts.filter(g => g.totalCount >= 3);
    const finalGroups = mergeSimilarGroups(validGroups);
    
    return finalGroups;

  } catch (error) {
    console.error('Error agrupando con IA:', error);
    return [];
  }
}

function areTextsSimilar(text1, text2) {
  const normalize = (t) => t.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();

  const t1 = normalize(text1);
  const t2 = normalize(text2);

  if (t1 === t2) return true;

  const getBigrams = (text) => {
    const words = text.split(/\s+/).filter(w => w.length > 2); 
    const bigrams = new Set();
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.add(`${words[i]} ${words[i+1]}`);
    }
    return bigrams;
  };

  const bg1 = getBigrams(t1);
  const bg2 = getBigrams(t2);

  if (bg1.size < 2 || bg2.size < 2) {
    const words1 = new Set(t1.split(/\s+/));
    const words2 = new Set(t2.split(/\s+/));
    const intersection = [...words1].filter(x => words2.has(x)).length;
    const union = new Set([...words1, ...words2]).size;
    return (intersection / union) > 0.75; 
  }

  let intersection = 0;
  bg1.forEach(pair => {
    if (bg2.has(pair)) intersection++;
  });

  const union = new Set([...bg1, ...bg2]).size;
  const similarity = intersection / union;

   return similarity >= 0.4; 
}

function mergeSimilarGroups(groups) {
  const merged = [];
  const processedIndices = new Set();

  for (let i = 0; i < groups.length; i++) {
    if (processedIndices.has(i)) continue;

    let masterGroup = { ...groups[i] };
    processedIndices.add(i);

    for (let j = i + 1; j < groups.length; j++) {
      if (processedIndices.has(j)) continue;

      const candidate = groups[j];

      if (areTextsSimilar(masterGroup.canonicalQuestion, candidate.canonicalQuestion) || 
          masterGroup.canonicalQuestion.includes(candidate.canonicalQuestion) ||
          candidate.canonicalQuestion.includes(masterGroup.canonicalQuestion)) {
        
        console.log(`🔗 Fusionando grupos similares: "${masterGroup.canonicalQuestion}" + "${candidate.canonicalQuestion}"`);
        
        masterGroup.variations = [...masterGroup.variations, ...candidate.variations];
        if (candidate.canonicalQuestion.length < masterGroup.canonicalQuestion.length) {
          masterGroup.canonicalQuestion = candidate.canonicalQuestion;
        }
        
        processedIndices.add(j);
      }
    }
    merged.push(masterGroup);
  }
  return merged;
}

function assignStrictCategory(text, aiCategory) {
  const t = normalizeText(text);

  if (
    t.includes('precio') || t.includes('valor') || t.includes('cuesta') || t.includes('sale') || 
    t.includes('financ') || t.includes('prestamo') || t.includes('cuota') || t.includes('banco') || t.includes('tarjeta') || t.includes('pago') || t.includes('interes') 
  ) {
    return 'Precios/Financiamiento';
  }

  if (t.includes('funciona') || t.includes('roto') || t.includes('falla') || t.includes('problema') || t.includes('tecnico') || t.includes('garantia') || t.includes('reparar')) {
    return 'Soporte Técnico';
  }

  if (aiCategory === 'Ventas' || aiCategory === 'Pedidos' || t.includes('stock') || t.includes('modelo') || t.includes('catalogo') || t.includes('disponible')) {
    return 'Productos/Servicios';
  }

  const validCategories = ['Precios/Financiamiento', 'Productos/Servicios', 'Soporte Técnico', 'Información General'];
  
  if (validCategories.includes(aiCategory)) {
    return aiCategory;
  }

  return 'Información General'; 
}

async function enrichFAQsWithResponses(groups, clientId) {
  const promises = groups.map(async (group) => {
    try {
      const variationTexts = group.variations.map(v => v.question);
      
      const userMessages = await Message.find({
        clientId,
        sender: 'user',
        content: { 
          $in: variationTexts.map(text => new RegExp(text, 'i'))
        }
      }).limit(10);

      let commonResponse = null;
      
      if (userMessages.length > 0) {
        const chatIds = [...new Set(userMessages.map(m => m.chatId))];
        
        const botResponses = await Message.find({
          chatId: { $in: chatIds },
          sender: 'bot',
          timestamp: { 
            $gte: userMessages[0].timestamp,
            $lte: new Date(userMessages[0].timestamp.getTime() + 5 * 60 * 1000) 
          }
        }).limit(5);

        if (botResponses.length > 0) {
          commonResponse = botResponses[0].content;
        }
      }

      return {
        ...group,
        commonResponse
      };

    } catch (error) {
      console.error('Error enriqueciendo FAQ:', error);
      return group;
    }
  });

  return Promise.all(promises);
}

async function saveFAQs(faqs, clientId) {
  const saved = [];
  const existingFAQs = await FAQ.find({ clientId, status: 'active' });

  for (const newFaq of faqs) {
    try {
      const newCanonicalNorm = normalizeText(newFaq.canonicalQuestion);

      let match = existingFAQs.find(existing => {
        const existingCanonicalNorm = normalizeText(existing.canonicalQuestion);
        
        if (existingCanonicalNorm.includes(newCanonicalNorm) || newCanonicalNorm.includes(existingCanonicalNorm)) {
          return true;
        }

         const variationsMatch = existing.variations.some(v => 
          normalizeText(v.question) === newCanonicalNorm
        );
        
        return variationsMatch;
      });

      if (match) {
        
        match.variations = mergeVariations(match.variations, newFaq.variations);
        match.totalCount = match.variations.reduce((sum, v) => sum + v.count, 0);
        match.lastSeen = new Date();
        
        if (!match.customResponse && newFaq.commonResponse) {
          match.commonResponse = newFaq.commonResponse;
        }
        
        await match.save();
        saved.push(match);
      } else {
        const newFAQDoc = new FAQ({
          clientId,
          canonicalQuestion: newFaq.canonicalQuestion,
          category: newFaq.category || 'General',
          variations: newFaq.variations,
          totalCount: newFaq.totalCount || newFaq.variations.reduce((sum, v) => sum + v.count, 0),
          commonResponse: newFaq.commonResponse,
          lastSeen: new Date()
        });
        
        await newFAQDoc.save();
        existingFAQs.push(newFAQDoc); 
        saved.push(newFAQDoc);
      }
    } catch (error) {
      console.error('Error guardando FAQ:', error);
    }
  }

  return saved;
}

async function callAI(prompt) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', 
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en análisis de conversaciones de servicio al cliente. Respondes ÚNICAMENTE con JSON válido, sin texto adicional.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error de OpenAI:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Error llamando a OpenAI:', error);
    throw error;
  }
}

function basicGrouping(messages) {
  const groups = {};
  
  messages.forEach(msg => {
    // Validar que el mensaje tenga contenido válido
    if (!msg.content || typeof msg.content !== 'string') {
      return; // Saltar este mensaje
    }
    
    const normalized = normalizeText(msg.content);
    if (!normalized || normalized.length === 0) {
      return; // Saltar si no hay contenido normalizado
    }
    
    const key = normalized.substring(0, 50);
    
    if (!groups[key]) {
      groups[key] = {
        canonicalQuestion: msg.content,
        category: 'General',
        variations: [],
        totalCount: 0
      };
    }
    
    groups[key].variations.push({
      question: msg.content,
      count: 1,
      lastSeen: msg.timestamp
    });
    groups[key].totalCount++;
  });
  
  return Object.values(groups);
}

function normalizeText(text) {
  // Validación defensiva
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') 
    .replace(/[^a-z0-9\s]/g, '') 
    .trim();
}

function mergeVariations(oldVariations, newVariations) {
  const merged = [...oldVariations];
  
  newVariations.forEach(newVar => {
    const existing = merged.find(v => 
      normalizeText(v.question) === normalizeText(newVar.question)
    );
    
    if (existing) {
      existing.count += newVar.count;
      existing.lastSeen = newVar.lastSeen;
    } else {
      merged.push(newVar);
    }
  });
  
  return merged;
}

module.exports = exports;