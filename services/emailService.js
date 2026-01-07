const nodemailer = require('nodemailer');

/**
 * Servicio para envío de emails usando servidor empresarial de Hostinger
 * Configuración específica para servidores SMTP de Hostinger
 */
class EmailService {

  constructor() {
    // Configuración del transporter para Hostinger
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true para 465, false para 587
      auth: {
        user: process.env.EMAIL_USER, // Tu email empresarial
        pass: process.env.EMAIL_PASSWORD // Contraseña de tu email
      },
      tls: {
        rejectUnauthorized: false // Permite certificados autofirmados
      },
      // Configuraciones adicionales para Hostinger
      connectionTimeout: 60000, // 60 segundos
      greetingTimeout: 30000,    // 30 segundos
      socketTimeout: 60000       // 60 segundos
    });

    // Emails destinatarios fijos
    this.NOTIFICATION_EMAILS = [
      'emirioslp@gmail.com',
      'elisandrodanielsantos@gmail.com'
    ];

    console.log(`📧 Email Service configurado con:`);
    console.log(`   - Host: ${process.env.SMTP_HOST || 'smtp.hostinger.com'}`);
    console.log(`   - Puerto: ${process.env.SMTP_PORT || 587}`);
    console.log(`   - Email: ${process.env.EMAIL_USER}`);
    console.log(`   - Destinatarios: ${this.NOTIFICATION_EMAILS.join(', ')}`);
  }

  /**
   * Create transporter from email credential
   */
  createTransporterFromCredential(credential, plaintextPassword) {
    return nodemailer.createTransport({
      host: credential.host,
      port: credential.port,
      secure: credential.secure,
      auth: {
        user: credential.user,
        pass: plaintextPassword
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000
    });
  }

  /**
   * Verificar configuración del servicio de email
   */
  async verifyEmailConfig() {
    try {
      console.log('🔧 Verificando configuración de email empresarial...');

      // Verificar conexión con timeout
      const verified = await Promise.race([
        this.transporter.verify(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout verificando email')), 15000)
        )
      ]);

      if (verified) {
        console.log('✅ Configuración de email empresarial verificada correctamente');
        console.log(`✅ Conectado al servidor: ${process.env.SMTP_HOST || 'smtp.hostinger.com'}`);
        return true;
      }

    } catch (error) {
      console.error('❌ Error en configuración de email empresarial:', error.message);

      // Mostrar ayuda específica según el tipo de error
      if (error.code === 'EAUTH') {
        console.error('💡 Problema de autenticación - Verifica email y contraseña');
      } else if (error.code === 'ECONNECTION') {
        console.error('💡 Problema de conexión - Verifica host y puerto SMTP');
      } else if (error.code === 'ETIMEDOUT') {
        console.error('💡 Timeout de conexión - Verifica configuración de red');
      }

      return false;
    }
  }

  /**
   * Enviar notificación de inactividad de mensajes
   */
  async sendInactivityAlert(lastMessage, timeDifference) {
    try {
      const minutesInactive = Math.round(timeDifference / (60 * 1000));
      const hoursInactive = Math.round(minutesInactive / 60);

      console.log(`📧 Preparando notificación de inactividad (${minutesInactive} min sin actividad)`);

      // Generar contenido del email
      const emailContent = this.generateInactivityEmailContent(lastMessage, minutesInactive, hoursInactive);

      // Configurar el email
      const mailOptions = {
        from: {
          name: 'Sistema INTELIGENTE - Monitoreo WhatsApp',
          address: process.env.EMAIL_USER
        },
        to: this.NOTIFICATION_EMAILS,
        subject: `🚨 Alerta: Sin mensajes de WhatsApp por ${hoursInactive > 1 ? hoursInactive + ' horas' : minutesInactive + ' minutos'}`,
        html: emailContent.html,
        text: emailContent.text,
        priority: 'high', // Marcar como alta prioridad
        headers: {
          'X-Mailer': 'Sistema INTELIGENTE v1.0',
          'X-Priority': '1'
        }
      };

      console.log('📤 Enviando notificación de inactividad...');

      // Enviar email con timeout
      const info = await Promise.race([
        this.transporter.sendMail(mailOptions),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout enviando email')), 30000)
        )
      ]);

      console.log('✅ Notificación de inactividad enviada correctamente');
      console.log(`📧 Message ID: ${info.messageId}`);
      console.log(`📧 Emails enviados a: ${this.NOTIFICATION_EMAILS.join(', ')}`);

      return {
        success: true,
        messageId: info.messageId,
        recipients: this.NOTIFICATION_EMAILS,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error enviando notificación de inactividad:', error.message);

      // Log adicional para debugging
      if (error.code) {
        console.error(`   - Código de error: ${error.code}`);
      }
      if (error.response) {
        console.error(`   - Respuesta del servidor: ${error.response}`);
      }

      return {
        success: false,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generar contenido HTML y texto del email de inactividad
   */
  generateInactivityEmailContent(lastMessage, minutesInactive, hoursInactive) {
    const lastMessageTime = new Date(lastMessage.timestamp).toLocaleString('es-ES', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const timeDisplay = hoursInactive > 1
      ? `${hoursInactive} horas y ${minutesInactive % 60} minutos`
      : `${minutesInactive} minutos`;

    const currentTime = new Date().toLocaleString('es-ES', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Alerta de Inactividad - WhatsApp</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 650px; 
            margin: 20px auto; 
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #dc3545, #c82333);
            color: white; 
            padding: 30px 20px; 
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 300;
          }
          .header p {
            margin: 10px 0 0 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .content { 
            padding: 30px 25px;
          }
          .footer { 
            background-color: #6c757d; 
            color: white; 
            padding: 20px; 
            text-align: center;
            font-size: 14px;
          }
          .alert-box { 
            background: linear-gradient(135deg, #fff3cd, #ffeaa7);
            border-left: 5px solid #ffc107;
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
          }
          .alert-box h2 {
            margin-top: 0;
            color: #856404;
            font-size: 22px;
          }
          .info-box { 
            background: linear-gradient(135deg, #d1ecf1, #bee5eb);
            border-left: 5px solid #17a2b8;
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
          }
          .info-box h3 {
            margin-top: 0;
            color: #0c5460;
            font-size: 18px;
          }
          .timestamp { 
            font-weight: bold; 
            color: #dc3545; 
            font-size: 16px;
          }
          .last-message { 
            background-color: #f8f9fa; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 15px 0; 
            font-style: italic;
            border-left: 4px solid #dee2e6;
          }
          .actions-box {
            background: linear-gradient(135deg, #f8d7da, #f5c6cb);
            border-left: 5px solid #dc3545;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .actions-box h3 {
            margin-top: 0;
            color: #721c24;
          }
          .actions-box ul {
            margin: 10px 0;
            padding-left: 20px;
          }
          .actions-box li {
            margin: 8px 0;
            color: #721c24;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
          }
          .stat-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #dee2e6;
          }
          .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #dc3545;
            display: block;
          }
          .stat-label {
            font-size: 12px;
            color: #6c757d;
            text-transform: uppercase;
            margin-top: 5px;
          }
          @media (max-width: 600px) {
            .container { margin: 10px; }
            .content { padding: 20px 15px; }
            .stats-grid { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 Alerta de Inactividad</h1>
            <p>Sistema de Monitoreo INTELIGENTE - WhatsApp</p>
          </div>
          
          <div class="content">
            <div class="alert-box">
              <h2>⚠️ Sin actividad detectada</h2>
              <p>No se han recibido mensajes de WhatsApp en los últimos <strong>${timeDisplay}</strong>.</p>
              
              <div class="stats-grid">
                <div class="stat-card">
                  <span class="stat-number">${minutesInactive}</span>
                  <div class="stat-label">Minutos</div>
                </div>
                <div class="stat-card">
                  <span class="stat-number">${Math.round(hoursInactive * 10) / 10}</span>
                  <div class="stat-label">Horas</div>
                </div>
              </div>
            </div>
            
            <div class="info-box">
              <h3>📊 Información del último mensaje</h3>
              <p><strong>📅 Fecha y hora:</strong> <span class="timestamp">${lastMessageTime}</span></p>
              <p><strong>💬 Chat ID:</strong> ${lastMessage.chatId || 'No disponible'}</p>
              <p><strong>📱 Teléfono:</strong> ${lastMessage.phoneNumber || 'No disponible'}</p>
              <p><strong>👤 Tipo:</strong> ${lastMessage.sender === 'user' ? 'Usuario' : 'Bot'}</p>
              
              <div class="last-message">
                <strong>💌 Último mensaje:</strong><br>
                ${lastMessage.content ? lastMessage.content.substring(0, 200) + (lastMessage.content.length > 200 ? '...' : '') : 'No disponible'}
              </div>
            </div>
            
            <div class="actions-box">
              <h3>🔧 Acciones recomendadas</h3>
              <ul>
                <li><strong>Verificar el estado del servicio de WhatsApp</strong> - Comprobar si la API responde</li>
                <li><strong>Revisar la configuración de n8n</strong> - Workflows activos y funcionando</li>
                <li><strong>Comprobar la conectividad</strong> - Internet y servicios en línea</li>
                <li><strong>Verificar logs del sistema</strong> - Buscar errores recientes</li>
                <li><strong>Revisar webhooks</strong> - Configuración de recepción de mensajes</li>
              </ul>
            </div>

            <div style="background: #e9ecef; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 14px; color: #6c757d;">
              <strong>📋 Información técnica:</strong><br>
              • Alerta generada: ${currentTime}<br>
              • Cliente monitoreado: 577642088768581<br>
              • Umbral configurado: 30 minutos<br>
              • Sistema: INTELIGENTE v1.0
            </div>
          </div>
          
          <div class="footer">
            <p><strong>© ${new Date().getFullYear()} Sistema INTELIGENTE</strong></p>
            <p>Monitoreo Automático de WhatsApp | Cliente ID: 577642088768581</p>
            <p><small>Esta es una notificación automática del sistema de monitoreo</small></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
🚨 ALERTA DE INACTIVIDAD - WhatsApp

Sin actividad detectada en los últimos ${timeDisplay}.

INFORMACIÓN DEL ÚLTIMO MENSAJE:
• Fecha y hora: ${lastMessageTime}
• Chat ID: ${lastMessage.chatId || 'No disponible'}
• Teléfono: ${lastMessage.phoneNumber || 'No disponible'}
• Tipo: ${lastMessage.sender === 'user' ? 'Usuario' : 'Bot'}
• Contenido: ${lastMessage.content ? lastMessage.content.substring(0, 200) : 'No disponible'}

ACCIONES RECOMENDADAS:
• Verificar el estado del servicio de WhatsApp
• Revisar la configuración de n8n
• Comprobar la conectividad de la aplicación
• Verificar logs del sistema para errores
• Revisar webhooks de recepción de mensajes

INFORMACIÓN TÉCNICA:
• Alerta generada: ${currentTime}
• Cliente monitoreado: 577642088768581
• Umbral configurado: 30 minutos
• Sistema: INTELIGENTE v1.0

---
Sistema INTELIGENTE - Monitoreo Automático
Esta es una notificación automática del sistema de monitoreo
    `;

    return { html, text };
  }

  /**
   * Enviar email de prueba para verificar funcionamiento
   */
  async sendTestEmail() {
    try {
      console.log('📧 Preparando email de prueba...');

      const currentTime = new Date().toLocaleString('es-ES', {
        timeZone: 'America/Argentina/Buenos_Aires'
      });

      const mailOptions = {
        from: {
          name: 'Sistema INTELIGENTE - Prueba',
          address: process.env.EMAIL_USER
        },
        to: this.NOTIFICATION_EMAILS,
        subject: '✅ Prueba - Sistema de Notificaciones WhatsApp',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 30px; text-align: center;">
              <h2 style="margin: 0; font-size: 24px;">✅ Prueba del Sistema de Notificaciones</h2>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Sistema INTELIGENTE - Monitoreo WhatsApp</p>
            </div>
            <div style="padding: 30px;">
              <p style="font-size: 16px; color: #333;">Este es un email de prueba para verificar que el sistema de notificaciones funciona correctamente.</p>
              
              <div style="background: #d4edda; border-left: 5px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 5px;">
                <h3 style="margin-top: 0; color: #155724;">📋 Información de la prueba:</h3>
                <p style="margin: 5px 0;"><strong>📅 Fecha:</strong> ${currentTime}</p>
                <p style="margin: 5px 0;"><strong>🎯 Cliente ID:</strong> 577642088768581</p>
                <p style="margin: 5px 0;"><strong>📧 Servidor:</strong> ${process.env.SMTP_HOST || 'smtp.hostinger.com'}</p>
                <p style="margin: 5px 0;"><strong>✉️ Email origen:</strong> ${process.env.EMAIL_USER}</p>
              </div>

              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; color: #6c757d; font-size: 14px;">
                  <strong>🚀 Estado:</strong> Sistema operativo y configurado correctamente<br>
                  <strong>⚙️ Monitoreo:</strong> Cada 5 minutos<br>
                  <strong>⏰ Umbral de alerta:</strong> 30 minutos sin mensajes<br>
                  <strong>🔄 Cooldown:</strong> 1 hora entre notificaciones
                </p>
              </div>
            </div>
            <div style="background: #6c757d; color: white; padding: 20px; text-align: center; font-size: 14px;">
              <p style="margin: 0;"><strong>Sistema INTELIGENTE v1.0</strong></p>
              <p style="margin: 5px 0 0 0; opacity: 0.8;">Monitoreo Automático de WhatsApp</p>
            </div>
          </div>
        `,
        text: `
✅ Prueba del Sistema de Notificaciones

Este es un email de prueba para verificar que el sistema de notificaciones funciona correctamente.

INFORMACIÓN DE LA PRUEBA:
• Fecha: ${currentTime}
• Cliente ID: 577642088768581
• Servidor: ${process.env.SMTP_HOST || 'smtp.hostinger.com'}
• Email origen: ${process.env.EMAIL_USER}

ESTADO DEL SISTEMA:
• Estado: Sistema operativo y configurado correctamente
• Monitoreo: Cada 5 minutos
• Umbral de alerta: 30 minutos sin mensajes
• Cooldown: 1 hora entre notificaciones

---
Sistema INTELIGENTE v1.0 - Monitoreo Automático de WhatsApp
        `,
        priority: 'normal'
      };

      console.log('📤 Enviando email de prueba...');

      const info = await Promise.race([
        this.transporter.sendMail(mailOptions),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout enviando email de prueba')), 30000)
        )
      ]);

      console.log('✅ Email de prueba enviado correctamente');
      console.log(`📧 Message ID: ${info.messageId}`);
      console.log(`📧 Destinatarios: ${this.NOTIFICATION_EMAILS.join(', ')}`);

      return {
        success: true,
        messageId: info.messageId,
        recipients: this.NOTIFICATION_EMAILS,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error enviando email de prueba:', error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Enviar email de campaña publicitaria
   */
  async sendCampaignEmail({ to, subject, html, text, recipientName, transporter, fromName, fromEmail, campaignId, recipientId }) {
    try {
      // Use custom transporter if provided
      const emailTransporter = transporter || this.transporter;
      const senderName = fromName || process.env.EMAIL_FROM_NAME || 'Campañas';
      const senderEmail = fromEmail || process.env.EMAIL_USER;

      const mailOptions = {
        from: {
          name: senderName,
          address: senderEmail
        },
        to: to,
        subject: subject,
        html: html,
        text: text || html.replace(/<[^>]*>/g, ''),
        headers: {
          'X-Mailer': 'Sistema INTELIGENTE - Campañas v1.0'
        }
      };

      // Personalizar contenido si hay nombre del destinatario
      if (recipientName) {
        mailOptions.html = mailOptions.html.replace(/\{\{nombre\}\}/gi, recipientName);
        mailOptions.text = mailOptions.text.replace(/\{\{nombre\}\}/gi, recipientName);
      }

      // Inject tracking pixel if campaignId and recipientId are provided
      if (campaignId && recipientId) {
        const trackingPixelUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/api/track/open/${campaignId}/${recipientId}`;
        const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;

        // Inject pixel before closing body tag, or at the end if no body tag
        if (mailOptions.html.includes('</body>')) {
          mailOptions.html = mailOptions.html.replace('</body>', `${trackingPixel}</body>`);
        } else {
          mailOptions.html += trackingPixel;
        }
      }

      const info = await Promise.race([
        emailTransporter.sendMail(mailOptions),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout enviando email de campaña')), 30000)
        )
      ]);

      return {
        success: true,
        messageId: info.messageId,
        recipient: to,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Error enviando email de campaña a ${to}:`, error.message);
      throw error;
    }
  }

  /**
   * Validar lista de emails
   */
  validateEmailList(emails) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const results = {
      valid: [],
      invalid: []
    };

    emails.forEach(email => {
      const trimmedEmail = email.trim().toLowerCase();
      if (emailRegex.test(trimmedEmail)) {
        results.valid.push(trimmedEmail);
      } else {
        results.invalid.push(email);
      }
    });

    return results;
  }
}

module.exports = EmailService;