const Chat = require('../models/Chat');
const Message = require('../models/Message');
const WhatsAppService = require('../services/whatsappService');
const ChatState = require('../models/ChatState');
const sseService = require('../services/sseService');

// Obtener todos los chats de un cliente
// ⚡ OPTIMIZADO - Obtener todos los chats de un cliente con paginación
exports.getChats = async (req, res) => {
  try {
    const clientId = req.user.role === 'admin'
      ? req.query.clientId
      : req.user.clientId;

    if (!clientId) {
      return res.status(400).json({ msg: 'Se requiere clientId' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    console.log('Buscando chats para clientId:', clientId, `(limit: ${limit}, skip: ${skip})`);

    // Primera parte: agregación de mensajes (igual que antes)
    const chats = await Message.aggregate([
      { 
        $match: {
          clientId: clientId,
          chatId: { $ne: null },
          content: { $ne: null }
        }
      },
      { $sort: { chatId: 1, contactName: -1, timestamp: -1 } },
      { 
        $group: {
          _id: "$chatId",
          lastMessage: { $first: "$content" },
          lastMessageTimestamp: { $first: "$timestamp" },
          phoneNumber: { $first: "$phoneNumber" },
          contactName: { 
            $first: { 
              $cond: [
                {
                  $and: [
                    { $ne: ["$contactName", null] },
                    { $ne: ["$contactName", ""] },
                    { $ne: ["$contactName", "Usuario Prueba"] }
                  ]
                },
                "$contactName",
                null
              ]
            }
          },
          clientId: { $first: "$clientId" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$sender", "user"] },
                    { $eq: ["$status", "received"] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      { 
        $project: {
          _id: 0,
          chatId: "$_id",
          lastMessage: 1,
          lastMessageTimestamp: 1,
          phoneNumber: 1,
          contactName: { $ifNull: ["$contactName", "$_id"] },
          clientId: 1,
          unreadCount: 1
        }
      },
      { $sort: { lastMessageTimestamp: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    // Obtener el estado Y TAGS de cada chat desde la colección Chat
    const chatIds = chats.map(chat => chat.chatId);
    const chatStatuses = await Chat.find({ 
      chatId: { $in: chatIds }, 
      clientId 
    }).select('chatId chatStatus statusChangeTime tags').lean(); 

    // Crear un mapa de estados de chat para búsqueda rápida
    const statusMap = {};
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const chatsToUpdate = [];

    chatStatuses.forEach(chat => {
      if (chat.chatStatus === 'human' && chat.statusChangeTime && chat.statusChangeTime < thirtyMinutesAgo) {
        statusMap[chat.chatId] = { 
          chatStatus: 'bot', 
          statusChangeTime: null,
          tags: chat.tags || []
        };
        chatsToUpdate.push(chat.chatId);
      } else {
        statusMap[chat.chatId] = {
          chatStatus: chat.chatStatus,
          statusChangeTime: chat.statusChangeTime,
          tags: chat.tags || [] 
        };
      }
    });

    if (chatsToUpdate.length > 0) {
      await Chat.updateMany(
        { chatId: { $in: chatsToUpdate }, clientId },
        { $set: { chatStatus: 'bot', statusChangeTime: null } }
      );
      console.log(`${chatsToUpdate.length} chats actualizados a modo bot por timeout`);
    }

    // Añadir la información de estado Y TAGS a cada chat
    const enrichedChats = chats.map(chat => ({
      ...chat,
      chatStatus: statusMap[chat.chatId]?.chatStatus || 'bot',
      statusChangeTime: statusMap[chat.chatId]?.statusChangeTime || null,
      tags: statusMap[chat.chatId]?.tags || [] 
    }));

    console.log('Chats encontrados:', enrichedChats.length);
    
    res.json(enrichedChats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Obtener un chat específico con sus mensajes
exports.getChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const clientId = req.user.role === 'admin'
      ? req.query.clientId
      : req.user.clientId;

    if (!clientId) {
      return res.status(400).json({ msg: 'Se requiere clientId' });
    }

    console.log(`Buscando mensajes para chatId: ${chatId}, clientId: ${clientId}`);

    // Obtener mensajes del chat, filtrando mensajes con campos completos
    const messages = await Message.find({
      chatId,
      clientId,
      content: { $ne: null }
    }).sort({ timestamp: 1 });

    console.log(`Mensajes encontrados: ${messages.length}`);

    if (messages.length === 0) {
      return res.status(404).json({ msg: 'Chat no encontrado' });
    }

    // Buscar explícitamente un mensaje que tenga contactName
    let contactName = null;
    for (const msg of messages) {
      if (msg.contactName && msg.contactName !== 'Usuario Prueba') {
        contactName = msg.contactName;
        break;
      }
    }

    // Si no encuentra ninguno, usar el número como nombre
    if (!contactName) {
      contactName = chatId.replace(/^\d+/, ''); // Elimina los números iniciales si hay algún formato
      if (!contactName || contactName === '') {
        contactName = chatId;
      }
    }

    // Buscar o crear el documento Chat para obtener/establecer el estado
    let chat = await Chat.findOne({ chatId, clientId });

    if (!chat) {
      // Si no existe el chat, crearlo
      chat = new Chat({
        chatId,
        clientId,
        phoneNumber: messages[0].phoneNumber || chatId,
        contactName: contactName,
        lastMessage: messages[messages.length - 1].content,
        lastMessageTimestamp: messages[messages.length - 1].timestamp,
        chatStatus: 'bot' // Por defecto, el chat es manejado por el bot
      });
      await chat.save();
    }

    // Verificar si el temporizador de 30 minutos ha expirado
    if (chat.chatStatus === 'human' && chat.statusChangeTime) {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (chat.statusChangeTime < thirtyMinutesAgo) {
        // Actualizar el estado a 'bot' si pasaron más de 30 minutos
        chat.chatStatus = 'bot';
        chat.statusChangeTime = null;
        await chat.save();
      }
    }

    const chatInfo = {
      chatId,
      clientId,
      lastMessage: messages[messages.length - 1].content,
      lastMessageTimestamp: messages[messages.length - 1].timestamp,
      phoneNumber: messages[0].phoneNumber || chatId,
      contactName: contactName,
      unreadCount: 0,
      chatStatus: chat.chatStatus,
      statusChangeTime: chat.statusChangeTime
    };

    // Marcar mensajes como leídos
    await Message.updateMany(
      { chatId, clientId, sender: 'user', status: 'received' },
      { $set: { status: 'read' } }
    );

    console.log('Enviando respuesta con chat y mensajes');

    res.json({
      chat: chatInfo,
      messages
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Cambiar el estado del chat (bot/human)
exports.changeChatStatus = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { status } = req.body;
    const clientId = req.user.role === 'admin'
      ? req.query.clientId || req.body.clientId  // Aceptar clientId de query o body
      : req.user.clientId;

    console.log(`Recibida solicitud para cambiar estado: chatId=${chatId}, status=${status}, clientId=${clientId}`);

    if (!clientId) {
      return res.status(400).json({ msg: 'Se requiere clientId' });
    }

    if (!status || !['bot', 'human'].includes(status)) {
      return res.status(400).json({ msg: 'Estado no válido. Debe ser "bot" o "human"' });
    }

    // Buscar el chat
    let chat = await Chat.findOne({ chatId, clientId });

    // Si no se encuentra el chat, intentar también en ChatState
    let chatState = null;
    if (!chat) {
      try {
        if (typeof ChatState !== 'undefined' && ChatState) {
          chatState = await ChatState.findOne({ chatId, clientId });
          
          if (chatState) {
            console.log(`Chat no encontrado en colección Chat, pero encontrado en ChatState: ${chatId}`);
            // Crear el chat basado en el estado encontrado
            chat = new Chat({
              chatId,
              clientId,
              chatStatus: chatState.chatStatus,
              statusChangeTime: chatState.statusChangeTime,
              phoneNumber: chatId,
              contactName: chatId
            });
          }
        }
      } catch (err) {
        console.log('Error al buscar en ChatState:', err.message);
      }
    }

    // Si aún no se encuentra el chat, crear uno nuevo
    if (!chat) {
      console.log(`Chat no encontrado, creando nuevo: ${chatId}`);
      chat = new Chat({
        chatId,
        clientId,
        phoneNumber: chatId,
        contactName: chatId,
        lastMessage: '',
        lastMessageTimestamp: new Date()
      });
    }

    // Actualizar el estado en Chat
    console.log(`Cambiando estado para ${chatId} de ${chat.chatStatus || 'undefined'} a ${status}`);
    chat.chatStatus = status;
    chat.statusChangeTime = status === 'human' ? new Date() : null;
    await chat.save();

    // Actualizar también el estado en ChatState
    try {
      if (typeof ChatState !== 'undefined' && ChatState) {
        // Buscar o crear el registro en ChatState
        chatState = await ChatState.findOneAndUpdate(
          { chatId, clientId },
          { 
            chatStatus: status,
            statusChangeTime: status === 'human' ? new Date() : null
          },
          { upsert: true, new: true }
        );
        console.log(`Estado actualizado también en ChatState: ${chatState.chatStatus}`);
      }
    } catch (err) {
      console.log('Error al actualizar ChatState:', err.message);
      // No fallamos la operación si hay error al guardar en ChatState
    }

    console.log(`Estado actualizado para ${chatId}: ${status}`);

    // 🆕 NUEVO: Notificar a clientes SSE conectados
    sseService.notifyChatStatusChange(
      chatId,
      clientId,
      status,
      chat.statusChangeTime
    );
    
    res.json({
      chatId,
      chatStatus: chat.chatStatus,
      statusChangeTime: chat.statusChangeTime
    });
  } catch (error) {
    console.error('Error changing chat status:', error);
    res.status(500).json({ msg: 'Error del servidor', error: error.message });
  }
}

// Enviar mensaje manual
// Actualizar la función sendManualMessage en chatController.js

// Enviar mensaje manual
exports.sendManualMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const clientId = req.user.role === 'admin'
      ? req.query.clientId
      : req.user.clientId;

    console.log(`Intento de envío de mensaje manual: chatId=${chatId}, clientId=${clientId}`);

    if (!clientId) {
      return res.status(400).json({ msg: 'Se requiere clientId' });
    }

    if (!content) {
      return res.status(400).json({ msg: 'El contenido del mensaje es requerido' });
    }

    // Verificar si el chat está en modo humano usando ChatState (si existe) o Chat
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
    
    // Verificar estado del chat
    const stateFromChatState = chatState && chatState.chatStatus === 'human';
    const stateFromChat = chat && chat.chatStatus === 'human';
    
    // Si no está en modo humano en ninguno de los dos lugares, error
    if (!stateFromChatState && !stateFromChat) {
      console.log(`Error: Chat ${chatId} no está en modo humano. Estado:`, 
        chatState ? chatState.chatStatus : 'no existe ChatState', 
        chat ? chat.chatStatus : 'no existe Chat');
      return res.status(403).json({ msg: 'No se puede enviar mensaje manual cuando el chat está en modo bot' });
    }

    const phoneNumber = chat ? chat.phoneNumber : chatId;

    console.log(`Enviando mensaje a ${phoneNumber} desde cliente ${clientId}: ${content}`);

    // Crear el nuevo mensaje en la base de datos
    const newMessage = new Message({
      chatId,
      clientId,
      sender: 'bot', // Aunque es manual, para el usuario final viene del "bot"
      content,
      timestamp: new Date(),
      status: 'sent',
      phoneNumber
    });

    await newMessage.save();
    console.log('Mensaje guardado en la base de datos:', newMessage._id);

    // 🆕 NUEVO: Notificar a clientes SSE conectados INMEDIATAMENTE después de guardar
    sseService.notifyNewMessage({
      chatId: newMessage.chatId,
      clientId: newMessage.clientId,
      sender: newMessage.sender,
      content: newMessage.content,
      timestamp: newMessage.timestamp,
      id: newMessage._id,
      phoneNumber: newMessage.phoneNumber
    });

    // Enviar el mensaje usando WhatsAppService con clientId como primer parámetro
    try {
      if (WhatsAppService && typeof WhatsAppService.sendTextMessage === 'function') {
        // CORRECCIÓN: Pasar parámetros en el orden correcto (clientId, phoneNumber, content)
        await WhatsAppService.sendTextMessage(clientId, phoneNumber, content);
        console.log('Mensaje enviado a WhatsApp exitosamente');
      }
    } catch (whatsappError) {
      console.error('Error enviando a WhatsApp:', whatsappError);
      console.error('Detalles del error:', {
        clientId,
        phoneNumber,
        content: content.substring(0, 50) + '...',
        error: whatsappError.message
      });
      
      // Actualizar el estado del mensaje como failed pero no fallar la respuesta
      await Message.findByIdAndUpdate(newMessage._id, { 
        status: 'failed',
        errorMessage: whatsappError.message 
      });
    }

    // Actualizar información del chat si existe
    if (chat) {
      chat.lastMessage = content;
      chat.lastMessageTimestamp = new Date();
      await chat.save();
      console.log('Información del chat actualizada');

      // 🆕 NUEVO: Notificar actualización del chat
      sseService.notifyChatUpdate({
        chatId: chat.chatId,
        clientId: chat.clientId,
        lastMessage: chat.lastMessage,
        lastMessageTimestamp: chat.lastMessageTimestamp,
        phoneNumber: chat.phoneNumber,
        contactName: chat.contactName,
        chatStatus: chat.chatStatus,
        statusChangeTime: chat.statusChangeTime
      });
    }

    

    // Actualizar el tiempo de control manual en ChatState o Chat
    if (chatState) {
      chatState.statusChangeTime = new Date(); // Renovar el tiempo de 30 minutos
      await chatState.save();
      console.log('Tiempo de control renovado en ChatState');
    }
    
    if (chat && chat.chatStatus === 'human') {
      chat.statusChangeTime = new Date(); // Renovar el tiempo también en Chat
      await chat.save();
      console.log('Tiempo de control renovado en Chat');
    }

    res.json({
      success: true,
      message: {
        id: newMessage._id,
        content: newMessage.content,
        timestamp: newMessage.timestamp,
        status: newMessage.status,
        sender: newMessage.sender
      }
    });
  } catch (error) {
    console.error('Error sending manual message:', error);
    res.status(500).json({ msg: 'Error del servidor', error: error.message });
  }
}

// Verificar el estado del chat (para n8n)
exports.checkChatStatus = async (req, res) => {
  try {
    const { chatId, clientId } = req.query;

    if (!chatId || !clientId) {
      return res.status(400).json({ msg: 'Se requieren chatId y clientId' });
    }

    // Buscar el chat
    let chat = await Chat.findOne({ chatId, clientId });

    // Si no existe, crear con estado por defecto 'bot'
    if (!chat) {
      chat = new Chat({
        chatId,
        clientId,
        phoneNumber: chatId,
        chatStatus: 'bot'
      });
      await chat.save();
    }

    // Verificar si el tiempo de 30 minutos ha expirado
    if (chat.chatStatus === 'human' && chat.statusChangeTime) {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (chat.statusChangeTime < thirtyMinutesAgo) {
        chat.chatStatus = 'bot';
        chat.statusChangeTime = null;
        await chat.save();
      }
    }

    // Devolver el estado
    res.json({
      chatId,
      clientId,
      chatStatus: chat.chatStatus,
      statusChangeTime: chat.statusChangeTime
    });
  } catch (error) {
    console.error('Error checking chat status:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Buscar chat por número de teléfono
exports.findChatByPhone = async (req, res) => {
  try {
    const { phoneNumber } = req.query;
    const clientId = req.user.role === 'admin'
      ? req.query.clientId
      : req.user.clientId;

    if (!clientId) {
      return res.status(400).json({ msg: 'Se requiere clientId' });
    }

    if (!phoneNumber) {
      return res.status(400).json({ msg: 'Se requiere phoneNumber' });
    }

    console.log(`Buscando chat por teléfono: ${phoneNumber}, clientId: ${clientId}`);

    // Normalizar el número de teléfono (eliminar espacios, guiones, paréntesis, etc.)
    const normalizePhone = (phone) => {
      return phone.replace(/[\s\-\(\)\+]/g, '');
    };

    const normalizedInput = normalizePhone(phoneNumber);

    // Buscar en la colección de mensajes
    const chats = await Message.aggregate([
      { 
        $match: {
          clientId: clientId,
          chatId: { $ne: null },
          content: { $ne: null }
        }
      },
      { $sort: { chatId: 1, contactName: -1, timestamp: -1 } },
      { 
        $group: {
          _id: "$chatId",
          lastMessage: { $first: "$content" },
          lastMessageTimestamp: { $first: "$timestamp" },
          phoneNumber: { $first: "$phoneNumber" },
          contactName: { 
            $first: { 
              $cond: [
                {
                  $and: [
                    { $ne: ["$contactName", null] },
                    { $ne: ["$contactName", ""] },
                    { $ne: ["$contactName", "Usuario Prueba"] }
                  ]
                },
                "$contactName",
                null
              ]
            }
          },
          clientId: { $first: "$clientId" }
        }
      },
      { 
        $project: {
          _id: 0,
          chatId: "$_id",
          lastMessage: 1,
          lastMessageTimestamp: 1,
          phoneNumber: 1,
          contactName: { $ifNull: ["$contactName", "$_id"] },
          clientId: 1
        }
      }
    ]);

    // Buscar el chat que coincida con el número normalizado
    const matchingChat = chats.find(chat => {
      const normalizedChatPhone = normalizePhone(chat.phoneNumber);
      return normalizedChatPhone === normalizedInput ||
             normalizedChatPhone.includes(normalizedInput) ||
             normalizedInput.includes(normalizedChatPhone);
    });

    if (!matchingChat) {
      return res.status(404).json({ msg: 'Chat no encontrado' });
    }

    // Obtener el estado y tags del chat
    const chatDoc = await Chat.findOne({ 
      chatId: matchingChat.chatId, 
      clientId 
    }).select('chatId chatStatus statusChangeTime tags').lean();

    // Verificar timeout de 30 minutos
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    let chatStatus = 'bot';
    let statusChangeTime = null;
    let tags = [];

    if (chatDoc) {
      if (chatDoc.chatStatus === 'human' && chatDoc.statusChangeTime && chatDoc.statusChangeTime < thirtyMinutesAgo) {
        chatStatus = 'bot';
        statusChangeTime = null;
        // Actualizar en la base de datos
        await Chat.updateOne(
          { chatId: matchingChat.chatId, clientId },
          { $set: { chatStatus: 'bot', statusChangeTime: null } }
        );
      } else {
        chatStatus = chatDoc.chatStatus;
        statusChangeTime = chatDoc.statusChangeTime;
      }
      tags = chatDoc.tags || [];
    }

    const enrichedChat = {
      ...matchingChat,
      chatStatus,
      statusChangeTime,
      tags,
      unreadCount: 0
    };

    console.log('Chat encontrado por teléfono:', enrichedChat.chatId);
    res.json(enrichedChat);
  } catch (error) {
    console.error('Error finding chat by phone:', error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

