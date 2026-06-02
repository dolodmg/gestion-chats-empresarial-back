const ChatState = require('../models/ChatState');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const UserTag = require('../models/UserTags');
const sseService = require('../services/sseService');

const ATTENTION_TAG_NAME = 'se requiere atencion';
const ATTENTION_TAG_COLOR = '#ff0000';
const NON_MEMBER_TEMPLATE_TAG_NAME = 'se envio plantilla no socios';
const NON_MEMBER_TEMPLATE_TAG_COLOR = '#2563eb';
const MEMBER_TEMPLATE_TAG_NAME = 'se envio plantilla socio';
const MEMBER_TEMPLATE_TAG_COLOR = '#16a34a';

async function findClientUser(clientId) {
  return User.findOne({ clientId, role: 'client' });
}

async function ensureUserTag(userId, tagName, color) {
  let userTags = await UserTag.findOne({ userId });

  if (!userTags) {
    userTags = await UserTag.create({
      userId,
      tags: []
    });
  }

  const normalizedTagName = String(tagName).trim().toLowerCase();
  let tag = userTags.tags.find((item) => item.name === normalizedTagName);
  let created = false;

  if (!tag) {
    userTags.tags.push({
      name: normalizedTagName,
      color
    });
    await userTags.save();
    tag = userTags.tags[userTags.tags.length - 1];
    created = true;
  }

  return { userTags, tag, created };
}

async function resolveChat({ clientId, chatId, phoneNumber, messageId }) {
  let resolvedMessage = null;

  if (messageId) {
    resolvedMessage = await Message.findOne({ _id: messageId, clientId }).lean();
    if (!resolvedMessage) {
      return { chat: null, resolvedMessage: null, error: 'Mensaje no encontrado para el clientId indicado' };
    }
  }

  const resolvedChatId = chatId || resolvedMessage?.chatId || null;
  const resolvedPhoneNumber = phoneNumber || resolvedMessage?.phoneNumber || null;

  if (!resolvedChatId && !resolvedPhoneNumber) {
    return { chat: null, resolvedMessage, error: 'Se requiere chatId, phoneNumber o messageId' };
  }

  const chatQuery = { clientId };
  if (resolvedChatId) {
    chatQuery.chatId = resolvedChatId;
  } else {
    chatQuery.phoneNumber = resolvedPhoneNumber;
  }

  let chat = await Chat.findOne(chatQuery);

  if (!chat) {
    const messageQuery = { clientId };
    if (resolvedChatId) {
      messageQuery.chatId = resolvedChatId;
    } else {
      messageQuery.phoneNumber = resolvedPhoneNumber;
    }

    const recentMessages = await Message.find(messageQuery)
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    if (recentMessages.length > 0) {
      const latestMessage = recentMessages[0];
      const reconstructedChatId = latestMessage.chatId || resolvedChatId || latestMessage.phoneNumber || resolvedPhoneNumber;
      const reconstructedPhoneNumber = latestMessage.phoneNumber || resolvedPhoneNumber || reconstructedChatId;

      chat = new Chat({
        chatId: reconstructedChatId,
        clientId,
        phoneNumber: reconstructedPhoneNumber,
        contactName: latestMessage.contactName || reconstructedPhoneNumber,
        lastMessage: latestMessage.content || '',
        lastMessageTimestamp: latestMessage.timestamp || new Date(),
        unreadCount: 0,
        chatStatus: 'bot',
        statusChangeTime: null,
        tags: [],
        lastOpenedAt: null
      });

      await chat.save();
    }
  }

  if (!chat && resolvedPhoneNumber) {
    const newChatId = resolvedChatId || resolvedPhoneNumber;

    chat = new Chat({
      chatId: newChatId,
      clientId,
      phoneNumber: resolvedPhoneNumber,
      contactName: resolvedPhoneNumber,
      lastMessage: '',
      lastMessageTimestamp: new Date(),
      unreadCount: 0,
      chatStatus: 'bot',
      statusChangeTime: null,
      tags: [],
      lastOpenedAt: null
    });

    await chat.save();
  }

  return { chat, resolvedMessage, error: null };
}

