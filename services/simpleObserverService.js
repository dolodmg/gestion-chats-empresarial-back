const EmailService = require('./emailService');

/**
 * Observer Simple para monitoreo de salud del sistema WhatsApp/n8n
 * Es notificado por n8n via HTTP POST cuando llegan mensajes
 * Si n8n falla → No llegan notificaciones → Se dispara alerta
 */
class SimpleObserverService {
  
  constructor() {
    this.TARGET_CLIENT_ID = '577642088768581';
    this.emailService = new EmailService();
    
    // Configuración de tiempo
    this.THRESHOLD_TIME = 30 * 60 * 1000; // 30 minutos
    this.NOTIFICATION_COOLDOWN = 60 * 60 * 1000; // 1 hora
    
    // Estado del timer y notificaciones
    this.inactivityTimer = null;
    this.lastMessageData = null;
    this.lastNotificationSent = null;
    
    // Estado del servicio
    this.isActive = false;
    
    console.log('🔧 Simple Observer inicializado');
    console.log(`🎯 Cliente monitoreado: ${this.TARGET_CLIENT_ID}`);
    console.log(`⏰ Umbral de inactividad: ${this.THRESHOLD_TIME / (60 * 1000)} minutos`);
    console.log('📡 Esperando notificaciones de n8n...');
  }

  /**
   * Inicializar el servicio Observer
   */
  async initialize() {
    try {
      console.log('🔧 Inicializando Simple Observer...');
      
      // Verificar configuración de email
      const emailConfigValid = await this.emailService.verifyEmailConfig();
      if (!emailConfigValid) {
        throw new Error('Configuración de email inválida');
      }
      
      this.isActive = true;
      console.log('✅ Simple Observer inicializado correctamente');
      console.log('📞 Esperando llamadas de n8n en /api/message-notification');
      
      return true;
    } catch (error) {
      console.error('❌ Error inicializando Simple Observer:', error);
      return false;
    }
  }

  /**
   * Método llamado cuando n8n notifica un mensaje nuevo
   * Este es el único punto de entrada para el Observer
   */
  onNewMessage(messageData) {
    try {
      // Verificar que es del cliente objetivo
      if (messageData.clientId !== this.TARGET_CLIENT_ID) {
        console.log(`⚠️ Mensaje ignorado - cliente diferente: ${messageData.clientId}`);
        return;
      }

      console.log(`📨 Mensaje notificado por n8n: ${messageData.chatId || 'N/A'} | ${messageData.sender || 'N/A'}`);
      
      // Cancelar timer anterior si existe
      if (this.inactivityTimer) {
        clearTimeout(this.inactivityTimer);
        console.log('⏹️ Timer anterior cancelado');
      }
      
      // Resetear estado de notificación (sistema vuelve a estar activo)
      if (this.lastNotificationSent) {
        console.log('🔄 Sistema activo nuevamente - reseteando estado de alertas');
        this.lastNotificationSent = null;
      }
      
      // Guardar datos del mensaje
      this.lastMessageData = {
        ...messageData,
        receivedAt: new Date()
      };
      
      // Iniciar nuevo timer de 30 minutos
      this.startInactivityTimer();
      
    } catch (error) {
      console.error('❌ Error procesando mensaje nuevo:', error);
    }
  }

  /**
   * Iniciar timer de inactividad de 30 minutos
   */
  startInactivityTimer() {
    console.log(`⏰ Iniciando timer de inactividad: ${this.THRESHOLD_TIME / (60 * 1000)} minutos`);
    
    this.inactivityTimer = setTimeout(async () => {
      console.log('🚨 Timer de inactividad expirado - sistema posiblemente caído');
      await this.handleInactivityDetected();
    }, this.THRESHOLD_TIME);
    
    const alertTime = new Date(Date.now() + this.THRESHOLD_TIME);
    console.log(`📅 Alerta programada para: ${alertTime.toLocaleString()}`);
  }

