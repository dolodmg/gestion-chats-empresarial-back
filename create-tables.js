/**
 * SCRIPT CONFIGURABLE - Crear tablas para cualquier cliente
 * 
 * Para cliente 676360675564956: node create-tables.js 676360675564956
 * Para cliente 564098906790434: node create-tables.js 564098906790434
 */

const mongoose = require('mongoose');
const CustomTable = require('./models/CustomTable');

// Obtener CLIENT_ID desde argumentos de línea de comandos
const CLIENT_ID = process.argv[2];

if (!CLIENT_ID) {
  console.error('❌ Error: Debes proporcionar un CLIENT_ID');
  console.log('Uso: node create-tables.js [CLIENT_ID]');
  console.log('Ejemplos:');
  console.log('  node create-tables.js 676360675564956');
  console.log('  node create-tables.js 564098906790434');
  process.exit(1);
}

console.log(`🎯 Configurando tablas para cliente: ${CLIENT_ID}`);

// Función para generar configuración de tablas para cualquier cliente
function generateTablesConfig(clientId) {
  return [
    {
      tableName: "Asesores",
      collectionName: `asesores_${clientId}`,
      description: "Tabla de asesores por servicio para asignación automática",
      fields: [
        { name: "nombre", type: "string", label: "Nombre del Asesor", required: true },
        { name: "servicio", type: "select", label: "Tipo de Servicio", required: true,
          options: ["Ventas", "Compras", "Lavadero", "Taller Mecánico Pilar", "Taller Mecánico Maschwitz", "Taller de Chapa y Pintura"] },
        { name: "activo", type: "boolean", label: "Asesor Activo", required: true }
      ]
    },
    {
      tableName: "Contacto",
      collectionName: `contacto_${clientId}`,
      description: "Tabla resumen consolidado de todos los contactos por servicio",
      fields: [
        { name: "fecha_hora", type: "date", label: "Fecha y Hora", required: true },
        { name: "servicio", type: "select", label: "Servicio", required: true,
          options: ["Ventas", "Compras", "Lavadero", "Taller Mecánico Pilar", "Taller Mecánico Maschwitz", "Taller de Chapa y Pintura"] },
        { name: "telefono", type: "phone", label: "Teléfono", required: true },
        { name: "nombre", type: "string", label: "Nombre", required: true },
        { name: "asesor", type: "string", label: "Asesor Asignado", required: false }
      ]
    },
    {
      tableName: "Ventas",
      collectionName: `ventas_${clientId}`,
      description: "Tabla específica para leads de ventas de vehículos",
      fields: [
        { name: "fecha_hora", type: "date", label: "Fecha y Hora", required: true },
        { name: "telefono", type: "phone", label: "Teléfono", required: true },
        { name: "nombre", type: "string", label: "Nombre", required: true },
        { name: "marca", type: "string", label: "Marca del Vehículo", required: false },
        { name: "modelo", type: "string", label: "Modelo del Vehículo", required: false },
        { name: "anio", type: "number", label: "Año", required: false },
        { name: "kms", type: "number", label: "Kilómetros", required: false },
        { name: "asesor", type: "string", label: "Asesor Asignado", required: false }
      ]
    },
    {
      tableName: "Compras",
      collectionName: `compras_${clientId}`,
      description: "Tabla específica para leads de compras de vehículos",
      fields: [
        { name: "fecha_hora", type: "date", label: "Fecha y Hora", required: true },
        { name: "telefono", type: "phone", label: "Teléfono", required: true },
        { name: "nombre", type: "string", label: "Nombre", required: true },
        { name: "info_recolectada", type: "textarea", label: "Información Recolectada", required: false },
        { name: "asesor", type: "string", label: "Asesor Asignado", required: false }
      ]
    },
    {
      tableName: "Lavadero",
      collectionName: `lavadero_${clientId}`,
      description: "Tabla específica para servicios de lavadero",
      fields: [
        { name: "fecha_hora", type: "date", label: "Fecha y Hora", required: true },
        { name: "telefono", type: "phone", label: "Teléfono", required: true },
        { name: "nombre", type: "string", label: "Nombre", required: true },
        { name: "info", type: "textarea", label: "Información Adicional", required: false },
        { name: "asesor", type: "string", label: "Asesor Asignado", required: false }
      ]
    },
    {
      tableName: "Taller Mecánico Pilar",
      collectionName: `taller_pilar_${clientId}`,
      description: "Tabla específica para servicios mecánicos en Pilar",
      fields: [
        { name: "fecha_hora", type: "date", label: "Fecha y Hora", required: true },
        { name: "telefono", type: "phone", label: "Teléfono", required: true },
        { name: "nombre", type: "string", label: "Nombre", required: true },
        { name: "inconveniente", type: "textarea", label: "Inconveniente Reportado", required: false },
        { name: "vehiculo", type: "string", label: "Información del Vehículo", required: false },
        { name: "asesor", type: "string", label: "Asesor Asignado", required: false }
      ]
    },
    {
      tableName: "Taller Mecánico Maschwitz",
      collectionName: `taller_maschwitz_${clientId}`,
      description: "Tabla específica para servicios mecánicos en Maschwitz",
      fields: [
        { name: "fecha_hora", type: "date", label: "Fecha y Hora", required: true },
        { name: "telefono", type: "phone", label: "Teléfono", required: true },
        { name: "nombre", type: "string", label: "Nombre", required: true },
        { name: "inconveniente", type: "textarea", label: "Inconveniente Reportado", required: false },
        { name: "vehiculo", type: "string", label: "Información del Vehículo", required: false },
        { name: "asesor", type: "string", label: "Asesor Asignado", required: false }
      ]
    },
    {
      tableName: "Taller de Chapa y Pintura",
      collectionName: `chapa_pintura_${clientId}`,
      description: "Tabla específica para servicios de chapa y pintura",
      fields: [
        { name: "fecha_hora", type: "date", label: "Fecha y Hora", required: true },
        { name: "telefono", type: "phone", label: "Teléfono", required: true },
        { name: "nombre", type: "string", label: "Nombre", required: true },
        { name: "inconveniente", type: "textarea", label: "Inconveniente Reportado", required: false },
        { name: "asesor", type: "string", label: "Asesor Asignado", required: false }
      ]
    }
  ];
}

