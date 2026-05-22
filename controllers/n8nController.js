const ChatState = require('../models/ChatState');
const Chat = require('../models/Chat');
const User = require('../models/User');
const UserTag = require('../models/UserTags');
const sseService = require('../services/sseService');

const ATTENTION_TAG_NAME = 'se requiere atencion';
const ATTENTION_TAG_COLOR = '#ff0000';

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

    const clientUser = await User.findOne({ clientId, role: 'client' });

    if (!clientUser) {
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

    const chat = await Chat.findOne(chatQuery);

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat no encontrado'
      });
    }

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
