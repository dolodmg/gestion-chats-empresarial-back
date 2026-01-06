const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const Advisor = require('../models/Advisor');

/**
 * Script de migración para agregar email y contraseña a asesores existentes
 * 
 * IMPORTANTE: Este script debe ejecutarse UNA SOLA VEZ después de actualizar el modelo Advisor
 * 
 * Uso:
 * node scripts/migrateAdvisors.js
 */

async function migrateAdvisors() {
    try {
        console.log('🔄 Iniciando migración de asesores...\n');

        // Buscar todos los asesores que no tienen email
        const advisorsWithoutEmail = await Advisor.find({
            $or: [
                { email: { $exists: false } },
                { email: '' },
                { email: null }
            ]
        });

        console.log(`📊 Encontrados ${advisorsWithoutEmail.length} asesores sin email\n`);

        if (advisorsWithoutEmail.length === 0) {
            console.log('✅ No hay asesores para migrar');
            process.exit(0);
        }

        const results = [];

        for (const advisor of advisorsWithoutEmail) {
            try {
                // Generar email basado en el nombre (normalizado)
                const emailName = advisor.name
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
                    .replace(/\s+/g, '.')
                    .replace(/[^a-z0-9.]/g, '');

                const email = `${emailName}@asesor.local`;

                // Generar contraseña aleatoria de 12 caracteres
                const password = generateRandomPassword(12);

                // Actualizar el asesor
                advisor.email = email;
                advisor.password = password; // Se hasheará automáticamente por el middleware pre-save

                await advisor.save();

                results.push({
                    id: advisor._id,
                    name: advisor.name,
                    email: email,
                    password: password, // Guardar la contraseña en texto plano SOLO para mostrarla al admin
                    clientId: advisor.clientId
                });

                console.log(`✅ Migrado: ${advisor.name}`);
                console.log(`   Email: ${email}`);
                console.log(`   Contraseña temporal: ${password}\n`);

            } catch (error) {
                console.error(`❌ Error migrando ${advisor.name}:`, error.message);
            }
        }

        // Guardar las credenciales en un archivo para que el admin las pueda comunicar
        const fs = require('fs');
        const outputPath = './advisor_credentials.json';

        fs.writeFileSync(
            outputPath,
            JSON.stringify(results, null, 2),
            'utf8'
        );

        console.log(`\n📝 Credenciales guardadas en: ${outputPath}`);
        console.log(`\n⚠️  IMPORTANTE: Comunica estas credenciales a los asesores y elimina el archivo después.`);
        console.log(`\n✅ Migración completada exitosamente`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Error en la migración:', error);
        process.exit(1);
    }
}

/**
 * Genera una contraseña aleatoria segura
 */
function generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    // Asegurar al menos un carácter de cada tipo
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Mayúscula
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Minúscula
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Número
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Especial

    // Completar el resto
    for (let i = password.length; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Mezclar los caracteres
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Ejecutar migración
migrateAdvisors();
