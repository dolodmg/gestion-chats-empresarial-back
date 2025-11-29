const axios = require('axios');
const User = require('../models/User');

/**
 * Servicio para enviar mensajes a través de la API de WhatsApp
 * Ahora obtiene el token dinámicamente desde la base de datos
 */
class WhatsAppService {
  
  /**
   * Obtiene el token de WhatsApp para un cliente específico
   * @param {string} clientId - ID del cliente
   * @returns {Promise<string>} - Token de WhatsApp del cliente
   */
  static async getClientToken(clientId) {
    try {
      const user = await User.findOne({ clientId, role: 'client' })
        .select('whatsappToken');
      
      if (!user) {
        throw new Error(`No se encontró el cliente con ID: ${clientId}`);
      }
      
      if (!user.whatsappToken) {
        throw new Error(`Cliente ${clientId} no tiene token de WhatsApp configurado`);
      }
      
      return user.whatsappToken;
    } catch (error) {
      console.error('Error obteniendo token del cliente:', error);
      throw error;
    }
  }

  /**
   * Envía un mensaje de texto a un número de WhatsApp
   * @param {string} clientId - ID del cliente (se usa en la URL)
   * @param {string} phoneNumber - Número de teléfono del destinatario (con código de país)
   * @param {string} message - Contenido del mensaje a enviar
   * @returns {Promise} - Respuesta de la API de WhatsApp
   */
  static async sendTextMessage(clientId, phoneNumber, message) {
    try {
      // Verificar que los parámetros requeridos estén presentes
      if (!clientId || !phoneNumber || !message) {
        throw new Error('ClientId, número de teléfono y mensaje son requeridos');
      }

      // Obtener token del cliente desde la base de datos
      const token = await this.getClientToken(clientId);
      
      // Construir URL dinámicamente usando el clientId
      const apiUrl = `https://graph.facebook.com/v22.0/${clientId}/messages`;
      
      // Limpiar el número de teléfono (eliminar espacios, guiones, etc.)
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');

      // Preparar el payload según la estructura requerida
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhoneNumber,
        type: "text",
        text: {
          preview_url: false,
          body: message
        }
      };

      console.log(`Enviando mensaje WhatsApp desde cliente ${clientId} a ${cleanPhoneNumber}`);
      console.log(`URL: ${apiUrl}`);

      // Realizar la petición a la API
      const response = await axios.post(
        apiUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('Mensaje enviado correctamente:', response.data);
      return response.data;

    } catch (error) {
      console.error('Error al enviar mensaje de WhatsApp:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  /**
   * Envía una imagen a un número de WhatsApp
   * @param {string} clientId - ID del cliente
   * @param {string} phoneNumber - Número de teléfono del destinatario
   * @param {string} imageUrl - URL de la imagen a enviar
   * @param {string} caption - Pie de foto opcional
   */
  static async sendImageMessage(clientId, phoneNumber, imageUrl, caption = '') {
    try {
      // Obtener token del cliente desde la base de datos
      const token = await this.getClientToken(clientId);
      
      // Construir URL dinámicamente usando el clientId
      const apiUrl = `https://graph.facebook.com/v22.0/${clientId}/messages`;
      
      // Limpiar el número de teléfono
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');

      // Preparar el payload para mensaje con imagen
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhoneNumber,
        type: "image",
        image: {
          link: imageUrl,
          caption: caption
        }
      };

      console.log(`Enviando imagen WhatsApp desde cliente ${clientId} a ${cleanPhoneNumber}`);

      // Realizar la petición a la API
      const response = await axios.post(
        apiUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('Imagen enviada correctamente:', response.data);
      return response.data;

    } catch (error) {
      console.error('Error al enviar imagen de WhatsApp:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  /**
   * Método para compatibilidad con código existente que solo pasa phoneNumber y message
   * Mantiene la misma interfaz pero ahora requiere clientId
   * @param {string} phoneNumber - Número de teléfono
   * @param {string} message - Mensaje a enviar
   * @deprecated Usar sendTextMessage(clientId, phoneNumber, message) directamente
   */
  static async sendTextMessageLegacy(phoneNumber, message) {
    console.warn('⚠️ Método legacy llamado. Se requiere migrar a sendTextMessage(clientId, phoneNumber, message)');
    throw new Error('Este método requiere clientId. Usar sendTextMessage(clientId, phoneNumber, message)');
  }
}

module.exports = WhatsAppService;