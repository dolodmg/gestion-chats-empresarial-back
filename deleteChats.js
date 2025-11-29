const mongoose = require('mongoose');

// Configuración de MongoDB
const MONGO_URI = 'mongodb://appUser:07092015Leyla%40@localhost:27017/whatsappMonitorDB';
const CLIENT_ID = '564098906790434';

// Esquemas basados en tu proyecto
const ChatSchema = new mongoose.Schema({
  chatId: String,
  clientId: String,
  contactName: String,
  phoneNumber: String,
  lastMessage: String,
  lastMessageTimestamp: Date,
  unreadCount: Number,
  createdAt: Date,
  chatStatus: { type: String, enum: ['bot', 'human'], default: 'bot' },
  statusChangeTime: Date
}, { collection: 'chats' });

const MessageSchema = new mongoose.Schema({
  chatId: String,
  clientId: String,
  sender: { type: String, enum: ['user', 'bot'] },
  content: String,
  mediaUrl: String,
  mediaType: { type: String, enum: ['image', 'video', 'audio', 'document', null] },
  timestamp: Date,
  status: { type: String, enum: ['sent', 'delivered', 'read'] }
}, { collection: 'messages' });

const ChatStateSchema = new mongoose.Schema({
  chatId: String,
  clientId: String,
  state: String,
  data: mongoose.Schema.Types.Mixed,
  lastActivity: Date
}, { collection: 'chatstates' });

// Función principal para borrar chats
async function deleteClientChats(clientId) {
  let connection;
  
  try {
    console.log('🔄 Conectando a MongoDB...');
    connection = await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Conexión exitosa a MongoDB');
    
    // Crear los modelos
    const Chat = mongoose.model('Chat', ChatSchema);
    const Message = mongoose.model('Message', MessageSchema);
    const ChatState = mongoose.model('ChatState', ChatStateSchema);
    
    console.log(`🔍 Buscando datos para clientID: ${clientId}...`);
    
    // Contar registros antes de borrar
    const chatCount = await Chat.countDocuments({ clientId });
    const messageCount = await Message.countDocuments({ clientId });
    const chatStateCount = await ChatState.countDocuments({ clientId });
    
    console.log(`📊 Registros encontrados:`);
    console.log(`   - Chats: ${chatCount}`);
    console.log(`   - Mensajes: ${messageCount}`);
    console.log(`   - Estados de chat: ${chatStateCount}`);
    
    if (chatCount === 0 && messageCount === 0 && chatStateCount === 0) {
      console.log('❌ No se encontraron datos para el clientID especificado');
      return;
    }
    
    // Confirmar antes de proceder
    console.log(`\n⚠️  ADVERTENCIA: Se van a borrar TODOS los datos del clientID: ${clientId}`);
    console.log('   Esta acción NO se puede deshacer.');
    
    // En un entorno real, podrías agregar una confirmación manual aquí
    // Para este script, procederemos automáticamente
    
    console.log('\n🗑️  Iniciando borrado...');
    
    // Borrar en orden: primero los mensajes, luego estados, finalmente chats
    if (messageCount > 0) {
      console.log('🔄 Borrando mensajes...');
      const messageResult = await Message.deleteMany({ clientId });
      console.log(`✅ ${messageResult.deletedCount} mensajes borrados`);
    }
    
    if (chatStateCount > 0) {
      console.log('🔄 Borrando estados de chat...');
      const stateResult = await ChatState.deleteMany({ clientId });
      console.log(`✅ ${stateResult.deletedCount} estados de chat borrados`);
    }
    
    if (chatCount > 0) {
      console.log('🔄 Borrando chats...');
      const chatResult = await Chat.deleteMany({ clientId });
      console.log(`✅ ${chatResult.deletedCount} chats borrados`);
    }
    
    console.log('\n🎉 ¡Borrado completado exitosamente!');
    
    // Verificar que se borraron todos los datos
    const remainingChats = await Chat.countDocuments({ clientId });
    const remainingMessages = await Message.countDocuments({ clientId });
    const remainingStates = await ChatState.countDocuments({ clientId });
    
    if (remainingChats === 0 && remainingMessages === 0 && remainingStates === 0) {
      console.log('✅ Verificación: Todos los datos fueron borrados correctamente');
    } else {
      console.log(`⚠️  Advertencia: Aún quedan algunos registros:`);
      console.log(`   - Chats: ${remainingChats}`);
      console.log(`   - Mensajes: ${remainingMessages}`);
      console.log(`   - Estados: ${remainingStates}`);
    }
    
  } catch (error) {
    console.error('❌ Error durante el proceso:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      console.log('🔌 Cerrando conexión a MongoDB...');
      await mongoose.connection.close();
      console.log('✅ Conexión cerrada');
    }
  }
}

// Función de seguridad para validar clientID
function validateClientId(clientId) {
  if (!clientId || typeof clientId !== 'string' || clientId.trim().length === 0) {
    throw new Error('ClientID inválido');
  }
  
  // Validar que parece un ID válido (números)
  if (!/^\d+$/.test(clientId.trim())) {
    throw new Error('ClientID debe contener solo números');
  }
  
  return clientId.trim();
}

// Ejecutar el script
async function main() {
  try {
    console.log('🚀 Iniciando script de borrado de chats...');
    console.log(`📋 ClientID objetivo: ${CLIENT_ID}`);
    
    // Validar clientID
    const validClientId = validateClientId(CLIENT_ID);
    
    // Ejecutar borrado
    await deleteClientChats(validClientId);
    
  } catch (error) {
    console.error('💥 Error fatal:', error.message);
    process.exit(1);
  }
}

// Solo ejecutar si este archivo se ejecuta directamente
if (require.main === module) {
  main();
}

module.exports = { deleteClientChats, validateClientId };