async function tagTemplateChat({ clientId, phoneNumber, tagName, tagColor }) {
  const clientUser = await findClientUser(clientId);

  if (!clientUser) {
    return {
      status: 404,
      payload: {
        success: false,
        error: 'Cliente no encontrado para el clientId indicado'
      }
    };
  }

  const normalizedPhoneNumber = String(phoneNumber).trim();
  const { chat, error } = await resolveChat({
    clientId,
    phoneNumber: normalizedPhoneNumber
  });

  if (error) {
    return {
      status: 400,
      payload: {
        success: false,
        error
      }
    };
  }

  if (!chat) {
    return {
      status: 404,
      payload: {
        success: false,
        error: 'Chat no encontrado'
      }
    };
  }

  const normalizedTagName = String(tagName).trim().toLowerCase();
  const { tag, created: tagCreated } = await ensureUserTag(
    clientUser._id,
    normalizedTagName,
    tagColor
  );

  const tagAlreadyAssigned = chat.tags.includes(normalizedTagName);
  if (!tagAlreadyAssigned) {
    chat.tags.push(normalizedTagName);
    await chat.save();
  }

  sseService.notifyChatUpdate({
    chatId: chat.chatId,
    clientId: chat.clientId,
    lastMessage: chat.lastMessage,
    lastMessageTimestamp: chat.lastMessageTimestamp,
    phoneNumber: chat.phoneNumber,
    contactName: chat.contactName,
    chatStatus: chat.chatStatus,
    statusChangeTime: chat.statusChangeTime,
    tags: chat.tags
  });

  return {
    status: 200,
    payload: {
      success: true,
      message: 'Chat resuelto y etiqueta registrada exitosamente',
      clientId,
      chatId: chat.chatId,
      phoneNumber: chat.phoneNumber,
      tag: {
        name: normalizedTagName,
        color: tag?.color || tagColor,
        created: tagCreated,
        alreadyAssigned: tagAlreadyAssigned
      },
      tags: chat.tags
    }
  };
}

/**
 * Controlador para verificar el estado del chat
 * MISMA LÓGICA que chatController.js para consistencia total
 */
exports.checkChatState = async (req, res) => {
  try {
    const { chatId, clientId } = req.query;
    
    // Validación de parámetros
    if (!chatId || !clientId) {
      console.log('Error: Faltan parámetros chatId o clientId');
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren chatId y clientId',
        chatStatus: 'bot'
      });
    }
    
    console.log(`[N8N] Verificando estado para chatId: ${chatId}, clientId: ${clientId}`);
    
    // EXACTAMENTE LA MISMA LÓGICA QUE chatController.js
    let chatState = null;
    try {
      if (ChatState) {
        chatState = await ChatState.findOne({ chatId, clientId });
      }
    } catch (err) {
      console.log('Error buscando ChatState, continuando con Chat:', err.message);
    }

    // Buscar datos del chat existente
    let chat = await Chat.findOne({ chatId, clientId });

    // Verificar estado del chat (MISMA LÓGICA)
    const stateFromChatState = chatState && chatState.chatStatus === 'human';
    const stateFromChat = chat && chat.chatStatus === 'human';
    
    // Determinar el estado final
    const isHuman = stateFromChatState || stateFromChat;
    const finalStatus = isHuman ? 'human' : 'bot';
    
    // Obtener el tiempo de cambio más reciente
    let statusChangeTime = null;
    if (isHuman) {
      // Usar el tiempo más reciente entre ambas colecciones
      const chatStateTime = chatState?.statusChangeTime;
      const chatTime = chat?.statusChangeTime;
      
      if (chatStateTime && chatTime) {
        statusChangeTime = chatStateTime > chatTime ? chatStateTime : chatTime;
      } else {
        statusChangeTime = chatStateTime || chatTime;
      }
    }
    
    // Verificar expiración de 30 minutos si está en modo humano
    if (finalStatus === 'human' && statusChangeTime) {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (statusChangeTime < thirtyMinutesAgo) {
        console.log(`[N8N] El tiempo de modo "human" ha expirado para ${chatId}, cambiando a "bot"`);
        
        // Actualizar en ambas colecciones
        const updatePromises = [];
        
        if (chat) {
          chat.chatStatus = 'bot';
          chat.statusChangeTime = null;
          updatePromises.push(chat.save());
        }
        
        if (chatState) {
          updatePromises.push(
            ChatState.updateOne(
              { chatId, clientId },
              { $set: { chatStatus: 'bot', statusChangeTime: null } }
            )
          );
        }
        
        await Promise.all(updatePromises);
        
        return res.json({ 
          success: true, 
          chatStatus: 'bot',
          statusChanged: true,
          reason: 'timeout',
          debug: {
            originalStatus: 'human',
            expiredAt: statusChangeTime,
            thirtyMinutesAgo: thirtyMinutesAgo
          }
        });
      }
    }
    
    console.log(`[N8N] Estado final para ${chatId}: ${finalStatus}`);
    console.log(`[N8N] Debug - ChatState: ${chatState?.chatStatus}, Chat: ${chat?.chatStatus}`);
    
    // Devolver el estado
    res.json({ 
      success: true, 
      chatStatus: finalStatus,
      statusChangeTime: statusChangeTime,
      debug: {
        stateFromChatState: stateFromChatState,
        stateFromChat: stateFromChat,
        chatStateExists: !!chatState,
        chatExists: !!chat
      }
    });
    
  } catch (error) {
    console.error('Error checking chat state:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error del servidor',
      chatStatus: 'bot'
    });
  }
};

