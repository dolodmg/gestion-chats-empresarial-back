/**
 * SCRIPT PARA HABILITAR MÓDULO DE ASESORES
 * Cliente: 751524394719240
 * 
 * Este script habilita el módulo de asesores para el cliente específico
 * creando o actualizando la configuración en AdvisorConfig
 * 
 * Ejecutar: node scripts/enable-advisor-751524394719240.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const AdvisorConfig = require('../models/AdvisorConfig');

const CLIENT_ID = '751524394719240';

/**
 * Función principal para habilitar el módulo de asesores
 */
async function enableAdvisorModule() {
    try {
        console.log('🚀 Iniciando habilitación del módulo de asesores...\n');
        console.log(`📋 Cliente ID: ${CLIENT_ID}\n`);

        // Buscar configuración existente
        let config = await AdvisorConfig.findOne({ clientId: CLIENT_ID });

        if (!config) {
            // No existe, crear nueva configuración
            console.log('📝 No se encontró configuración existente, creando nueva...');

            config = new AdvisorConfig({
                clientId: CLIENT_ID,
                enabled: true
            });

            await config.save();

            console.log('✅ Configuración creada exitosamente');
            console.log(`   - Cliente ID: ${config.clientId}`);
            console.log(`   - Habilitado: ${config.enabled}`);
            console.log(`   - Fecha creación: ${config.createdAt}`);

        } else {
            // Ya existe, verificar si está habilitado
            if (config.enabled) {
                console.log('ℹ️  El módulo de asesores ya está habilitado para este cliente');
                console.log(`   - Cliente ID: ${config.clientId}`);
                console.log(`   - Habilitado: ${config.enabled}`);
                console.log(`   - Última actualización: ${config.updatedAt}`);
            } else {
                console.log('🔄 Configuración encontrada pero deshabilitada, habilitando...');

                config.enabled = true;
                await config.save();

                console.log('✅ Módulo habilitado exitosamente');
                console.log(`   - Cliente ID: ${config.clientId}`);
                console.log(`   - Habilitado: ${config.enabled}`);
                console.log(`   - Última actualización: ${config.updatedAt}`);
            }
        }

        console.log('\n✅ Proceso completado exitosamente');
        console.log('\n📝 PRÓXIMOS PASOS:');
        console.log('1. El módulo de asesores está ahora habilitado');
        console.log('2. Puedes crear asesores desde el panel de administración');
        console.log('3. Los asesores podrán ser asignados a tablas de "Mis Datos"');
        console.log('4. El sistema round-robin distribuirá leads automáticamente');

        return config;

    } catch (error) {
        console.error('❌ Error habilitando módulo de asesores:', error);
        throw error;
    }
}

/**
 * Función principal de ejecución
 */
async function main() {
    try {
        console.log('📡 Conectando a MongoDB...');

        // URI de conexión con autenticación
        const mongoUri = process.env.MONGODB_URI ||
            'mongodb://adminUser:07092015Leyla%40@localhost:27017/whatsappMonitorDB?authSource=admin';

        await mongoose.connect(mongoUri);
        console.log('✅ Conectado a MongoDB\n');

        // Habilitar módulo
        await enableAdvisorModule();

    } catch (error) {
        console.error('💥 Error ejecutando script:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Desconectado de MongoDB');
        process.exit(0);
    }
}

// Ejecutar script
if (require.main === module) {
    main();
}

module.exports = { enableAdvisorModule };
