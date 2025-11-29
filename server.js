const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// ✨ SSE Service para notificaciones en tiempo real
const sseService = require('./services/sseService');

// ⏸️ COMENTADO: Email monitoring service (deshabilitado temporalmente)
// const SimpleObserverService = require('./services/simpleObserverService');

// ✨ Middleware de autenticación n8n
const authenticateN8N = require('./middleware/authenticateN8N');

const tagRoutes = require('./routes/tags');

dotenv.config();
const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Conectar a la base de datos
require('./config/db');

// ⏸️ COMENTADO: Variable global para el Simple Observer
// let messageMonitor = null;

// ⏸️ COMENTADO: Función para inicializar el Simple Observer
// async function initializeSimpleObserver() {
//   try {
//     console.log('🔧 Inicializando Simple Observer (notificado por n8n)...');
//     console.log('📧 Email configurado: emiliano@pushandpullnow.com');
//     console.log('🎯 Cliente monitoreado: 577642088768581');
//     console.log('📬 Destinatarios: emirioslp@gmail.com, elisandrodanielsantos@gmail.com');
//     console.log('🚀 Arquitectura: HTTP notifications from n8n');
//     
//     messageMonitor = new SimpleObserverService();
//     const initialized = await messageMonitor.initialize();
//     
//     if (initialized) {
//       console.log('✅ Simple Observer iniciado correctamente');
//       console.log('📞 API lista para recibir notificaciones de n8n');
//       console.log('⏰ Timer: 30 min | Cooldown: 1 hora');
//     } else {
//       console.error('❌ Error iniciando Simple Observer');
//     }
//   } catch (error) {
//     console.error('❌ Error fatal inicializando Simple Observer:', error);
//   }
// }

// ==================== RUTAS API ====================

// Rutas de autenticación y usuarios
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));

// Rutas de chat y mensajería
app.use('/api/chats', require('./routes/chats'));
app.use('/api/tags', tagRoutes);

// ✨ NUEVO: Ruta SSE para notificaciones en tiempo real
app.use('/api/sse', require('./routes/sse'));

// Rutas de n8n y assistant
app.use('/api/n8n', require('./routes/n8n'));
app.use('/api/assistant', require('./routes/assistant'));