/**
 * Controlador para cambiar el estado del chat (usado por el panel de control, no por n8n)
 */
exports.changeChatState = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { status, clientId } = req.body;
    
    console.log(`Solicitud de cambio de estado: chatId=${chatId}, status=${status}, clientId=${clientId}`);
    
    // Validación de parámetros
    if (!chatId || !status || !clientId) {
      console.log('Error: Faltan parámetros');
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren chatId, status y clientId' 
      });
    }
    
    if (!['bot', 'human'].includes(status)) {
      console.log('Error: Estado no válido:', status);
      return res.status(400).json({ 
        success: false, 
        error: 'Status debe ser "bot" o "human"' 
      });
    }
    
    console.log(`Cambiando estado para chatId: ${chatId} a ${status}`);
    
    const statusChangeTime = status === 'human' ? new Date() : null;
    
    // Actualizar en AMBAS colecciones para mantener sincronización
    const updatePromises = [];
    
    // Actualizar ChatState
    updatePromises.push(
      ChatState.findOneAndUpdate(
        { chatId, clientId },
        { 
          $set: { 
            chatStatus: status, 
            statusChangeTime,
            updatedAt: new Date()
          } 
        },
        { upsert: true, new: true }
      )
    );
    
    // Actualizar Chat
    updatePromises.push(
      Chat.findOneAndUpdate(
        { chatId, clientId },
        { 
          $set: { 
            chatStatus: status, 
            statusChangeTime
          } 
        },
        { upsert: true, new: true }
      )
    );
    
    const [chatState, chat] = await Promise.all(updatePromises);
    
    console.log(`Estado actualizado para ${chatId}: ${status} en ambas colecciones`);
    
    res.json({
      success: true,
      chatId,
      clientId,
      chatStatus: chatState.chatStatus,
      statusChangeTime: chatState.statusChangeTime
    });
    
  } catch (error) {
    console.error('Error changing chat state:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error del servidor' 
    });
  }
};

/**
 * Agrega la etiqueta "Se requiere atencion" a un chat usando la misma
 * autenticacion de integracion que los endpoints de n8n.
 */
