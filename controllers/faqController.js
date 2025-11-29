const Message = require('../models/Message');
const FAQ = require('../models/FAQ');
const Chat = require('../models/Chat');

exports.analyzeFAQs = async (req, res) => {
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

    console.log(`🔍 Analizando FAQs para cliente: ${effectiveClientId}`);

    const userMessages = await Message.find({
      clientId: effectiveClientId,
      sender: 'user',
      // Filtrar mensajes con contenido válido
      content: { $exists: true, $ne: '', $ne: null, $type: 'string' }
    })
    .select('content chatId timestamp')
    .sort({ timestamp: -1 })
    .limit(1000);

    // Filtro adicional en JavaScript por seguridad
    const validMessages = userMessages.filter(msg => msg.content && typeof msg.content === 'string' && msg.content.trim().length > 0);

    console.log(`📊 Encontrados ${validMessages.length} mensajes de usuarios`);
    
    if (validMessages.length > 0) {
      console.log('📝 Ejemplos de mensajes:');
      validMessages.slice(0, 5).forEach((msg, i) => {
        const preview = msg.content.substring(0, 80);
        console.log(`  ${i + 1}. "${preview}..."`);
      });
    }

    if (validMessages.length === 0) {
      return res.json({
        success: true,
        message: 'No se encontraron preguntas para analizar',
        faqs: [],
        stats: {
          messagesAnalyzed: 0,
          faqsGenerated: 0
        }
      });
    }

    const groupedQuestions = await groupQuestionsByAI(validMessages, effectiveClientId);
    const faqsWithResponses = await enrichFAQsWithResponses(groupedQuestions, effectiveClientId);
    const savedFAQs = await saveFAQs(faqsWithResponses, effectiveClientId);

    console.log(`✅ Análisis completado. ${savedFAQs.length} FAQs procesadas`);

    res.json({
      success: true,
      message: 'Análisis completado exitosamente',
      faqs: savedFAQs,
      stats: {
        messagesAnalyzed: validMessages.length,
        faqsGenerated: savedFAQs.length,
        analyzedPeriod: 'Últimos 1000 mensajes'
      }
    });

  } catch (error) {
    console.error('❌ Error analizando FAQs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al analizar preguntas frecuentes',
      details: error.message 
    });
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

async function groupQuestionsByAI(messages, clientId) {
  try {
    const questions = messages
      .map(m => m.content)
      .filter(content => content && typeof content === 'string')
      .map(content => content.trim())
      .filter(q => q.length > 5);
    const cleanQuestions = questions.filter(q => {
      const lower = q.toLowerCase();
      return !['hola', 'buen dia', 'gracias', 'chau'].includes(lower);
    });

    const sampleSize = Math.min(cleanQuestions.length, 200);
    const sampledQuestions = cleanQuestions.slice(0, sampleSize);
    const prompt = `Eres un experto clasificador de consultas para un chatbot.
Tu tarea es agrupar las siguientes ${sampledQuestions.length} preguntas de usuarios.

REGLAS DE CATEGORIZACIÓN (USAR SOLO ESTAS 5):
1. "Financiamiento": OBLIGATORIO si la pregunta menciona: cuotas, financiación, financiamiento, préstamo, banco, tarjeta, interés, plan de pago.
2. "Precios": Si pregunta cuánto cuesta, valor, precio, cotización.
3. "Soporte Técnico": Problemas, fallas, errores, no funciona, garantía, reparación.
4. "Productos/Servicios": Stocks, modelos, características, colores, disponibilidad (que no sea precio).
5. "Información General": Horarios, ubicación, teléfono, contacto, envíos.

IMPORTANTE:
- La categoría "Pedidos" NO EXISTE.
- La categoría "Ventas" NO EXISTE (usa Productos/Servicios o Precios).
- Prioriza "Financiamiento" sobre cualquier otra si aparecen palabras relacionadas al dinero/pagos diferidos.

INPUT:
${sampledQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

FORMATO JSON:
{
  "groups": [
    {
      "canonicalQuestion": "Pregunta clara y neutra",
      "category": "Una de las 5 categorías permitidas",
      "variations": ["texto original 1", "texto original 2"]
    }
  ]
}`;
    
    const grouped = await callAI(prompt);
    
    const groupsWithCounts = grouped.groups.map(group => {
    
      const finalCategory = assignStrictCategory(group.canonicalQuestion, group.category);

      const variations = group.variations.map(variation => {
        const count = questions.filter(q => 
          normalizeText(q).includes(normalizeText(variation)) ||
          normalizeText(variation).includes(normalizeText(q))
        ).length;
        
        return {
          question: variation,
          count: Math.max(count, 1),
          lastSeen: new Date()
        };
      });

      return {
        ...group,
        category: finalCategory, 
        variations,
        totalCount: variations.reduce((sum, v) => sum + v.count, 0)
      };
    });

    return groupsWithCounts;

  } catch (error) {
    console.error('Error agrupando con IA:', error);
    return basicGrouping(messages);
  }
}

function assignStrictCategory(text, aiCategory) {
  const t = normalizeText(text);
  if (t.includes('financ') || t.includes('prestamo') || t.includes('cuota') || t.includes('banco') || t.includes('credito') || t.includes('interes')) {
    return 'Financiamiento';
  }
  if (t.includes('precio') || t.includes('valor') || t.includes('cuesta') || t.includes('sale')) {
    return 'Precios';
  }
  if (t.includes('funciona') || t.includes('roto') || t.includes('falla') || t.includes('problema') || t.includes('tecnico') || t.includes('garantia')) {
    return 'Soporte Técnico';
  }

  if (aiCategory === 'Ventas' || aiCategory === 'Pedidos') {
    return 'Productos/Servicios';
  }

  const validCategories = ['Financiamiento', 'Precios', 'Soporte Técnico', 'Productos/Servicios', 'Información General'];
  
  if (validCategories.includes(aiCategory)) {
    return aiCategory;
  }

  return 'Información General'; 
}

async function enrichFAQsWithResponses(groups, clientId) {
  const enriched = [];

  for (const group of groups) {
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

      enriched.push({
        ...group,
        commonResponse
      });

    } catch (error) {
      console.error('Error enriqueciendo FAQ:', error);
      enriched.push(group);
    }
  }

  return enriched;
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