// Función para obtener admin automáticamente
async function getAdminUser() {
  try {
    const User = require('./models/User');
    const admin = await User.findOne({ role: 'admin' });
    
    if (!admin) {
      throw new Error('No se encontró usuario administrador');
    }
    
    console.log(`Admin encontrado: ${admin.name} (${admin.email})`);
    return admin._id.toString();
    
  } catch (error) {
    console.error('Error buscando admin:', error.message);
    throw error;
  }
}

// Función para crear todas las tablas
async function createTablesForClient(clientId) {
  try {
    console.log(`Iniciando creación de tablas para cliente ${clientId}...\n`);
    
    const results = {
      success: [],
      errors: [],
      total: 0
    };

    // Obtener admin ID
    const adminId = await getAdminUser();

    // Generar configuración de tablas para este cliente
    const tablesConfig = generateTablesConfig(clientId);
    results.total = tablesConfig.length;

    // Crear cada tabla
    for (const tableConfig of tablesConfig) {
      try {
        console.log(`Creando tabla: ${tableConfig.tableName}`);
        
        // Verificar si ya existe
        const existingTable = await CustomTable.findOne({
          collectionName: tableConfig.collectionName
        });
        
        if (existingTable) {
          console.log(`Tabla ${tableConfig.tableName} ya existe, omitiendo...`);
          results.errors.push({
            table: tableConfig.tableName,
            error: 'Ya existe'
          });
          continue;
        }
        
        // Crear tabla
        const customTable = new CustomTable({
          clientId: clientId,
          tableName: tableConfig.tableName,
          collectionName: tableConfig.collectionName,
          description: tableConfig.description,
          fields: tableConfig.fields,
          createdBy: adminId
        });
        
        await customTable.save();
        
        console.log(`Tabla ${tableConfig.tableName} creada exitosamente`);
        results.success.push({
          table: tableConfig.tableName,
          collectionName: tableConfig.collectionName,
          id: customTable._id
        });
        
      } catch (error) {
        console.error(`Error creando tabla ${tableConfig.tableName}:`, error.message);
        results.errors.push({
          table: tableConfig.tableName,
          error: error.message
        });
      }
    }
    
    // Resumen
    console.log('\nRESUMEN:');
    console.log(`Cliente: ${clientId}`);
    console.log(`Tablas creadas: ${results.success.length}`);
    console.log(`Errores: ${results.errors.length}`);
    
    if (results.success.length > 0) {
      console.log('\nTABLAS CREADAS:');
      results.success.forEach(item => {
        console.log(`  ✅ ${item.table} (${item.collectionName})`);
      });
    }
    
    if (results.errors.length > 0) {
      console.log('\nERRORES:');
      results.errors.forEach(item => {
        console.log(`  ❌ ${item.table}: ${item.error}`);
      });
    }
    
    return results;
    
  } catch (error) {
    console.error('Error fatal:', error);
    throw error;
  }
}

// Función principal
async function main() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://appUser:07092015Leyla%40@localhost:27017/whatsappMonitorDB');
    console.log('Conectado a MongoDB');
    
    const results = await createTablesForClient(CLIENT_ID);
    
    console.log('\nScript completado');
    console.log(`Las tablas del cliente ${CLIENT_ID} están listas en el frontend "Mis datos"`);
    
    // Mostrar próximos pasos
    if (results.success.length > 0) {
      console.log('\nPRÓXIMOS PASOS:');
      console.log(`1. Agregar asesores a la tabla: asesores_${CLIENT_ID}`);
      console.log(`2. Configurar API de leads para cliente ${CLIENT_ID}`);
      console.log(`3. El cliente podrá ver sus tablas en el panel "Mis datos"`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Ejecutar
main();