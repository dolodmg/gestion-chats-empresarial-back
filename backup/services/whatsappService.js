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

  // ==================== TEMPLATE MANAGEMENT ====================

  /**
   * Obtiene el WABA ID de un cliente
   * @param {string} clientId - ID del cliente
   * @returns {Promise<string>} - WABA ID del cliente
   */
  static async getClientWabaId(clientId) {
    try {
      const user = await User.findOne({ clientId, role: 'client' })
        .select('wabaId');

      if (!user) {
        throw new Error(`No se encontró el cliente con ID: ${clientId}`);
      }

      if (!user.wabaId) {
        throw new Error(`Cliente ${clientId} no tiene WABA ID configurado`);
      }

      return user.wabaId;
    } catch (error) {
      console.error('Error obteniendo WABA ID del cliente:', error);
      throw error;
    }
  }

  /**
   * Crea una plantilla de mensaje en Facebook
   * @param {string} clientId - ID del cliente
   * @param {string} wabaId - WhatsApp Business Account ID
   * @param {Object} templateData - Datos de la plantilla
   * @returns {Promise} - Respuesta de la API de Facebook
   */
  static async createTemplate(clientId, wabaId, templateData) {
    try {
      const token = await this.getClientToken(clientId);
      const apiUrl = `https://graph.facebook.com/v22.0/${wabaId}/message_templates`;

      console.log(`Creando plantilla en Facebook para WABA ${wabaId}`);

      const response = await axios.post(
        apiUrl,
        templateData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('Plantilla creada exitosamente:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error al crear plantilla:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  /**
   * Lista las plantillas de un WABA
   * @param {string} clientId - ID del cliente
   * @param {string} wabaId - WhatsApp Business Account ID
   * @param {Object} filters - Filtros opcionales (status, name, etc.)
   * @returns {Promise} - Lista de plantillas
   */
  static async listTemplates(clientId, wabaId, filters = {}) {
    try {
      const token = await this.getClientToken(clientId);
      let apiUrl = `https://graph.facebook.com/v22.0/${wabaId}/message_templates`;

      // Agregar filtros a la URL
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.name) params.append('name', filters.name);
      if (filters.language) params.append('language', filters.language);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString();
      if (queryString) {
        apiUrl += `?${queryString}`;
      }

      console.log(`Listando plantillas de WABA ${wabaId}`);

      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log(`Plantillas obtenidas: ${response.data.data?.length || 0}`);
      return response.data;
    } catch (error) {
      console.error('Error al listar plantillas:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  /**
   * Elimina una plantilla de Facebook
   * @param {string} clientId - ID del cliente
   * @param {string} wabaId - WhatsApp Business Account ID
   * @param {string} templateName - Nombre de la plantilla a eliminar
   * @returns {Promise} - Respuesta de la API
   */
  static async deleteTemplate(clientId, wabaId, templateName) {
    try {
      const token = await this.getClientToken(clientId);
      const apiUrl = `https://graph.facebook.com/v22.0/${wabaId}/message_templates?name=${templateName}`;

      console.log(`Eliminando plantilla ${templateName} de WABA ${wabaId}`);

      const response = await axios.delete(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Plantilla eliminada exitosamente:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error al eliminar plantilla:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  /**
   * Envía una plantilla de mensaje a un número de WhatsApp
   * @param {string} clientId - ID del cliente (Phone Number ID)
   * @param {string} phoneNumber - Número de teléfono del destinatario
   * @param {string} templateName - Nombre de la plantilla
   * @param {string} languageCode - Código de idioma (ej: 'es', 'en_US')
   * @param {Array} components - Componentes con parámetros de la plantilla
   * @returns {Promise} - Respuesta de la API de WhatsApp
   */
  static async sendTemplateMessage(clientId, phoneNumber, templateName, languageCode, components = []) {
    try {
      const token = await this.getClientToken(clientId);
      const apiUrl = `https://graph.facebook.com/v22.0/${clientId}/messages`;

      // Limpiar el número de teléfono
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');

      // Preparar el payload para enviar plantilla
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhoneNumber,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode
          }
        }
      };

      // Agregar componentes si existen (parámetros)
      if (components && components.length > 0) {
        payload.template.components = components;
      }

      console.log(`Enviando plantilla "${templateName}" a ${cleanPhoneNumber}`);
      console.log('Payload:', JSON.stringify(payload, null, 2));

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

      console.log('Plantilla enviada correctamente:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error al enviar plantilla:', error.response ? error.response.data : error.message);
      throw error;
    }
  }
}

module.exports = WhatsAppService;