// Rutas de inscripciones y tablas
app.use('/api/inscriptions', require('./routes/inscriptions'));
app.use('/api/custom-tables', require('./routes/customTables'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/faqs', require('./routes/faqs'));

// ==================== ENDPOINT N8N ====================

// ✨ API ENDPOINT PRINCIPAL - Notificación de n8n (CON AUTENTICACIÓN)
app.post('/api/message-notification', authenticateN8N, async (req, res) => {
  try {
    console.log('📞 Notificación recibida de n8n');

    // ⏸️ COMENTADO: Observer no disponible check
    // if (!messageMonitor) {
    //   console.error('❌ Observer no disponible');
    //   return res.status(503).json({ 
    //     success: false, 
    //     error: 'Observer no disponible' 
    //   });
    // }

    const messageData = req.body;
    
    // Validación básica
    if (!messageData.clientId) {
      console.error('❌ clientId faltante en notificación');
      return res.status(400).json({ 
        success: false, 
        error: 'clientId requerido' 
      });
    }

    // Log de la notificación recibida
    console.log(`📨 Datos recibidos:`, {
      clientId: messageData.clientId,
      chatId: messageData.chatId,
      sender: messageData.sender,
      timestamp: messageData.timestamp
    });

    // ⏸️ COMENTADO: Notificar al Observer para email monitoring
    // messageMonitor.onNewMessage(messageData);

    // ✨ NUEVO: Notificar a clientes SSE conectados en tiempo real
    sseService.notifyNewMessage({
      chatId: messageData.chatId,
      clientId: messageData.clientId,
      sender: messageData.sender || 'user',
      content: messageData.content,
      timestamp: messageData.timestamp || new Date().toISOString(),
      phoneNumber: messageData.phoneNumber
    });
    
    res.json({ 
      success: true, 
      message: 'Notificación procesada y transmitida vía SSE',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error procesando notificación de n8n:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// ==================== ENDPOINTS DE MONITOREO ====================

// ✨ Estadísticas de conexiones SSE (para debugging)
app.get('/api/sse/stats', async (req, res) => {
  try {
    const stats = {
      totalConnections: sseService.getTotalConnections(),
      clients: sseService.getClientsInfo()
    };
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas SSE:', error);
    res.status(500).json({ error: error.message });
  }
});

// ⏸️ COMENTADO: Endpoints del Observer para email monitoring
// app.get('/api/observer/test-email', async (req, res) => {
//   try {
//     if (!messageMonitor) {
//       return res.status(503).json({ error: 'Observer no disponible' });
//     }
//     
//     console.log('🧪 Test de email solicitado');
//     const result = await messageMonitor.sendTestEmail();
//     
//     res.json({
//       success: result.success,
//       message: result.success ? 'Email de prueba enviado' : 'Error enviando email',
//       details: result,
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     console.error('Error en test de email:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.get('/api/observer/stats', async (req, res) => {
//   try {
//     if (!messageMonitor) {
//       return res.status(503).json({ error: 'Observer no disponible' });
//     }
//     
//     const stats = await messageMonitor.getStats();
//     res.json({
//       success: true,
//       stats,
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     console.error('Error obteniendo estadísticas:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post('/api/observer/force-check', async (req, res) => {
//   try {
//     if (!messageMonitor) {
//       return res.status(503).json({ error: 'Observer no disponible' });
//     }
//     
//     console.log('🔧 Verificación manual solicitada');
//     await messageMonitor.forceCheck();
//     
//     res.json({
//       success: true,
//       message: 'Verificación manual ejecutada',
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     console.error('Error en verificación manual:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post('/api/observer/simulate-message', (req, res) => {
//   try {
//     if (!messageMonitor) {
//       return res.status(503).json({ error: 'Observer no disponible' });
//     }
//     
//     console.log('🧪 Simulación de mensaje solicitada');
//     const mockMessage = messageMonitor.simulateMessage(req.body);
//     
//     res.json({
//       success: true,
//       message: 'Mensaje simulado correctamente',
//       mockMessage,
//       timestamp: new Date().toISOString()
//     });
//   } catch (error) {
//     console.error('Error simulando mensaje:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// ==================== FRONTEND ROUTES ====================

// Servir archivos estáticos
app.use(express.static('public'));

// Rutas principales
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/profile.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/assistant.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'assistant.html'));
});

app.get('/inscriptions.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'inscriptions.html'));
});

app.get('/table-data.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'table-data.html'));
});

app.get('/table-management.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'table-management.html'));
});

// Rutas amigables (sin .html)
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/assistant', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'assistant.html'));
});

app.get('/inscriptions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'inscriptions.html'));
});

app.get('/table-data', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'table-data.html'));
});

app.get('/data', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'table-data.html'));
});

app.get('/mis-datos', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'table-data.html'));
});

app.get('/table-management', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'table-management.html'));
});

// Ruta para manejar cualquier otra petición (404)
app.get('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== SERVER INITIALIZATION ====================

const PORT = process.env.PORT || 5000;

// ⏸️ COMENTADO: Inicializar Simple Observer después de que la DB esté conectada
// mongoose.connection.once('open', () => {
//   console.log('✅ Conexión a MongoDB establecida');
//   
//   // Esperar 2 segundos para inicializar el Observer
//   setTimeout(() => {
//     initializeSimpleObserver();
//   }, 2000);
// });

// Manejar errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // ⏸️ COMENTADO: Stop observer
  // if (messageMonitor) {
  //   messageMonitor.stop();
  // }
  process.exit(1);
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
  // ⏸️ COMENTADO: Stop observer
  // if (messageMonitor) {
  //   messageMonitor.stop();
  // }
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

process.on('SIGINT', () => {
  console.log('🛑 Recibida señal SIGINT (Ctrl+C), cerrando servidor...');
  // ⏸️ COMENTADO: Stop observer
  // if (messageMonitor) {
  //   messageMonitor.stop();
  // }
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {

});