exports.markChatForAttention = async (req, res) => {
  try {
    const {
      clientId,
      chatId,
      phoneNumber,
      tagName = ATTENTION_TAG_NAME
    } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId es requerido'
      });
    }

    if (!chatId && !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere chatId o phoneNumber'
      });
    }

    const normalizedTagName = String(tagName).trim().toLowerCase() || ATTENTION_TAG_NAME;

    console.log('[n8n/mark-chat-attention] request received', {
      clientId,
      chatId: chatId || null,
      phoneNumber: phoneNumber || null,
      tagName: normalizedTagName
    });

    const clientUser = await User.findOne({ clientId, role: 'client' });

    if (!clientUser) {
      console.warn('[n8n/mark-chat-attention] client not found', { clientId });
      return res.status(404).json({
        success: false,
        error: 'Cliente no encontrado para el clientId indicado'
      });
    }

    const chatQuery = { clientId };
    if (chatId) {
      chatQuery.chatId = chatId;
    } else {
      chatQuery.phoneNumber = phoneNumber;
    }

    console.log('[n8n/mark-chat-attention] chat lookup query', chatQuery);

    let chat = await Chat.findOne(chatQuery);

    if (!chat) {
      const messageQuery = { clientId };
      if (chatId) {
        messageQuery.chatId = chatId;
      } else {
        messageQuery.phoneNumber = phoneNumber;
      }

      const recentMessages = await Message.find(messageQuery)
        .sort({ timestamp: -1 })
        .limit(20)
        .lean();

      if (recentMessages.length > 0) {
        const latestMessage = recentMessages[0];
        const oldestMessage = recentMessages[recentMessages.length - 1];
        const reconstructedChatId = latestMessage.chatId || chatId || latestMessage.phoneNumber || phoneNumber;
        const reconstructedPhoneNumber = latestMessage.phoneNumber || phoneNumber || reconstructedChatId;

        chat = new Chat({
          chatId: reconstructedChatId,
          clientId,
          phoneNumber: reconstructedPhoneNumber,
          contactName: reconstructedPhoneNumber,
          lastMessage: latestMessage.content || '',
          lastMessageTimestamp: latestMessage.timestamp || new Date(),
          unreadCount: 0,
          chatStatus: 'bot',
          statusChangeTime: null,
          tags: [],
          lastOpenedAt: null
        });

        await chat.save();

        console.log('[n8n/mark-chat-attention] chat reconstructed from messages', {
          clientId,
          reconstructedChatId,
          reconstructedPhoneNumber,
          latestMessageTimestamp: latestMessage.timestamp || null,
          oldestMessageTimestamp: oldestMessage.timestamp || null,
          messageCountSample: recentMessages.length
        });
      }
    }

    if (!chat) {
      const recentChats = await Chat.find({ clientId })
        .sort({ lastMessageTimestamp: -1 })
        .limit(10)
        .select('chatId phoneNumber contactName lastMessageTimestamp')
        .lean();

      const samePhoneCandidates = phoneNumber
        ? await Chat.find({ clientId, phoneNumber: { $regex: String(phoneNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } })
            .limit(10)
            .select('chatId phoneNumber contactName lastMessageTimestamp')
            .lean()
        : [];

      const recentMessages = await Message.find({ clientId })
        .sort({ timestamp: -1 })
        .limit(10)
        .select('chatId phoneNumber content timestamp')
        .lean();

      console.warn('[n8n/mark-chat-attention] chat not found', {
        clientId,
        requestedChatId: chatId || null,
        requestedPhoneNumber: phoneNumber || null,
        lookupMode: chatId ? 'chatId' : 'phoneNumber',
        recentChats,
        samePhoneCandidates,
        recentMessages
      });

      return res.status(404).json({
        success: false,
        error: 'Chat no encontrado'
      });
    }

    console.log('[n8n/mark-chat-attention] chat found', {
      clientId,
      foundChatId: chat.chatId,
      foundPhoneNumber: chat.phoneNumber,
      contactName: chat.contactName || null
    });

    let userTags = await UserTag.findOne({ userId: clientUser._id });
    let tagCreated = false;

    if (!userTags) {
      userTags = await UserTag.create({
        userId: clientUser._id,
        tags: []
      });
    }

    const existingTag = userTags.tags.find(tag => tag.name === normalizedTagName);

    if (!existingTag) {
      userTags.tags.push({
        name: normalizedTagName,
        color: ATTENTION_TAG_COLOR
      });
      await userTags.save();
      tagCreated = true;
    }

    const tagAlreadyAssigned = chat.tags.includes(normalizedTagName);

    if (!tagAlreadyAssigned) {
      chat.tags.push(normalizedTagName);
      await chat.save();
    }

    console.log('[n8n/mark-chat-attention] tag processed', {
      clientId,
      chatId: chat.chatId,
      tagName: normalizedTagName,
      tagCreated,
      tagAlreadyAssigned,
      totalTags: chat.tags.length
    });

    sseService.notifyChatUpdate({
      chatId: chat.chatId,
      clientId: chat.clientId,
      tags: chat.tags
    });

    return res.json({
      success: true,
      message: tagAlreadyAssigned
        ? 'La etiqueta ya estaba asignada al chat'
        : 'Etiqueta asignada exitosamente',
      clientId,
      chatId: chat.chatId,
      phoneNumber: chat.phoneNumber,
      tag: {
        name: normalizedTagName,
        color: existingTag?.color || ATTENTION_TAG_COLOR,
        created: tagCreated,
        alreadyAssigned: tagAlreadyAssigned
      },
      tags: chat.tags
    });
  } catch (error) {
    console.error('Error marking chat for attention:', error);
    return res.status(500).json({
      success: false,
      error: 'Error del servidor'
    });
  }
};

/**
 * Registra un mensaje saliente del bot enviado por n8n y etiqueta el chat
 * para reflejar envíos masivos de plantilla fuera de la app.
 */
exports.registerTemplateSend = async (req, res) => {
  try {
    const { clientId, phoneNumber } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId es requerido'
      });
    }

    if (!phoneNumber || !String(phoneNumber).trim()) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber es requerido'
      });
    }

    const result = await tagTemplateChat({
      clientId,
      phoneNumber,
      tagName: NON_MEMBER_TEMPLATE_TAG_NAME,
      tagColor: NON_MEMBER_TEMPLATE_TAG_COLOR
    });

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error('Error registering template send from n8n:', error);
    return res.status(500).json({
      success: false,
      error: 'Error del servidor'
    });
  }
};

/**
 * Resuelve o crea un chat para n8n y le asigna la etiqueta de plantilla socio.
 */
exports.registerMemberTemplateSend = async (req, res) => {
  try {
    const { clientId, phoneNumber } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId es requerido'
      });
    }

    if (!phoneNumber || !String(phoneNumber).trim()) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber es requerido'
      });
    }

    const result = await tagTemplateChat({
      clientId,
      phoneNumber,
      tagName: MEMBER_TEMPLATE_TAG_NAME,
      tagColor: MEMBER_TEMPLATE_TAG_COLOR
    });

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error('Error registering member template send from n8n:', error);
    return res.status(500).json({
      success: false,
      error: 'Error del servidor'
    });
  }
};

