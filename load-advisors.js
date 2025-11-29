/**
 * SCRIPT PARA CARGAR ASESORES EXISTENTES
 * Cliente: 676360675564956
 * 
 * Ejecutar: node load-advisors.js
 */

const mongoose = require('mongoose');
const CustomTable = require('./models/CustomTable');

const CLIENT_ID = '676360675564956';

// Lista de asesores extraída de las imágenes
const ASESORES_DATA = [
  // Taller de Chapa y Pintura
  { nombre: "Martin", servicio: "Taller de Chapa y Pintura", activo: true },
  { nombre: "Alan", servicio: "Taller de Chapa y Pintura", activo: true },
  
  // Taller Mecánico Maschwitz
  { nombre: "Edgar", servicio: "Taller Mecánico Maschwitz", activo: true },
  
  // Taller Mecánico Pilar
  { nombre: "Martin", servicio: "Taller Mecánico Pilar", activo: true },
  { nombre: "Alan", servicio: "Taller Mecánico Pilar", activo: true },
  
  // Lavadero
  { nombre: "Carlos", servicio: "Lavadero", activo: true },
  
  // Compras
  { nombre: "Walter", servicio: "Compras", activo: true },
  { nombre: "Franco", servicio: "Compras", activo: true },
  { nombre: "Daiana", servicio: "Compras", activo: true },
  { nombre: "Valentin", servicio: "Compras", activo: true },
  
  // Ventas
  { nombre: "Bianca", servicio: "Ventas", activo: true },
  { nombre: "Brisa", servicio: "Ventas", activo: true },
  { nombre: "Victoria", servicio: "Ventas", activo: true },
  { nombre: "Lourdes", servicio: "Ventas", activo: true },
  { nombre: "Antonella", servicio: "Ventas", activo: true },
  { nombre: "Delfina", servicio: "Ventas", activo: true }
];

// Cache para modelos dinámicos
const dynamicModelsCache = new Map();

/**
 * Obtener o crear modelo dinámico con cache
 */
function getDynamicModel(collectionName, schema) {
  if (dynamicModelsCache.has(collectionName)) {
    return dynamicModelsCache.get(collectionName);
  }
  
  if (mongoose.models[collectionName]) {
    dynamicModelsCache.set(collectionName, mongoose.models[collectionName]);
    return mongoose.models[collectionName];
  }
  
  const DynamicModel = mongoose.model(
    collectionName,
    new mongoose.Schema(schema),
    collectionName
  );
  
  dynamicModelsCache.set(collectionName, DynamicModel);
  return DynamicModel;
}

/**
 * Función principal para cargar asesores
 */
