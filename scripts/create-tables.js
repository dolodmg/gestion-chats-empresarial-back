/**
 * SCRIPT AUTOMÁTICO PARA CREAR TABLAS CLIENTE 676360675564956
 * 
 * Este script crea las 8 tablas especificadas en el proyecto:
 * 1. Asesores
 * 2. Contacto (resumen consolidado)
 * 3. Ventas
 * 4. Compras
 * 5. Lavadero
 * 6. Taller Mecánico Pilar
 * 7. Taller Mecánico Maschwitz
 * 8. Taller de Chapa y Pintura
 */

const mongoose = require('mongoose');
const CustomTable = require('./models/CustomTable'); // Ajustar la ruta según tu estructura

const CLIENT_ID = '676360675564956';
const ADMIN_USER_ID = 'ADMIN_ID_PLACEHOLDER'; // Reemplazar con el ID real del admin

// Definir las 8 tablas según especificaciones del proyecto
const TABLES_CONFIG = [
  {
    tableName: "Asesores",
    collectionName: "asesores_676360675564956",
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
    collectionName: "contacto_676360675564956",
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
    collectionName: "ventas_676360675564956",
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
    collectionName: "compras_676360675564956",
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
    collectionName: "lavadero_676360675564956",
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
    collectionName: "taller_pilar_676360675564956",
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
    collectionName: "taller_maschwitz_676360675564956",
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
    collectionName: "chapa_pintura_676360675564956",
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

/**
 * Función principal para crear todas las tablas
 */
async function createTablesForClient() {
  try {
    console.log('🚀 Iniciando creación de tablas para cliente 676360675564956...\n');
    
    const results = {
      success: [],
      errors: []
    };

    // Crear cada tabla
    for (const tableConfig of TABLES_CONFIG) {
      try {
        console.log(`📋 Creando tabla: ${tableConfig.tableName}`);
        
        // Verificar si la tabla ya existe
        const existingTable = await CustomTable.findOne({
          collectionName: tableConfig.collectionName
        });
        
        if (existingTable) {
          console.log(`⚠️  Tabla ${tableConfig.tableName} ya existe, omitiendo...`);
          results.errors.push({
            table: tableConfig.tableName,
            error: 'Ya existe'
          });
          continue;
        }
        
        // Crear la tabla
        const customTable = new CustomTable({
          clientId: CLIENT_ID,
          tableName: tableConfig.tableName,
          collectionName: tableConfig.collectionName,
          description: tableConfig.description,
          fields: tableConfig.fields,
          createdBy: ADMIN_USER_ID
        });
        
        await customTable.save();
        
        console.log(`✅ Tabla ${tableConfig.tableName} creada exitosamente`);
        results.success.push({
          table: tableConfig.tableName,
          collectionName: tableConfig.collectionName,
          id: customTable._id
        });
        
      } catch (error) {
        console.error(`❌ Error creando tabla ${tableConfig.tableName}:`, error.message);
        results.errors.push({
          table: tableConfig.tableName,
          error: error.message
        });
      }
    }
    
    // Resumen final
    console.log('\n📊 RESUMEN DE CREACIÓN:');
    console.log(`✅ Tablas creadas exitosamente: ${results.success.length}`);
    console.log(`❌ Tablas con errores: ${results.errors.length}`);
    
    if (results.success.length > 0) {
      console.log('\n🎉 TABLAS CREADAS:');
      results.success.forEach(item => {
        console.log(`  - ${item.table} (${item.collectionName}) - ID: ${item.id}`);
      });
    }
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  ERRORES:');
      results.errors.forEach(item => {
        console.log(`  - ${item.table}: ${item.error}`);
      });
    }
    
    return results;
    
  } catch (error) {
    console.error('💥 Error fatal en la creación de tablas:', error);
    throw error;
  }
}

/**
 * Función para crear datos de ejemplo en la tabla Asesores
 */
async function createSampleAdvisors() {
  try {
    console.log('\n👥 Creando asesores de ejemplo...');
    
    const advisorsTable = await CustomTable.findOne({
      collectionName: 'asesores_676360675564956'
    });
    
    if (!advisorsTable) {
      console.log('❌ No se encontró la tabla de Asesores');
      return;
    }
    
    // Obtener modelo dinámico
    const mongoose = require('mongoose');
    const AdvisorsModel = mongoose.model(
      'asesores_676360675564956',
      new mongoose.Schema({
        nombre: { type: String, required: true },
        servicio: { type: String, required: true },
        activo: { type: Boolean, required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      }),
      'asesores_676360675564956'
    );
    
    // Datos de ejemplo de asesores
    const sampleAdvisors = [
      { nombre: "Juan Pérez", servicio: "Ventas", activo: true },
      { nombre: "María González", servicio: "Ventas", activo: true },
      { nombre: "Carlos Ruiz", servicio: "Compras", activo: true },
      { nombre: "Ana López", servicio: "Compras", activo: true },
      { nombre: "Diego Martín", servicio: "Lavadero", activo: true },
      { nombre: "Laura Fernández", servicio: "Taller Mecánico Pilar", activo: true },
      { nombre: "Roberto Silva", servicio: "Taller Mecánico Maschwitz", activo: true },
      { nombre: "Patricia Morales", servicio: "Taller de Chapa y Pintura", activo: true }
    ];
    
    // Crear asesores
    for (const advisor of sampleAdvisors) {
      const newAdvisor = new AdvisorsModel(advisor);
      await newAdvisor.save();
      console.log(`👤 Asesor creado: ${advisor.nombre} - ${advisor.servicio}`);
    }
    
    console.log('✅ Asesores de ejemplo creados exitosamente');
    
  } catch (error) {
    console.error('❌ Error creando asesores de ejemplo:', error.message);
  }
}

/**
 * Función para verificar la estructura de las tablas creadas
 */
async function verifyTablesStructure() {
  try {
    console.log('\n🔍 Verificando estructura de las tablas...');
    
    const tables = await CustomTable.find({
      clientId: CLIENT_ID,
      isActive: true
    }).sort({ tableName: 1 });
    
    console.log(`📊 Total de tablas encontradas: ${tables.length}`);
    
    tables.forEach(table => {
      console.log(`\n📋 ${table.tableName}:`);
      console.log(`   Collection: ${table.collectionName}`);
      console.log(`   Campos: ${table.fields.length}`);
      
      table.fields.forEach(field => {
        const required = field.required ? ' (Requerido)' : '';
        const options = field.options && field.options.length > 0 ? 
          ` - Opciones: ${field.options.join(', ')}` : '';
        console.log(`     - ${field.label}: ${field.type}${required}${options}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error verificando tablas:', error.message);
  }
}

// Función principal de ejecución
async function main() {
  try {
    // Verificar conexión a MongoDB
    if (mongoose.connection.readyState !== 1) {
      console.log('📡 Conectando a MongoDB...');
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tu-database');
    }
    
    console.log('✅ Conectado a MongoDB');
    
    // Obtener ID del admin automáticamente
    console.log('🔍 Buscando usuario administrador...');
    ADMIN_USER_ID = await getAdminUser();
    
    // Crear tablas
    const results = await createTablesForClient();
    
    // Verificar estructura si se crearon tablas exitosamente
    if (results.success.length > 0) {
      await verifyTablesStructure();
    }
    
    console.log('\n🎉 Script completado exitosamente');
    console.log('\n📝 NOTA: Las tablas están listas para usar en el frontend "Mis datos"');
    console.log('    - El cliente podrá ver y gestionar estas tablas desde su panel');
    console.log('    - Los campos textarea tendrán el modal "Ver más" implementado');
    console.log('    - La tabla "Asesores" estará vacía inicialmente (agregar asesores manualmente)');
    
  } catch (error) {
    console.error('💥 Error ejecutando script:', error);
    
    if (error.message.includes('administrador')) {
      console.log('\n🔧 Para crear un usuario admin:');
      console.log('const User = require("./models/User");');
      console.log('const admin = new User({ name: "Admin", email: "admin@empresa.com", role: "admin", password: "tu-password" });');
      console.log('await admin.save();');
    }
  }
}

// Exportar funciones para uso modular
module.exports = {
  createTablesForClient,
  createSampleAdvisors,
  verifyTablesStructure,
  TABLES_CONFIG,
  CLIENT_ID
};

// Ejecutar si se llama directamente
if (require.main === module) {
  main()
    .then(() => {
      console.log('👋 Script terminado, cerrando conexión...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}