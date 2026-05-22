const mongoose = require('mongoose');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const ChatState = require('../models/ChatState');
const Inscription = require('../models/Inscription');
const CustomTable = require('../models/CustomTable');
const path = require('path');

// ✅ CARGAR .env desde la raíz del proyecto
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ⚠️ CONFIGURAR ESTOS VALORES
const NEW_CLIENT_ID = '751524394719240';  // ID nuevo que Meta asignó (TEMPORAL)
const OLD_CLIENT_ID = '577642088768581';  // ID viejo que queremos MANTENER ← Este seguiremos usando

async function migrateToOldId() {
  try {
    // ✅ Verificar que la variable de entorno existe
    if (!process.env.MONGO_URI) {
      console.error('❌ ERROR: La variable MONGO_URI no está definida en .env');
      console.log('💡 Asegúrate de que el archivo .env existe en:', path.join(__dirname, '..', '.env'));
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    console.log('\n=== MIGRACIÓN INVERSA - De ID Nuevo a ID Viejo ===\n');
    console.log(`De (nuevo): ${NEW_CLIENT_ID}`);
    console.log(`A (viejo):  ${OLD_CLIENT_ID}`);
    console.log('\nEsto mantendrá el ID original de inscripciones.');

    // 1. Verificar cuántos datos hay con cada ID
    const newMessagesCount = await Message.countDocuments({ clientId: NEW_CLIENT_ID });
    const oldMessagesCount = await Message.countDocuments({ clientId: OLD_CLIENT_ID });

    console.log(`\n📊 Estado actual:`);
    console.log(`   Mensajes con ID nuevo (${NEW_CLIENT_ID}): ${newMessagesCount}`);
    console.log(`   Mensajes con ID viejo (${OLD_CLIENT_ID}): ${oldMessagesCount}`);

    if (newMessagesCount === 0) {
      console.log('\n⚠️  No hay mensajes con el ID nuevo. ¿Seguro que el ID es correcto?');
      console.log('💡 Tip: Ejecuta esta query en MongoDB para ver todos los clientId:');
      console.log('   db.messages.distinct("clientId")');
      return;
    }

    // 2. Confirmar antes de continuar
    console.log(`\n⚠️  Se migrarán ${newMessagesCount} registros del ID nuevo al viejo.`);
    console.log('   Después de esto, todo volverá a estar bajo el ID: 577642088768581');
    console.log('   Presiona Ctrl+C para cancelar en los próximos 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🔄 Iniciando migración inversa...\n');

    // 3. Migrar MENSAJES
    console.log('📝 Migrando mensajes del ID nuevo al viejo...');
    const messagesResult = await Message.updateMany(
      { clientId: NEW_CLIENT_ID },
      { $set: { clientId: OLD_CLIENT_ID } }
    );
    console.log(`   ✅ ${messagesResult.modifiedCount} mensajes migrados`);

    // 4. Migrar CHATS
    console.log('💬 Migrando chats...');
    const chatsResult = await Chat.updateMany(
      { clientId: NEW_CLIENT_ID },
      { $set: { clientId: OLD_CLIENT_ID } }
    );
    console.log(`   ✅ ${chatsResult.modifiedCount} chats migrados`);

    // 5. Migrar CHAT STATES
    console.log('🔄 Migrando estados de chat...');
    try {
      const chatStatesResult = await ChatState.updateMany(
        { clientId: NEW_CLIENT_ID },
        { $set: { clientId: OLD_CLIENT_ID } }
      );
      console.log(`   ✅ ${chatStatesResult.modifiedCount} estados de chat migrados`);
    } catch (error) {
      console.log('   ⚠️  No se pudo migrar ChatState:', error.message);
    }

    // 6. Migrar INSCRIPCIONES
    console.log('📝 Migrando inscripciones...');
    try {
      const inscriptionsResult = await Inscription.updateMany(
        { clientId: NEW_CLIENT_ID },
        { $set: { clientId: OLD_CLIENT_ID } }
      );
      console.log(`   ✅ ${inscriptionsResult.modifiedCount} inscripciones migradas`);
    } catch (error) {
      console.log('   ⚠️  No se pudo migrar Inscriptions:', error.message);
    }

    // 7. Migrar TABLAS PERSONALIZADAS
    console.log('🗂️  Migrando tablas personalizadas...');
    try {
      const tablesResult = await CustomTable.updateMany(
        { clientId: NEW_CLIENT_ID },
        { $set: { clientId: OLD_CLIENT_ID } }
      );
      console.log(`   ✅ ${tablesResult.modifiedCount} tablas personalizadas migradas`);
      
      // También migrar los DATOS dentro de cada tabla personalizada
      const customTables = await CustomTable.find({ clientId: OLD_CLIENT_ID });
      console.log(`   📊 Encontradas ${customTables.length} tablas personalizadas`);
      
      for (const table of customTables) {
        try {
          const collection = mongoose.connection.collection(table.collectionName);
          const result = await collection.updateMany(
            { clientId: NEW_CLIENT_ID },
            { $set: { clientId: OLD_CLIENT_ID } }
          );
          if (result.modifiedCount > 0) {
            console.log(`   ✅ Tabla "${table.tableName}": ${result.modifiedCount} registros migrados`);
          }
        } catch (err) {
          console.log(`   ⚠️  Error migrando tabla "${table.tableName}":`, err.message);
        }
      }
    } catch (error) {
      console.log('   ⚠️  No se pudo migrar Custom Tables:', error.message);
    }

    // 8. Verificar resultado final
    console.log('\n📊 Verificación final:');
    const finalNewCount = await Message.countDocuments({ clientId: NEW_CLIENT_ID });
    const finalOldCount = await Message.countDocuments({ clientId: OLD_CLIENT_ID });
    
    console.log(`   Mensajes con ID nuevo: ${finalNewCount} (debería ser 0)`);
    console.log(`   Mensajes con ID viejo: ${finalOldCount} (debería ser ${oldMessagesCount + newMessagesCount})`);

    if (finalNewCount === 0) {
      console.log('\n🎉 ¡Migración inversa completada exitosamente!');
    } else {
      console.log('\n⚠️  Advertencia: Todavía hay mensajes con el ID nuevo');
    }

    // 9. Mostrar resumen
    console.log('\n📋 Resumen de migración:');
    console.log(`   • Mensajes migrados: ${messagesResult.modifiedCount}`);
    console.log(`   • Chats migrados: ${chatsResult.modifiedCount}`);
    console.log(`   • Total ahora en ID viejo: ${finalOldCount}`);

    console.log('\n✅ Proceso completado.');
    console.log('\n📝 SIGUIENTE PASO CRÍTICO:');
    console.log('   ╔═══════════════════════════════════════════════════╗');
    console.log('   ║  ACTUALIZAR n8n WORKFLOW                          ║');
    console.log('   ║  Cambiar clientId de:                             ║');
    console.log(`   ║  "${NEW_CLIENT_ID}" (nuevo)           ║`);
    console.log('   ║  A:                                               ║');
    console.log(`   ║  "${OLD_CLIENT_ID}"  (viejo - MANTENER)  ║`);
    console.log('   ╚═══════════════════════════════════════════════════╝');
    console.log('\n   Sin este cambio, los nuevos mensajes seguirán');
    console.log('   guardándose con el ID nuevo y el problema volverá.');

  } catch (error) {
    console.error('❌ Error en migración:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
  }
}

// Ejecutar
migrateToOldId();