const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// ✨ NUEVO: Importar servicio de monitoreo
const MessageMonitorService = require('./services/messageMonitorService');

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Conectar a la base de datos
require('./config/db');

// ✨ NUEVO: Variable global para el servicio de monitoreo
let messageMonitor = null;

// ✨ NUEVO: Función para inicializar el monitoreo de mensajes
async function initializeMessageMonitoring() {
  try {
    console.log('🔧 Inicializando servicio de monitoreo de mensajes...');
    console.log('📧 Email configurado: emiliano@pushandpullnow.com');
    console.log('🎯 Cliente monitoreado: 577642088768581');
    console.log('📬 Destinatarios: emirioslp@gmail.com, elisandrodanielsantos@gmail.com');
    
    messageMonitor = new MessageMonitorService();
    const started = await messageMonitor.startMonitoring();
    
    if (started) {
      console.log('✅ Servicio de monitoreo de mensajes iniciado correctamente');
      console.log('⏰ Verificaciones cada 5 minutos | Umbral: 30 min | Cooldown: 1 hora');
    } else {
      console.error('❌ Error iniciando servicio de monitoreo de mensajes');
    }
  } catch (error) {
    console.error('❌ Error fatal inicializando monitoreo:', error);
  }
}

// Rutas API existentes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/n8n', require('./routes/n8n'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/inscriptions', require('./routes/inscriptions'));

// Servir archivos estáticos
app.use(express.static('public'));

// Rutas para la aplicación frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Mantener compatibilidad con las rutas actuales
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

// Rutas amigables
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

// Ruta para manejar cualquier otra petición (404)
app.get('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;

// ✨ NUEVO: Inicializar monitoreo después de que la DB esté conectada
mongoose.connection.once('open', () => {
  console.log('✅ Conexión a MongoDB establecida');
  
  // Esperar 5 segundos después de la conexión DB para inicializar el monitoreo
  setTimeout(() => {
    initializeMessageMonitoring();
  }, 5000);
});

// ✨ NUEVO: Manejo de cierre graceful del servidor
process.on('SIGTERM', () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
  if (messageMonitor) {
    messageMonitor.stopMonitoring();
  }
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

process.on('SIGINT', () => {
  console.log('🛑 Recibida señal SIGINT (Ctrl+C), cerrando servidor...');
  if (messageMonitor) {
    messageMonitor.stopMonitoring();
  }
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// ✨ NUEVO: Manejar errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  if (messageMonitor) {
    messageMonitor.stopMonitoring();
  }
  process.exit(1);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('📊 Sistema de monitoreo de WhatsApp configurado');
  console.log('🎯 Cliente objetivo: 577642088768581');
  console.log('📧 Email empresarial: emiliano@pushandpullnow.com');
  console.log('📬 Notificaciones a: emirioslp@gmail.com, elisandrodanielsantos@gmail.com');
});