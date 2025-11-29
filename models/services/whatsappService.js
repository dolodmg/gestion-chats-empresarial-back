const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

// Token de acceso desde variables de entorno
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v22.0/577642088768581/messages';

/**
 * Servicio para enviar mensajes a través de la API de WhatsApp
 */
class WhatsAppService {
  /**
   * Envía un mensaje de texto a un número de WhatsApp
   * @param {string} phoneNumber - Número de teléfono del destinatario (con código de país)
   * @param {string} message - Contenido del mensaje a enviar
   * @returns {Promise} - Respuesta de la API de WhatsApp
   */
  static async sendTextMessage(phoneNumber, message) {
    try {
      // Verificar que los parámetros requeridos estén presentes
      if (!phoneNumber || !message) {
        throw new Error('Número de teléfono y mensaje son requeridos');
      }

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

      console.log(`Enviando mensaje a WhatsApp: ${cleanPhoneNumber}`);

      // Realizar la petición a la API
      const response = await axios.post(
        WHATSAPP_API_URL,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`
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
   * Envía una imagen a un número de WhatsApp (para implementaciones futuras)
   * @param {string} phoneNumber - Número de teléfono del destinatario
   * @param {string} imageUrl - URL de la imagen a enviar
   * @param {string} caption - Pie de foto opcional
   */
  static async sendImageMessage(phoneNumber, imageUrl, caption = '') {
    try {
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

      // Realizar la petición a la API
      const response = await axios.post(
        WHATSAPP_API_URL,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`
          }
        }
      );

      return response.data;

    } catch (error) {
      console.error('Error al enviar imagen de WhatsApp:', error.response ? error.response.data : error.message);
      throw error;
    }
  }
}

module.exports = WhatsAppService;