async function loadAdvisors() {
  try {
    console.log(`🎯 Cargando asesores para cliente ${CLIENT_ID}...`);
    
    // Obtener tabla de asesores
    const asesoresTable = await CustomTable.findOne({
      collectionName: `asesores_${CLIENT_ID}`
    });
    
    if (!asesoresTable) {
      throw new Error(`No se encontró la tabla de asesores para cliente ${CLIENT_ID}`);
    }
    
    console.log('✅ Tabla de asesores encontrada');
    
    // Obtener modelo dinámico
    const AsesoresModel = getDynamicModel(
      `asesores_${CLIENT_ID}`,
      asesoresTable.getValidationSchema()
    );
    
    // Limpiar tabla existente (opcional)
    const existingCount = await AsesoresModel.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Encontrados ${existingCount} asesores existentes`);
      console.log('🗑️  Limpiando tabla antes de cargar nuevos asesores...');
      await AsesoresModel.deleteMany({});
    }
    
    const results = {
      success: [],
      errors: [],
      total: ASESORES_DATA.length
    };
    
    // Cargar cada asesor
    for (let i = 0; i < ASESORES_DATA.length; i++) {
      try {
        const asesorData = ASESORES_DATA[i];
        console.log(`👤 Creando asesor: ${asesorData.nombre} - ${asesorData.servicio}`);
        
        // Verificar si ya existe (por si acaso)
        const existingAsesor = await AsesoresModel.findOne({
          nombre: asesorData.nombre,
          servicio: asesorData.servicio
        });
        
        if (existingAsesor) {
          console.log(`⚠️  Asesor ${asesorData.nombre} (${asesorData.servicio}) ya existe, omitiendo...`);
          results.errors.push({
            index: i,
            data: asesorData,
            error: 'Ya existe'
          });
          continue;
        }
        
        // Crear asesor
        const newAsesor = new AsesoresModel({
          nombre: asesorData.nombre,
          servicio: asesorData.servicio,
          activo: asesorData.activo,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await newAsesor.save();
        
        results.success.push({
          index: i,
          id: newAsesor._id,
          nombre: asesorData.nombre,
          servicio: asesorData.servicio
        });
        
        console.log(`✅ Asesor creado: ${asesorData.nombre}`);
        
      } catch (error) {
        console.error(`❌ Error creando asesor ${ASESORES_DATA[i].nombre}:`, error.message);
        results.errors.push({
          index: i,
          data: ASESORES_DATA[i],
          error: error.message
        });
      }
    }
    
    // Resumen final
    console.log('\n📊 RESUMEN DE CARGA:');
    console.log(`📈 Total asesores: ${results.total}`);
    console.log(`✅ Creados exitosamente: ${results.success.length}`);
    console.log(`❌ Errores: ${results.errors.length}`);
    
    if (results.success.length > 0) {
      console.log('\n🎉 ASESORES CREADOS:');
      
      // Agrupar por servicio para mostrar mejor
      const byService = {};
      results.success.forEach(item => {
        if (!byService[item.servicio]) {
          byService[item.servicio] = [];
        }
        byService[item.servicio].push(item.nombre);
      });
      
      Object.entries(byService).forEach(([servicio, nombres]) => {
        console.log(`  📋 ${servicio}: ${nombres.join(', ')}`);
      });
    }
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  ERRORES:');
      results.errors.forEach(item => {
        console.log(`  - ${item.data.nombre} (${item.data.servicio}): ${item.error}`);
      });
    }
    
    // Verificar distribución final
    console.log('\n🔍 VERIFICACIÓN FINAL:');
    const finalCount = await AsesoresModel.countDocuments();
    console.log(`📊 Total asesores en la tabla: ${finalCount}`);
    
    // Contar por servicio
    const serviceStats = await AsesoresModel.aggregate([
      { $match: { activo: true } },
      { $group: { _id: "$servicio", count: { $sum: 1 }, nombres: { $push: "$nombre" } } },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('\n📈 DISTRIBUCIÓN POR SERVICIO:');
    serviceStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count} asesores (${stat.nombres.join(', ')})`);
    });
    
    return results;
    
  } catch (error) {
    console.error('💥 Error fatal cargando asesores:', error);
    throw error;
  }
}

/**
 * Función para verificar el estado de la tabla
 */
async function verifyTable() {
  try {
    console.log('🔍 Verificando tabla de asesores...');
    
    const asesoresTable = await CustomTable.findOne({
      collectionName: `asesores_${CLIENT_ID}`
    });
    
    if (!asesoresTable) {
      console.log('❌ Tabla de asesores no encontrada');
      console.log('💡 Ejecuta primero: node create-tables.js 676360675564956');
      return false;
    }
    
    console.log('✅ Tabla de asesores encontrada');
    console.log(`📋 Configuración: ${asesoresTable.fields.length} campos definidos`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error verificando tabla:', error.message);
    return false;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('📡 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://appUser:07092015Leyla%40@localhost:27017/whatsappMonitorDB');
    console.log('✅ Conectado a MongoDB');
    
    // Verificar que la tabla existe
    const tableExists = await verifyTable();
    if (!tableExists) {
      process.exit(1);
    }
    
    // Cargar asesores
    const results = await loadAdvisors();
    
    console.log('\n🎉 Proceso completado exitosamente');
    
    if (results.success.length > 0) {
      console.log('\n📝 PRÓXIMOS PASOS:');
      console.log('1. Los asesores están listos para recibir leads automáticamente');
      console.log('2. El sistema round-robin distribuirá leads equitativamente');
      console.log('3. Puedes probar la API de leads con los cURL de ejemplo');
      console.log('\n🧪 Test rápido:');
      console.log(`curl -X GET "http://localhost:3000/api/leads/advisor-stats?clientId=${CLIENT_ID}" -H "x-n8n-token: tu-token"`);
    }
    
  } catch (error) {
    console.error('💥 Error ejecutando script:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Ejecutar script
main();