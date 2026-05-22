const mongoose = require('mongoose');
const path = require('path');

// Cargar .env desde la raíz del proyecto
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * 🚀 Script para crear/actualizar índices en MongoDB
 * 
 * Este script crea índices que optimizan las consultas de chats y mensajes.
 * Si ya existen índices, los maneja correctamente.
 * 
 * Uso:
 *   node scripts/createIndexes.js
 */

async function createIndexes() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('❌ ERROR: No se encontró MONGO_URI en el archivo .env');
      process.exit(1);
    }
    
    console.log('📊 Conectando a MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB\n');
    
    const db = mongoose.connection.db;
    const Message = db.collection('messages');
    const Chat = db.collection('chats');
    
    // ========================================
    // VERIFICAR ÍNDICES EXISTENTES
    // ========================================
    console.log('🔍 Verificando índices existentes...\n');
    
    const existingMessageIndexes = await Message.indexes();
    const existingChatIndexes = await Chat.indexes();
    
    console.log('📝 Índices actuales en Messages:');
    existingMessageIndexes.forEach(index => {
      console.log(`   - ${index.name}`);
    });
    
    console.log('\n💬 Índices actuales en Chats:');
    existingChatIndexes.forEach(index => {
      console.log(`   - ${index.name}`);
    });
    
    // ========================================
    // FUNCIÓN HELPER PARA CREAR ÍNDICES
    // ========================================
    async function createOrSkipIndex(collection, keys, options, collectionName) {
      const indexName = options.name;
      const existingIndexes = collectionName === 'messages' ? existingMessageIndexes : existingChatIndexes;
      
      // Verificar si ya existe con el mismo nombre
      const existingIndex = existingIndexes.find(idx => idx.name === indexName);
      
      if (existingIndex) {
        console.log(`     ⏭️  Ya existe: ${indexName}`);
        return;
      }
      
      // Verificar si existe uno similar con diferente nombre
      const similarIndex = existingIndexes.find(idx => {
        return JSON.stringify(idx.key) === JSON.stringify(keys);
      });
      
      if (similarIndex && similarIndex.name !== indexName) {
        console.log(`     ⚠️  Existe índice similar con otro nombre: ${similarIndex.name}`);
        console.log(`        Eliminando el antiguo y creando el nuevo...`);
        
        try {
          await collection.dropIndex(similarIndex.name);
          console.log(`        ✅ Eliminado: ${similarIndex.name}`);
        } catch (err) {
          console.log(`        ⚠️  No se pudo eliminar: ${err.message}`);
        }
      }
      
      // Crear el nuevo índice
      try {
        await collection.createIndex(keys, options);
        console.log(`     ✅ Creado: ${indexName}`);
      } catch (err) {
        if (err.code === 11000 || err.codeName === 'IndexOptionsConflict') {
          console.log(`     ⏭️  Ya existe (conflicto): ${indexName}`);
        } else {
          throw err;
        }
      }
    }
    
    // ========================================
    // ÍNDICES PARA MESSAGES
    // ========================================
    console.log('\n📝 Creando/actualizando índices en Messages...\n');
    
    // Índice 1
    console.log('  1. Índice: clientId + chatId + timestamp...');
    await createOrSkipIndex(
      Message,
      { clientId: 1, chatId: 1, timestamp: -1 },
      { name: 'clientId_chatId_timestamp', background: true },
      'messages'
    );
    
    // Índice 2
    console.log('  2. Índice: clientId + chatId + sender + status...');
    await createOrSkipIndex(
      Message,
      { clientId: 1, chatId: 1, sender: 1, status: 1 },
      { name: 'unread_messages', background: true },
      'messages'
    );
    
    // Índice 3
    console.log('  3. Índice: chatId + clientId + timestamp...');
    await createOrSkipIndex(
      Message,
      { chatId: 1, clientId: 1, timestamp: 1 },
      { name: 'chatId_clientId_timestamp', background: true },
      'messages'
    );
    
    // ========================================
    // ÍNDICES PARA CHATS
    // ========================================
    console.log('\n💬 Creando/actualizando índices en Chats...\n');
    
    // Índice 1 (único)
    console.log('  1. Índice único: chatId + clientId...');
    await createOrSkipIndex(
      Chat,
      { chatId: 1, clientId: 1 },
      { name: 'chatId_clientId', unique: true, background: true },
      'chats'
    );
    
    // Índice 2
    console.log('  2. Índice: clientId + lastMessageTimestamp...');
    await createOrSkipIndex(
      Chat,
      { clientId: 1, lastMessageTimestamp: -1 },
      { name: 'clientId_lastMessage', background: true },
      'chats'
    );
    
    // Índice 3
    console.log('  3. Índice: chatStatus + statusChangeTime...');
    await createOrSkipIndex(
      Chat,
      { chatStatus: 1, statusChangeTime: 1 },
      { name: 'chatStatus_statusChangeTime', background: true },
      'chats'
    );
    
    // ========================================
    // VERIFICAR ÍNDICES FINALES
    // ========================================
    console.log('\n📋 Índices finales...\n');
    
    const finalMessageIndexes = await Message.indexes();
    console.log('📝 Messages:');
    finalMessageIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    console.log('\n💬 Chats:');
    const finalChatIndexes = await Chat.indexes();
    finalChatIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // ========================================
    // ESTADÍSTICAS
    // ========================================
    console.log('\n📊 Estadísticas:');
    const messagesCount = await Message.countDocuments();
    const chatsCount = await Chat.countDocuments();
    console.log(`   - Messages: ${messagesCount.toLocaleString()} documentos`);
    console.log(`   - Chats: ${chatsCount.toLocaleString()} documentos`);
    
    console.log('\n✅ ¡Proceso completado exitosamente!');
    console.log('🚀 El rendimiento de las consultas debería mejorar significativamente.\n');
    
    await mongoose.connection.close();
    console.log('👋 Conexión cerrada. ¡Listo!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('\n🔍 Detalles:', error.message);
    
    try {
      await mongoose.connection.close();
    } catch (e) {
      // Ignore
    }
    
    process.exit(1);
  }
}

// Ejecutar
console.log('🚀 Iniciando gestión de índices en MongoDB...\n');
createIndexes();