  /**
   * Manejar detección de inactividad (sistema caído)
   */
  async handleInactivityDetected() {
    try {
      console.log('🚨 INACTIVIDAD DETECTADA - Sistema WhatsApp/n8n posiblemente caído');
      
      // Verificar cooldown para evitar spam
      if (this.isInCooldown()) {
        const remainingCooldown = this.getRemainingCooldown();
        console.log(`⏳ Alerta en cooldown. Próxima disponible en ${Math.round(remainingCooldown / (60 * 1000))} minutos`);
        
        // Programar siguiente verificación después del cooldown
        this.scheduleNextCheck();
        return;
      }

      // Verificar que tenemos datos del último mensaje
      if (!this.lastMessageData) {
        console.log('⚠️ No hay datos del último mensaje - enviando alerta genérica');
        this.lastMessageData = {
          clientId: this.TARGET_CLIENT_ID,
          content: 'Sin datos del último mensaje',
          timestamp: new Date(),
          chatId: 'Desconocido',
          sender: 'Desconocido'
        };
      }

      // Calcular tiempo de inactividad (30 minutos exactos)
      const timeDifference = this.THRESHOLD_TIME;

      console.log(`📊 Último mensaje notificado: ${this.lastMessageData.receivedAt ? this.lastMessageData.receivedAt.toLocaleString() : 'Desconocido'}`);
      console.log(`📊 Tiempo de inactividad: ${Math.round(timeDifference / (60 * 1000))} minutos`);

      // Enviar alerta
      const emailResult = await this.emailService.sendInactivityAlert(this.lastMessageData, timeDifference);
      
      if (emailResult.success) {
        this.lastNotificationSent = new Date();
        console.log('✅ Alerta de sistema caído enviada correctamente');
        console.log(`📧 Próxima alerta disponible: ${new Date(Date.now() + this.NOTIFICATION_COOLDOWN).toLocaleString()}`);
        
        // Programar siguiente verificación después del cooldown
        this.scheduleNextCheck();
      } else {
        console.error('❌ Error enviando alerta:', emailResult.error);
        
        // Reintentar en 5 minutos si falló el envío
        setTimeout(() => {
          console.log('🔄 Reintentando envío de alerta...');
          this.handleInactivityDetected();
        }, 5 * 60 * 1000);
      }
      
    } catch (error) {
      console.error('❌ Error manejando inactividad detectada:', error);
    }
  }

  /**
   * Programar siguiente verificación después del cooldown
   */
  scheduleNextCheck() {
    const cooldownRemaining = this.getRemainingCooldown();
    const nextCheckTime = Math.max(cooldownRemaining + (5 * 60 * 1000), this.THRESHOLD_TIME);
    
    console.log(`⏰ Programando siguiente verificación en ${Math.round(nextCheckTime / (60 * 1000))} minutos`);
    
    this.inactivityTimer = setTimeout(async () => {
      console.log('🔄 Verificación programada después de cooldown');
      await this.handleInactivityDetected();
    }, nextCheckTime);
  }

  /**
   * Verificar si estamos en período de cooldown
   */
  isInCooldown() {
    if (!this.lastNotificationSent) {
      return false;
    }
    
    const now = new Date();
    const timeSinceLastNotification = now - this.lastNotificationSent;
    return timeSinceLastNotification < this.NOTIFICATION_COOLDOWN;
  }

  /**
   * Obtener tiempo restante de cooldown
   */
  getRemainingCooldown() {
    if (!this.lastNotificationSent) {
      return 0;
    }
    
    const now = new Date();
    const timeSinceLastNotification = now - this.lastNotificationSent;
    return Math.max(0, this.NOTIFICATION_COOLDOWN - timeSinceLastNotification);
  }

  /**
   * Detener el servicio Observer
   */
  stop() {
    console.log('🛑 Deteniendo Simple Observer...');
    
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    
    this.isActive = false;
    console.log('✅ Simple Observer detenido');
  }

  /**
   * Obtener estadísticas del servicio
   */
  getStats() {
    const now = new Date();
    const timeSinceLastMessage = this.lastMessageData && this.lastMessageData.receivedAt
      ? now - this.lastMessageData.receivedAt
      : null;

    return {
      isActive: this.isActive,
      targetClientId: this.TARGET_CLIENT_ID,
      hasActiveTimer: !!this.inactivityTimer,
      lastMessageData: this.lastMessageData ? {
        chatId: this.lastMessageData.chatId,
        sender: this.lastMessageData.sender,
        receivedAt: this.lastMessageData.receivedAt,
        minutesAgo: timeSinceLastMessage ? Math.round(timeSinceLastMessage / (60 * 1000)) : null
      } : null,
      lastNotificationSent: this.lastNotificationSent,
      isInCooldown: this.isInCooldown(),
      remainingCooldownMinutes: this.isInCooldown() ? Math.round(this.getRemainingCooldown() / (60 * 1000)) : 0,
      thresholdMinutes: this.THRESHOLD_TIME / (60 * 1000),
      cooldownMinutes: this.NOTIFICATION_COOLDOWN / (60 * 1000),
      architecture: 'n8n HTTP notification based'
    };
  }

  /**
   * Forzar verificación manual (para testing)
   */
  async forceCheck() {
    console.log('🔧 Forzando verificación manual...');
    
    // Cancelar timer actual
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    
    // Ejecutar verificación inmediatamente
    await this.handleInactivityDetected();
  }

  /**
   * Enviar email de prueba
   */
  async sendTestEmail() {
    console.log('📧 Enviando email de prueba desde Simple Observer...');
    return await this.emailService.sendTestEmail();
  }

  /**
   * Simular llegada de mensaje (para testing)
   */
  simulateMessage(testData = {}) {
    const mockMessage = {
      clientId: this.TARGET_CLIENT_ID,
      chatId: testData.chatId || '5492213800680',
      sender: testData.sender || 'bot',
      content: testData.content || 'Mensaje de prueba',
      timestamp: new Date().toISOString(),
      ...testData
    };
    
    console.log('🧪 Simulando llegada de mensaje para testing...');
    this.onNewMessage(mockMessage);
    
    return mockMessage;
  }
}

module.exports = SimpleObserverService;