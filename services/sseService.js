// services/sseService.js

class SSEService {
  constructor() {
    this.clients = new Map(); // userId -> Set of response objects
    console.log('📡 SSE Service inicializado');
  }

  /**
   * Registrar un nuevo cliente SSE
   */
  addClient(userId, clientId, role, res) {
    // Configurar headers SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Para nginx
    });

    // Crear clave única para el cliente
    const key = `${userId}_${Date.now()}`;
    
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Map());
    }
    
    this.clients.get(userId).set(key, {
      res,
      clientId,
      role,
      connectedAt: new Date()
    });

    console.log(`✅ Cliente SSE conectado: ${userId} (${role}) - Total: ${this.getTotalConnections()}`);

    // Enviar mensaje inicial
    this.sendToClient(res, 'connected', { 
      message: 'Conectado al servidor de notificaciones',
      timestamp: new Date().toISOString()
    });

    // Cleanup cuando se desconecta
    res.on('close', () => {
      const userClients = this.clients.get(userId);
      if (userClients) {
        userClients.delete(key);
        if (userClients.size === 0) {
          this.clients.delete(userId);
        }
      }
      console.log(`❌ Cliente SSE desconectado: ${userId} - Total: ${this.getTotalConnections()}`);
    });

    return key;
  }

  /**
   * Enviar evento a un cliente específico
   */
  sendToClient(res, event, data) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('Error enviando a cliente SSE:', error.message);
    }
  }

  /**
   * Notificar nuevo mensaje a los clientes relevantes
   * ✅ CORREGIDO: Ahora incluye 'id' y 'phoneNumber' en el evento SSE
   */
  notifyNewMessage(message) {
    // ✅ CAMBIO: Extraer también 'id' y 'phoneNumber'
    const { chatId, clientId, sender, content, timestamp, id, phoneNumber } = message;

    // Log del mensaje entrante
    console.log(`📨 Notificando nuevo mensaje para clientId (del mensaje): ${clientId}`);

    this.clients.forEach((userConnections, userId) => {
      userConnections.forEach((client, key) => {
        
        // Log de CADA cliente conectado
        console.log(`  -> Verificando cliente conectado: [${client.role}] con clientId (del token): ${client.clientId}`);

        if (client.role === 'admin' || client.clientId === clientId) {
          // Log de ÉXITO
          console.log(`    ✅ Coincidencia! Enviando a ${userId} (${client.role})`);
          
          // ✅ CAMBIO: Enviar 'id' y 'phoneNumber' en el evento
          this.sendToClient(client.res, 'new_message', {
            id,            // ✅ ID del mensaje para evitar duplicados
            chatId,
            clientId,
            sender,
            content,
            timestamp,
            phoneNumber,   // ✅ Número de teléfono
            type: 'message'
          });
        } else {
          // Log de FALLO
          console.log(`    ❌ Sin coincidencias. (Mensaje: ${clientId} !== Token: ${client.clientId})`);
        }
      });
    });
  }

  /**
   * ❗️❗️--- FUNCIÓN CORREGIDA ---❗️❗️
   * Notificar cambio de estado de chat
   * (Esta era la función que habías borrado)
   */
  notifyChatStatusChange(chatId, clientId, chatStatus, statusChangeTime) {
    console.log(`🔄 Notificando cambio de estado: ${chatId} -> ${chatStatus}`);

    this.clients.forEach((userConnections, userId) => {
      userConnections.forEach((client) => {
        // Notificar a admins y al cliente específico
        if (client.role === 'admin' || client.clientId === clientId) {
          this.sendToClient(client.res, 'chat_status_changed', {
            chatId,
            clientId,
            chatStatus,
            statusChangeTime,
            type: 'status_change'
          });
        }
      });
    });
  }


  /**
   * Notificar actualización de chat (último mensaje, etc)
   */
  notifyChatUpdate(chat) {
    console.log(`🔔 Notificando actualización de chat: ${chat.chatId}`);

    this.clients.forEach((userConnections, userId) => {
      userConnections.forEach((client) => {
        if (client.role === 'admin' || client.clientId === chat.clientId) {
          this.sendToClient(client.res, 'chat_updated', {
            ...chat,
            type: 'update'
          });
        }
      });
    });
  }

  /**
   * Obtener estadísticas de conexiones
   */
  getTotalConnections() {
    let total = 0;
    this.clients.forEach(userConnections => {
      total += userConnections.size;
    });
    return total;
  }

  /**
   * Obtener info de clientes conectados
   */
  getClientsInfo() {
    const info = [];
    this.clients.forEach((userConnections, userId) => {
      userConnections.forEach((client, key) => {
        info.push({
          userId,
          key,
          role: client.role,
          clientId: client.clientId,
          connectedAt: client.connectedAt
        });
      });
    });
    return info;
  }

  /**
   * Heartbeat para mantener conexiones vivas
   */
  startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((userConnections) => {
        userConnections.forEach((client) => {
          this.sendToClient(client.res, 'heartbeat', { 
            timestamp: new Date().toISOString() 
          });
        });
      });
    }, 30000); // Cada 30 segundos
  }
}

// Singleton
const sseService = new SSEService();
sseService.startHeartbeat();

module.exports = sseService;